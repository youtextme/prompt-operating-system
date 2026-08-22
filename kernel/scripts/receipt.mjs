#!/usr/bin/env node
/**
 * Signed command receipts (FormulasAndBooleans, hard).
 *
 * Before: evidence was markdown — `$ npm test` / `exit: 0` — which a model can
 * type without running anything. A regex counting `exit:` lines rewards writing,
 * not doing.
 *
 * Now: only the kernel can mint a receipt, and it does so by actually spawning
 * the command. The receipt records the command, cwd, exit code, and digests of
 * stdout/stderr, then goes into the signed hash chain. Two extra properties make
 * forgery pointless:
 *   - `verifyReceipt` rejects any receipt whose signature the kernel didn't make.
 *   - `reverify` RE-EXECUTES the recorded command and compares the exit code, so
 *     even a receipt minted by a real run of a doctored command is caught when
 *     the claim is graded (hack-verifiable style re-execution).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../lib/canon.mjs";
import { appendLedger, findLedgerEntry, readLedger, verifyEntry } from "../lib/ledger.mjs";
import { osRoot } from "../lib/paths.mjs";

export const LEDGER = "receipts";
const MAX_CAPTURE = 200_000;

export function runReceipt({ command, cwd = process.cwd(), label = "", root = osRoot(), timeout = 600_000 }) {
  if (!command || typeof command !== "string") throw new Error("receipt requires a command string");
  const started = Date.now();
  const res = spawnSync(command, { cwd, shell: true, encoding: "utf8", timeout, maxBuffer: MAX_CAPTURE });
  const stdout = String(res.stdout ?? "");
  const stderr = String(res.stderr ?? "");
  const body = {
    kind: "command",
    label,
    command,
    cwd,
    exit: res.status === null ? -1 : res.status,
    signal: res.signal || null,
    durationMs: Date.now() - started,
    stdoutHash: sha256(stdout),
    stderrHash: sha256(stderr),
    stdoutTail: stdout.slice(-2000),
    stderrTail: stderr.slice(-2000),
  };
  const entry = appendLedger(LEDGER, "receipt", body, root);
  return { ...body, id: `rcpt_${entry.hash.slice(0, 16)}`, hash: entry.hash, seq: entry.seq, sig: entry.sig };
}

export function findReceipt(idOrHash, root = osRoot()) {
  const needle = String(idOrHash || "").replace(/^rcpt_/, "");
  if (!needle) return null;
  return findLedgerEntry(LEDGER, (e) => e.hash.startsWith(needle), root);
}

export function verifyReceipt(idOrHash, root = osRoot()) {
  const entry = findReceipt(idOrHash, root);
  if (!entry) return { ok: false, reason: "receipt not found in ledger" };
  if (!verifyEntry(entry, root)) return { ok: false, reason: "receipt signature/hash invalid (edited)" };
  return { ok: true, reason: "verified", receipt: entry.body, hash: entry.hash };
}

/** Re-execute a recorded command; a claim only stands if reality still agrees. */
export function reverify(idOrHash, root = osRoot()) {
  const v = verifyReceipt(idOrHash, root);
  if (!v.ok) return { ok: false, reason: v.reason, reexecuted: false };
  const { command, cwd, exit } = v.receipt;
  const res = spawnSync(command, { cwd, shell: true, encoding: "utf8", timeout: 600_000, maxBuffer: MAX_CAPTURE });
  const nowExit = res.status === null ? -1 : res.status;
  return {
    ok: nowExit === exit,
    reason: nowExit === exit ? "re-execution matches receipt" : `re-execution exit ${nowExit} != recorded ${exit}`,
    reexecuted: true,
    recordedExit: exit,
    actualExit: nowExit,
  };
}

export function listReceipts(root = osRoot()) {
  return readLedger(LEDGER, root)
    .filter((e) => !e.corrupt)
    .map((e) => ({ id: `rcpt_${e.hash.slice(0, 16)}`, ...e.body, verified: verifyEntry(e, root) }));
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === "run") {
    const labelIdx = argv.indexOf("--label");
    const command = argv.slice(1).filter((a, i) => !a.startsWith("--") && i + 1 !== labelIdx).join(" ").trim() ||
      (argv.includes("--file") ? readFileSync(argv[argv.indexOf("--file") + 1], "utf8").trim() : "");
    const r = runReceipt({ command, label: labelIdx >= 0 ? argv[labelIdx + 1] : "" });
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
    process.exit(r.exit === 0 ? 0 : 2);
  }
  if (cmd === "verify") {
    const r = verifyReceipt(argv[1]);
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
    process.exit(r.ok ? 0 : 2);
  }
  if (cmd === "reverify") {
    const r = reverify(argv[1]);
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
    process.exit(r.ok ? 0 : 2);
  }
  if (cmd === "list") {
    process.stdout.write(JSON.stringify(listReceipts(), null, 2) + "\n");
    return;
  }
  process.stdout.write("usage: receipt.mjs run \"<cmd>\" [--label x] | verify <id> | reverify <id> | list\n");
}

if (process.argv[1]?.endsWith("receipt.mjs")) main(process.argv.slice(2));
