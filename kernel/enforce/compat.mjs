/**
 * Backward compatibility, enforced by assertion instead of by promise.
 *
 * POS is prepend-only by construction, but "prepend-only" was previously a
 * comment. Here it is a checked invariant on two surfaces:
 *
 *   1. Wire surface (`guardOutbound`): every tool / function / MCP definition
 *      and every pre-existing system message the client sent must still be
 *      present, byte-identical, in what POS forwards upstream. If POS ever
 *      loses one, the ORIGINAL client payload is forwarded instead (fail-open
 *      to compatibility) and the violation is recorded.
 *
 *   2. Disk surface (`inventory` / `diffInventory`): skills, MCP configs, IDE
 *      rules and legacy outcome-os files present before an install must still
 *      exist with the same digest after it. Installs may only add.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { sha256 } from "../lib/canon.mjs";

const PASSTHROUGH_KEYS = [
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
];

function toolIdentity(tool) {
  return tool?.function?.name || tool?.name || tool?.type || sha256(tool);
}

export function snapshotPayload(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return {
    toolNames: (body.tools || []).map(toolIdentity),
    toolDigests: (body.tools || []).map((t) => sha256(t)),
    functionNames: (body.functions || []).map(toolIdentity),
    mcpDigest: body.mcpServers || body.mcp ? sha256(body.mcpServers || body.mcp) : null,
    systemDigests: messages.filter((m) => m.role === "system").map((m) => sha256(String(m.content ?? ""))),
    nonSystemDigests: messages.filter((m) => m.role !== "system").map((m) => sha256(String(m.content ?? ""))),
    passthrough: Object.fromEntries(PASSTHROUGH_KEYS.filter((k) => body[k] !== undefined).map((k) => [k, sha256(body[k])])),
  };
}

/** @returns {string[]} violations — empty means backward compatible. */
export function compatViolations(before, after) {
  const v = [];
  const b = snapshotPayload(before);
  const a = snapshotPayload(after);

  for (const name of b.toolNames) {
    if (!a.toolNames.includes(name)) v.push(`tool removed: ${name}`);
  }
  for (const digest of b.toolDigests) {
    if (!a.toolDigests.includes(digest)) v.push(`tool definition mutated: ${digest.slice(0, 12)}`);
  }
  for (const name of b.functionNames) {
    if (!a.functionNames.includes(name)) v.push(`function removed: ${name}`);
  }
  if (b.mcpDigest && b.mcpDigest !== a.mcpDigest) v.push("mcp server block mutated");
  for (const digest of b.systemDigests) {
    if (!a.systemDigests.includes(digest)) v.push(`existing system message dropped or edited: ${digest.slice(0, 12)}`);
  }
  for (const digest of b.nonSystemDigests) {
    if (!a.nonSystemDigests.includes(digest)) v.push(`conversation message dropped or edited: ${digest.slice(0, 12)}`);
  }
  for (const [key, digest] of Object.entries(b.passthrough)) {
    if (a.passthrough[key] !== digest) v.push(`client parameter changed: ${key}`);
  }
  return v;
}

/**
 * Forward `after` only if it preserves everything in `before`.
 * Compatibility outranks injection: a POS bug must degrade POS, never the user's tools.
 */
export function guardOutbound(before, after) {
  const violations = compatViolations(before, after);
  if (violations.length === 0) return { body: after, violations, preserved: true };
  return { body: before, violations, preserved: false };
}

const INVENTORY_TARGETS = [
  ".cursor/mcp.json",
  ".cursor/rules",
  ".cursor/skills",
  ".claude/CLAUDE.md",
  ".claude/mcp.json",
  ".claude/skills",
  ".codeium/windsurf/rules",
  ".config/opencode/opencode.jsonc",
  ".continue/config.json",
  ".openclaw/workspace/AGENTS.md",
  ".openhands/microagents",
  ".agents/outcome-os",
  ".agents/skills",
  ".mcp.json",
];

/**
 * Files POS itself authors during wiring. They are excluded from the
 * byte-identical rule because rewriting your own artifact is not a
 * compatibility break; everything the user owns still must not change.
 */
const POS_OWNED = [
  /(^|\/)00-prompt-os\.(mdc|md)$/,
  /(^|\/)PROMPT-OS\.md$/,
  /(^|\/)PROMPT-ROUTER\.md$/,
  /(^|\/)copilot-instructions\.md$/,
  /(^|\/)CLAUDE\.md$/,
  /(^|\/)WIRING\.json$/,
  /(^|\/)COMPAT\.json$/,
  /(^|\/)OLLAMA-POS\.md$/,
  /^\.agents\/prompt-os\//,
  /(^|\/)skills\/possandbox\//,
];

export function posOwned(rel) {
  return POS_OWNED.some((re) => re.test(rel));
}

function parseJsonish(text) {
  try {
    // tolerate .jsonc comments / trailing commas well enough for a subset check
    return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1").replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return undefined;
  }
}

function walk(path, out, home, limit = 4000) {
  if (out.size >= limit || !existsSync(path)) return;
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry), out, home, limit);
    return;
  }
  try {
    const text = readFileSync(path, "utf8");
    const rel = relative(home, path).split("\\").join("/");
    const isConfig = /\.jsonc?$/.test(path);
    out.set(rel, { digest: sha256(text), json: isConfig ? parseJsonish(text) : undefined });
  } catch {
    /* unreadable file: ignore, cannot be compared either way */
  }
}

/** Snapshot of everything an install must not disturb. */
export function inventory(home = homedir(), targets = INVENTORY_TARGETS) {
  const out = new Map();
  for (const t of targets) walk(join(home, t), out, home);
  return Object.fromEntries([...out.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Everything in `a` still present (and unchanged) inside `b`. */
export function deepSubset(a, b) {
  if (a === b) return true;
  if (a === null || typeof a !== "object") return a === b;
  if (b === null || typeof b !== "object") return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    return a.every((item) => b.some((candidate) => deepSubset(item, candidate)));
  }
  return Object.keys(a).every((k) => k in b && deepSubset(a[k], b[k]));
}

/**
 * Wiring is allowed to ADD to a JSON config (that is how POS registers the
 * gateway with Continue/OpenCode/Cursor), so config files are compared by
 * subset: every pre-existing key, MCP server and setting must still be there
 * with the same value. Non-config files (skills, rules, CLAUDE.md, legacy
 * outcome-os data) must be byte-identical.
 *
 * @returns {{ok:boolean, removed:string[], modified:string[], augmented:string[], added:string[]}}
 */
export function diffInventory(before = {}, after = {}) {
  const removed = Object.keys(before).filter((k) => !(k in after) && !posOwned(k));
  const modified = [];
  const augmented = [];
  for (const k of Object.keys(before)) {
    if (!(k in after)) continue;
    const b = before[k];
    const a = after[k];
    if (a.digest === b.digest || posOwned(k)) continue;
    if (b.json !== undefined && a.json !== undefined && deepSubset(b.json, a.json)) augmented.push(k);
    else modified.push(k);
  }
  const added = Object.keys(after).filter((k) => !(k in before));
  return { ok: removed.length === 0 && modified.length === 0, removed, modified, augmented, added };
}
