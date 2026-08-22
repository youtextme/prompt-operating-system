/**
 * Prompt attestation — the hard requirement that every prompt goes through POS.
 *
 * Fail direction is split on purpose (gateway research: the failure mode *is*
 * the policy):
 *   - Prompt path: FAIL-OPEN, LOUD. A prompt is never blocked. If the kernel is
 *     unhealthy the attestation is recorded as `degraded` with a reason and the
 *     answer is prefixed with the degraded banner.
 *   - Claim path: FAIL-CLOSED. `evidence-check`/`tenet-check` refuse to certify
 *     any outcome whose prompt has no `routed` attestation (tenet 1).
 *
 * Therefore skipping POS never breaks the user's prompt; it only makes the work
 * uncertifiable, and says so in the first line.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { sha256, shortHash } from "../lib/canon.mjs";
import { appendLedger, findLedgerEntry, verifyEntry } from "../lib/ledger.mjs";
import { constitutionPath, osRoot } from "../lib/paths.mjs";

export const LEDGER = "attest";

export function kernelHealth(root = osRoot(), home = homedir()) {
  const router = process.env.POS_ROUTER_PATH || join(home, ".agents", "router", "PROMPT-ROUTER.md");
  const missing = [];
  if (!existsSync(router)) missing.push("PROMPT-ROUTER.md");
  if (!existsSync(constitutionPath(root))) missing.push("CONSTITUTION.md");
  return { ok: missing.length === 0, missing, router };
}

/**
 * Record that a prompt entered the kernel. Never throws.
 * @returns {{id:string,state:"routed"|"degraded",reason:string,promptHash:string,signature:string,banner:string}}
 */
export function attestPrompt({ prompt, surface = "unknown", client = "unknown", root = osRoot(), home = homedir(), classification = null } = {}) {
  const promptHash = sha256(String(prompt ?? ""));
  const health = kernelHealth(root, home);
  const state = health.ok ? "routed" : "degraded";
  const reason = health.ok ? "kernel-healthy" : `kernel-incomplete: ${health.missing.join(", ")}`;
  const id = `att_${shortHash({ promptHash, surface, at: Date.now() }, 16)}`;
  const body = {
    id,
    promptHash,
    promptChars: String(prompt ?? "").length,
    surface,
    client,
    classification,
    state,
    reason,
    router: health.router,
  };
  try {
    const entry = appendLedger(LEDGER, "prompt", body, root);
    return { ...body, signature: entry.sig, seq: entry.seq, ledger: "ok" };
  } catch (err) {
    // Ledger unavailable (read-only disk, missing root): still answer the prompt.
    return {
      ...body,
      state: "degraded",
      reason: `ledger-unavailable: ${String(err?.message || err)}`,
      signature: "",
      seq: null,
      ledger: "unavailable",
    };
  }
}

export function verifyAttestation(id, root = osRoot()) {
  if (!id || id === "none") return { ok: false, reason: "no attestation id", state: null, signature: "" };
  const entry = findLedgerEntry(LEDGER, (e) => e.body?.id === id, root);
  if (!entry) return { ok: false, reason: "attestation not in ledger", state: null, signature: "" };
  if (!verifyEntry(entry, root)) return { ok: false, reason: "attestation signature invalid", state: null, signature: "" };
  return { ok: true, reason: "verified", state: entry.body.state, signature: entry.sig, entry };
}

/** Was this exact prompt text routed? Used by tenet 1. */
export function attestationForPrompt(promptText, root = osRoot()) {
  const hash = sha256(String(promptText ?? ""));
  const entry = findLedgerEntry(LEDGER, (e) => e.body?.promptHash === hash && e.body?.state === "routed", root);
  return entry ? { ok: verifyEntry(entry, root), id: entry.body.id, entry } : { ok: false, id: null, entry: null };
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === "prompt") {
    const fileIdx = argv.indexOf("--file");
    const prompt = fileIdx >= 0 ? readFileSync(argv[fileIdx + 1], "utf8") : argv.slice(1).filter((a) => !a.startsWith("--")).join(" ");
    const surfaceIdx = argv.indexOf("--surface");
    const record = attestPrompt({ prompt, surface: surfaceIdx >= 0 ? argv[surfaceIdx + 1] : "cli" });
    process.stdout.write(JSON.stringify(record, null, 2) + "\n");
    return;
  }
  if (cmd === "verify") {
    const r = verifyAttestation(argv[1]);
    process.stdout.write(JSON.stringify(r.entry ? { ...r, entry: undefined } : r, null, 2) + "\n");
    process.exit(r.ok ? 0 : 1);
  }
  process.stdout.write("usage: attest.mjs prompt \"<text>\" [--surface s] | verify <id>\n");
}

if (process.argv[1]?.endsWith("attest.mjs")) main(process.argv.slice(2));
