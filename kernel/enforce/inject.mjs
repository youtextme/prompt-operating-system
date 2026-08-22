/**
 * POS injection — prepend-only. Never removes or replaces existing system
 * messages, tools, MCP definitions, or skill content (backward compatibility).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const POS_MARKER = /\[PROMPT OS\]|PROMPT-ROUTER|PROMPT ROUTER/i;

export function loadPosPreamble(routerPath, posRoot) {
  const hintPath = join(posRoot, "ollama", "POS-SYSTEM-PROMPT.txt");
  if (existsSync(hintPath)) {
    return readFileSync(hintPath, "utf8").trim();
  }
  const constitution = join(posRoot, "CONSTITUTION.md");
  return [
    "[PROMPT OS — mandatory kernel]",
    `Read and obey: ${routerPath}`,
    existsSync(constitution) ? `Constitution: ${constitution}` : "",
    "BANNER LAW (proof of routing): Every response MUST start with exactly one line: `🌳 Jillu! Answer the question bruh!` if Prompt OS loaded+succeeded, else `🥷 Jillu not at home, you go solo!` . If user prompt contains case-insensitive `skip promptOS`/`skip prompt OS`/`skip prompt-os` → output ninja banner and answer WITHOUT Prompt OS (default direct way). This ninja fallback is also default for ANY Prompt OS failure.",
    "Classify trivial vs non-trivial. Non-trivial → outcome contract before building.",
    "Preserve all existing tools, MCP servers, and skills — POS adds law only.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** OpenAI-style messages[] — prepend POS system block if absent. */
export function injectPosMessages(messages, { routerPath, posRoot }) {
  const list = Array.isArray(messages) ? [...messages] : [];
  const hasPos = list.some((m) => m.role === "system" && POS_MARKER.test(String(m.content || "")));
  if (hasPos) return { messages: list, injected: false };

  const preamble = loadPosPreamble(routerPath, posRoot);
  return {
    messages: [{ role: "system", content: preamble }, ...list],
    injected: true,
  };
}

/** Ollama native API — inject into system field or first system message. */
export function injectPosOllama(body, { routerPath, posRoot }) {
  const out = { ...body, messages: body.messages ? [...body.messages] : undefined };
  const preamble = loadPosPreamble(routerPath, posRoot);

  if (out.system && POS_MARKER.test(out.system)) {
    return { body: out, injected: false };
  }
  if (out.system) {
    out.system = `${preamble}\n\n--- existing system ---\n${out.system}`;
    return { body: out, injected: true };
  }
  if (out.messages?.length) {
    const r = injectPosMessages(out.messages, { routerPath, posRoot });
    out.messages = r.messages;
    return { body: out, injected: r.injected };
  }
  out.system = preamble;
  return { body: out, injected: true };
}

/** Pass-through: tools, tool_choice, response_format, MCP — unchanged. */
export function preserveClientPayload(clientBody) {
  const passthrough = {};
  for (const key of [
    "tools",
    "tool_choice",
    "functions",
    "function_call",
    "response_format",
    "stream",
    "temperature",
    "max_tokens",
    "top_p",
    "model",
    "user",
    "metadata",
  ]) {
    if (clientBody[key] !== undefined) passthrough[key] = clientBody[key];
  }
  return passthrough;
}
