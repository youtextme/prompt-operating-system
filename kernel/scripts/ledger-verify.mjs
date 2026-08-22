#!/usr/bin/env node
/**
 * Verify the tamper-evidence of the audit chains (KeepItWarm).
 * Exit 0 when every chain is intact, 2 when any chain was edited, reordered,
 * truncated, or its head anchor forged.
 */
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readHead, verifyChain } from "../lib/ledger.mjs";
import { osRoot } from "../lib/paths.mjs";

export function verifyAll(root = osRoot()) {
  const dir = join(root, "ledger");
  const names = existsSync(dir)
    ? [...new Set(readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => f.replace(/\.jsonl$/, "")))]
    : [];
  const chains = names.map((name) => {
    const head = readHead(name, root);
    return { name, ...verifyChain(name, root), head: head ? { seq: head.seq, invalid: Boolean(head.invalid) } : null };
  });
  return { ok: chains.every((c) => c.ok), root, chains };
}

function main(argv) {
  const only = argv.find((a) => !a.startsWith("-"));
  const result = only
    ? { ok: verifyChain(only).ok, root: osRoot(), chains: [{ name: only, ...verifyChain(only) }] }
    : verifyAll();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
