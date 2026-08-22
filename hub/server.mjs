/**
 * Local LLM Hub — OpenAI-compatible gateway (Capability 3–5).
 * Routes requests to Ollama with role-based model selection.
 */
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OLLAMA = process.env.OLLAMA_BASE || "http://127.0.0.1:11434";

export function loadConfig() {
  const path = join(__dir, "config.json");
  if (!existsSync(path)) return { port: 8555, ollama: OLLAMA, roles: { general: "llama3.2:3b" } };
  return JSON.parse(readFileSync(path, "utf8"));
}

export async function ollamaChat(model, messages) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  return data.message?.content || "";
}

export async function routeRequest(messages, config) {
  const last = messages.filter((m) => m.role === "user").pop()?.content || "";
  const complex = last.length > 120 || /\b(build|deploy|architect|refactor)\b/i.test(last);
  const role = complex ? "planner" : "fast";
  const model = config.roles[role] || config.roles.general || "llama3.2:3b";
  const content = await ollamaChat(model, messages);
  return { model, content };
}

export function startServer(config = loadConfig()) {
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", ollama: OLLAMA }));
      return;
    }

    if (req.url === "/v1/models") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ object: "list", data: Object.values(config.roles).map((id) => ({ id, object: "model" })) }));
      return;
    }

    if (req.url === "/v1/chat/completions" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { messages = [] } = JSON.parse(body || "{}");
      try {
        const { model, content } = await routeRequest(messages, config);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          id: "pos-hub",
          object: "chat.completion",
          model,
          choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
        }));
      } catch (err) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }

    res.writeHead(404); res.end();
  });

  server.listen(config.port, () => {
    process.stdout.write(`Prompt OS Local LLM Hub http://localhost:${config.port}\n`);
  });
  return server;
}

if (process.argv[1]?.endsWith("server.mjs")) startServer();
