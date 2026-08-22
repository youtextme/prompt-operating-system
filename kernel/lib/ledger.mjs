/**
 * Tamper-evident append-only ledgers (KeepItWarm, hard).
 *
 * Every entry carries seq, prev hash, its own hash over canonical JSON, and an
 * HMAC signature. Editing, deleting, or reordering history breaks the chain and
 * `verifyChain` reports the first broken sequence number. This is the standard
 * Merkle/hash-chain audit design (CloudTrail-style digest chaining).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, sha256 } from "./canon.mjs";
import { sign, verifySignature } from "./keys.mjs";
import { osRoot } from "./paths.mjs";

const GENESIS = "0".repeat(64);

export function ledgerPath(name, root = osRoot()) {
  return join(root, "ledger", `${name}.jsonl`);
}

/**
 * External head anchor.
 *
 * A hash chain alone cannot detect TRUNCATION: chopping entries off the end
 * leaves a perfectly valid shorter chain (this exact attack escaped the first
 * run of the adversarial suite). The signed head records the highest seq/hash
 * the kernel ever wrote, so a shortened ledger is detected by comparison.
 */
export function headPath(name, root = osRoot()) {
  return join(root, "ledger", `${name}.head.json`);
}

export function readHead(name, root = osRoot()) {
  const path = headPath(name, root);
  if (!existsSync(path)) return null;
  try {
    const head = JSON.parse(readFileSync(path, "utf8"));
    if (!verifySignature({ seq: head.seq, hash: head.hash }, head.sig, root)) {
      return { ...head, invalid: true };
    }
    return head;
  } catch {
    return { invalid: true, seq: -1, hash: null };
  }
}

function writeHead(name, seq, hash, root = osRoot()) {
  writeFileSync(
    headPath(name, root),
    canonicalJson({ seq, hash, sig: sign({ seq, hash }, root), ts: new Date().toISOString() }) + "\n",
    "utf8",
  );
}

export function readLedger(name, root = osRoot()) {
  const path = ledgerPath(name, root);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { corrupt: true, raw: line };
      }
    });
}

function entryHash({ seq, prev, ts, kind, body }) {
  return sha256({ seq, prev, ts, kind, body });
}

export function appendLedger(name, kind, body, root = osRoot()) {
  const entries = readLedger(name, root);
  const last = entries[entries.length - 1];
  const seq = entries.length;
  const prev = last?.hash || GENESIS;
  const ts = new Date().toISOString();
  const hash = entryHash({ seq, prev, ts, kind, body });
  const entry = { seq, prev, ts, kind, body, hash, sig: sign({ hash }, root) };
  mkdirSync(join(root, "ledger"), { recursive: true });
  appendFileSync(ledgerPath(name, root), canonicalJson(entry) + "\n", "utf8");
  writeHead(name, seq, hash, root);
  return entry;
}

export function verifyEntry(entry, root = osRoot()) {
  if (!entry || entry.corrupt) return false;
  const recomputed = entryHash(entry);
  if (recomputed !== entry.hash) return false;
  return verifySignature({ hash: entry.hash }, entry.sig, root);
}

export function verifyChain(name, root = osRoot()) {
  const entries = readLedger(name, root);
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    if (e.corrupt) return { ok: false, brokenAt: i, reason: "unparseable entry", count: entries.length };
    if (e.seq !== i) return { ok: false, brokenAt: i, reason: `seq mismatch (${e.seq})`, count: entries.length };
    if (e.prev !== prev) return { ok: false, brokenAt: i, reason: "prev hash mismatch (entry removed or reordered)", count: entries.length };
    if (!verifyEntry(e, root)) return { ok: false, brokenAt: i, reason: "entry hash/signature mismatch (edited)", count: entries.length };
    prev = e.hash;
  }
  // Truncation check against the external anchor.
  const head = readHead(name, root);
  if (head?.invalid) {
    return { ok: false, brokenAt: entries.length - 1, reason: "head anchor signature invalid (forged head)", count: entries.length };
  }
  if (head && (entries.length - 1 !== head.seq || prev !== head.hash)) {
    return {
      ok: false,
      brokenAt: Math.min(head.seq, entries.length),
      reason: `ledger truncated or rewritten: head says seq=${head.seq}, file ends at seq=${entries.length - 1}`,
      count: entries.length,
    };
  }
  return { ok: true, brokenAt: null, reason: "chain intact", count: entries.length };
}

export function findLedgerEntry(name, predicate, root = osRoot()) {
  return readLedger(name, root).find((e) => !e.corrupt && predicate(e)) || null;
}
