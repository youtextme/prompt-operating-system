/**
 * POS Gateway — mandatory OpenAI + Ollama proxy with prepend-only injection.
 * Expert pattern: transparent reverse proxy (LiteLLM / Forge / Nexus middleware).
 *
 * Two hard properties, split by direction:
 *   - Prompt direction: NEVER blocked. Strict mode used to answer 503, which
 *     made "hard" mean "your prompt fails". Now every prompt is attested and
 *     answered; if the kernel is unhealthy the attestation is `degraded` and the
 *     first line of the answer says so (banner.mjs).
 *   - Claim direction: fail-closed elsewhere (tenet-check/evidence-check refuse
 *     to certify work whose prompt has no routed attestation).
 *
 * Compatibility is asserted, not assumed: every upstream body passes through
 * guardOutbound, so tools / MCP blocks / client params that POS would otherwise
 * drop cause POS to forward the ORIGINAL body instead.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { injectPosMessages, injectPosOllama, preserveClientPayload } from "./inject.mjs";
import { attestPrompt } from "./attest.mjs";
import { applyBanner, enforceBanner } from "./banner.mjs";
import { guardOutbound } from "./compat.mjs";
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

/**
 * Kernel readiness. Returns null when healthy, else the reason the answer must
 * be labelled degraded. This never rejects a prompt — the reason travels into
 * the first line of the response instead.
 */
export function kernelGate(config) {
  if (!existsSync(config.routerPath)) return "PROMPT-ROUTER.md missing";
  if (!existsSync(join(config.posRoot, "CONSTITUTION.md"))) return "CONSTITUTION.md missing";
  return null;
}

function lastUserPrompt(messages = []) {
  const m = [...messages].reverse().find((x) => x.role === "user");
  return typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
}

/** Attest, then label the response body with the truthful first line. */
function routeAndBanner({ prompt, surface, client, config, content }) {
  const att = attestPrompt({ prompt, surface, client, root: config.posRoot });
  const routed = att.state === "routed";
  const labelled = applyBanner(content, {
    routed,
    reason: routed ? null : att.reason,
    attestationId: att.id,
    signature: att.signature,
  });
  // Re-run the anti-forgery check on our own output: if anything about the
  // attestation fails to verify, the response degrades rather than lying.
  const checked = enforceBanner(labelled, config.posRoot);
  return { text: checked.text, attestation: att, routed: checked.routed };
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

    const gateErr = kernelGate(config);

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          mode: config.mode,
          strict: config.strict,
          kernel: gateErr ? "degraded" : "healthy",
          kernelReason: gateErr,
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

      // Injection must only ever ADD. Everything the client sent (tools,
      // tool_choice, MCP block, response_format, options) is forwarded upstream.
      const proposed = { ...clientBody, ...passthrough, model, messages: injectedMessages, stream: false };
      const { body: upstreamBody, violations, preserved } = guardOutbound({ ...clientBody, model, stream: false }, proposed);

      record(
        "pos-gateway",
        "chat/completions",
        JSON.stringify({ injected: didInject, model, tools: (clientBody.tools || []).length, compat: preserved ? "ok" : violations }),
      );

      try {
        const data = await forwardOllamaChat(config.ollamaUpstream, upstreamBody);
        const raw = data.message?.content || "";
        const { text: content, attestation } = routeAndBanner({
          prompt: lastUserPrompt(clientBody.messages || []),
          surface: "openai/chat.completions",
          client: req.headers["user-agent"] || "unknown",
          config,
          content: raw,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "pos-gateway",
            object: "chat.completion",
            model,
            choices: [
              {
                message: { role: "assistant", content, ...data.message?.tool_calls ? { tool_calls: data.message.tool_calls } : {} },
                finish_reason: data.message?.tool_calls ? "tool_calls" : "stop",
              },
            ],
            pos: {
              injected: didInject,
              mode: config.mode,
              attestation: attestation.id,
              state: attestation.state,
              reason: attestation.reason,
              compatPreserved: preserved,
              compatViolations: violations,
            },
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
      const { body: injected0, injected } = injectPosOllama(body, config);
      const { body: injectedBody, violations, preserved } = guardOutbound(body, injected0);
      record("pos-gateway", "ollama/chat", JSON.stringify({ injected, model: body.model, compat: preserved ? "ok" : violations }));
      try {
        const data = await forwardOllamaChat(config.ollamaUpstream, injectedBody);
        const { text, attestation } = routeAndBanner({
          prompt: lastUserPrompt(body.messages || []),
          surface: "ollama/api/chat",
          client: req.headers["user-agent"] || "unknown",
          config,
          content: data.message?.content || "",
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...data,
            message: { ...(data.message || { role: "assistant" }), content: text },
            pos: { injected, mode: config.mode, attestation: attestation.id, state: attestation.state, compatPreserved: preserved },
          }),
        );
      } catch (err) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }

    if (req.url === "/api/generate" && req.method === "POST") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw || "{}");
      // Spoof-resistant: recognition is by signed stamp, not by the words "[PROMPT OS]".
      const { body: injected0 } = injectPosOllama(parsed, config);
      const { body, preserved } = guardOutbound(parsed, injected0);
      record("pos-gateway", "ollama/generate", JSON.stringify({ model: body.model, compat: preserved ? "ok" : "reverted" }));
      try {
        const data = await forwardOllamaGenerate(config.ollamaUpstream, body);
        const { text, attestation } = routeAndBanner({
          prompt: String(parsed.prompt ?? ""),
          surface: "ollama/api/generate",
          client: req.headers["user-agent"] || "unknown",
          config,
          content: data.response || "",
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...data, response: text, pos: { attestation: attestation.id, state: attestation.state } }));
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
