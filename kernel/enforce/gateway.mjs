/**
 * POS Gateway — mandatory OpenAI + Ollama proxy with prepend-only injection.
 * Expert pattern: transparent reverse proxy (LiteLLM / Forge / Nexus middleware).
 * Fail-closed in strict mode when POS kernel files are missing.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { injectPosMessages, injectPosOllama, preserveClientPayload } from "./inject.mjs";
import { record } from "../scripts/audit.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

export function enforcePaths(home = homedir()) {
  const posRoot = process.env.PROMPT_OS_ROOT || join(home, ".agents", "prompt-os");
  return {
    posRoot,
    routerPath: join(home, ".agents", "router", "PROMPT-ROUTER.md"),
    enforceManifest: join(posRoot, "ENFORCE.json"),
  };
}

export function loadEnforceConfig(home = homedir()) {
  const { enforceManifest, posRoot, routerPath } = enforcePaths(home);
  const defaults = {
    mode: "soft",
    port: 8555,
    ollamaUpstream: process.env.OLLAMA_UPSTREAM || "http://127.0.0.1:11434",
    strict: false,
    posRoot,
    routerPath,
  };
  if (!existsSync(enforceManifest)) return defaults;
  try {
    return { ...defaults, ...JSON.parse(readFileSync(enforceManifest, "utf8")) };
  } catch {
    return defaults;
  }
}

export function loadHubConfig(posRoot) {
  const path = join(posRoot, "hub", "config.json");
  if (!existsSync(path)) return { roles: { general: "llama3.2:3b", planner: "qwen3:8b", fast: "qwen3.5:4b" } };
  return JSON.parse(readFileSync(path, "utf8"));
}

function strictGate(config) {
  if (!config.strict) return null;
  if (!existsSync(config.routerPath)) return "PROMPT-ROUTER missing — strict gate closed";
  if (!existsSync(join(config.posRoot, "CONSTITUTION.md"))) return "CONSTITUTION missing — strict gate closed";
  return null;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

async function forwardOllamaChat(upstream, body) {
  const res = await fetch(`${upstream}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ollama upstream ${res.status}`);
  return res.json();
}

async function forwardOllamaGenerate(upstream, body) {
  const res = await fetch(`${upstream}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ollama upstream ${res.status}`);
  return res.json();
}

function pickModel(messages, hubCfg) {
  const last = messages.filter((m) => m.role === "user").pop()?.content || "";
  const complex = last.length > 120 || /\b(build|deploy|architect|refactor|research)\b/i.test(last);
  const role = complex ? "planner" : "fast";
  return hubCfg.roles?.[role] || hubCfg.roles?.general || "llama3.2:3b";
}

export function createGatewayServer(config = loadEnforceConfig()) {
  const hubCfg = loadHubConfig(config.posRoot);

  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const gateErr = strictGate(config);
    if (gateErr && !req.url?.startsWith("/health")) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: gateErr, pos: "fail-closed" }));
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          mode: config.mode,
          strict: config.strict,
          ollamaUpstream: config.ollamaUpstream,
        }),
      );
      return;
    }

    if (req.url === "/v1/models" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          object: "list",
          data: Object.values(hubCfg.roles || {}).map((id) => ({ id, object: "model" })),
        }),
      );
      return;
    }

    // OpenAI-compatible chat
    if (req.url === "/v1/chat/completions" && req.method === "POST") {
      const raw = await readBody(req);
      let clientBody = {};
      try {
        clientBody = JSON.parse(raw || "{}");
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }

      const { messages: injectedMessages, injected: didInject } = injectPosMessages(clientBody.messages || [], config);
      const model = clientBody.model || pickModel(injectedMessages, hubCfg);
      const passthrough = preserveClientPayload(clientBody);

      record("pos-gateway", "chat/completions", JSON.stringify({ injected: didInject, model, tools: !!clientBody.tools }));

      try {
        const ollamaBody = {
          model,
          messages: injectedMessages,
          stream: false,
        };
        const data = await forwardOllamaChat(config.ollamaUpstream, ollamaBody);
        const content = data.message?.content || "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "pos-gateway",
            object: "chat.completion",
            model,
            choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
            pos: { injected: didInject, mode: config.mode },
            ...passthrough.tools ? { tools: passthrough.tools } : {},
          }),
        );
      } catch (err) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }

    // Ollama native API — transparent proxy with injection
    if (req.url === "/api/chat" && req.method === "POST") {
      const raw = await readBody(req);
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const { body: injectedBody, injected } = injectPosOllama(body, config);
      record("pos-gateway", "ollama/chat", JSON.stringify({ injected, model: body.model }));
      try {
        const data = await forwardOllamaChat(config.ollamaUpstream, injectedBody);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...data, pos: { injected, mode: config.mode } }));
      } catch (err) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }

    if (req.url === "/api/generate" && req.method === "POST") {
      const raw = await readBody(req);
      let body = JSON.parse(raw || "{}");
      if (body.system && !/\[PROMPT OS\]/i.test(body.system)) {
        const preamble = injectPosOllama({ system: body.system }, config);
        body = { ...body, system: preamble.body.system };
      }
      record("pos-gateway", "ollama/generate", JSON.stringify({ model: body.model }));
      try {
        const data = await forwardOllamaGenerate(config.ollamaUpstream, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }

    // Proxy /api/tags for ollama CLI compatibility
    if (req.url === "/api/tags" && req.method === "GET") {
      try {
        const upstream = await fetch(`${config.ollamaUpstream}/api/tags`);
        const data = await upstream.text();
        res.writeHead(upstream.status, { "Content-Type": "application/json" });
        res.end(data);
      } catch (err) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return server;
}

export function startGateway(config = loadEnforceConfig()) {
  const port = config.port || 8555;
  const server = createGatewayServer(config);
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(
      `POS Gateway (hard) http://127.0.0.1:${port} mode=${config.mode} strict=${config.strict}\n`,
    );
  });
  return server;
}

if (process.argv[1]?.endsWith("gateway.mjs")) {
  startGateway();
}
