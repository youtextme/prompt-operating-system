/**
 * POS injection — prepend-only and spoof-resistant.
 *
 * Never removes or replaces existing system messages, tools, MCP definitions,
 * or skill content (see compat.mjs for the checked invariant).
 *
 * Idempotency used to be decided by a regex for the words "PROMPT OS", which any
 * client (or a model asked to write the request body) could satisfy to suppress
 * injection. Now the kernel only recognises its own preamble by an HMAC stamp it
 * signed itself, so a look-alike system message no longer disables the kernel.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "../lib/canon.mjs";
import { sign, verifySignature } from "../lib/keys.mjs";

const STAMP_RE = /POS-INJECT-SIG:\s*([a-f0-9]{64})/;

export function loadPosPreamble(routerPath, posRoot) {
  const hintPath = join(posRoot, "ollama", "POS-SYSTEM-PROMPT.txt");
  const base = existsSync(hintPath)
    ? readFileSync(hintPath, "utf8").trim()
    : [
        "[PROMPT OS — mandatory kernel]",
        `Read and obey: ${routerPath}`,
        existsSync(join(posRoot, "CONSTITUTION.md")) ? `Constitution: ${join(posRoot, "CONSTITUTION.md")}` : "",
        "Classify trivial vs non-trivial. Non-trivial → outcome contract before building.",
        "Every response you return starts with the POS first line the gateway attached; do not write it yourself.",
        "Claims of done/proven require signed receipts (pos receipt run) — text receipts are rejected.",
        "Preserve all existing tools, MCP servers, and skills — POS adds law only.",
      ]
        .filter(Boolean)
        .join("\n");
  return stampPreamble(base, posRoot);
}

export function stampPreamble(text, posRoot) {
  const body = text.replace(STAMP_RE, "").trimEnd();
  try {
    return `${body}\nPOS-INJECT-SIG: ${sign({ preamble: sha256(body) }, posRoot)}`;
  } catch {
    // Key custody unavailable (read-only or missing root): inject unstamped.
    // Unstamped means "not recognised next time", i.e. we re-inject — never skip.
    return body;
  }
}

/** True only for a preamble this kernel signed. */
export function hasVerifiedPosStamp(content, posRoot) {
  const text = String(content ?? "");
  const m = text.match(STAMP_RE);
  if (!m) return false;
  const body = text.replace(STAMP_RE, "").trimEnd();
  try {
    return verifySignature({ preamble: sha256(body) }, m[1], posRoot);
  } catch {
    return false;
  }
}

/** OpenAI-style messages[] — prepend POS system block unless a signed one exists. */
export function injectPosMessages(messages, { routerPath, posRoot }) {
  const list = Array.isArray(messages) ? [...messages] : [];
  const hasPos = list.some((m) => m.role === "system" && hasVerifiedPosStamp(m.content, posRoot));
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

  if (out.system && hasVerifiedPosStamp(out.system, posRoot)) {
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
    "mcp",
    "mcpServers",
    "stream",
    "temperature",
    "max_tokens",
    "top_p",
    "seed",
    "stop",
    "model",
    "user",
    "metadata",
  ]) {
    if (clientBody[key] !== undefined) passthrough[key] = clientBody[key];
  }
  return passthrough;
}
