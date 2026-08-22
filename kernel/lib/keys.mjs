/**
 * Kernel key custody.
 *
 * The POS signing key is what makes receipts, attestations, and ledgers
 * unforgeable *by text generation*. An agent that can write markdown cannot
 * produce a valid signature; it must call the kernel, which records what
 * actually happened.
 *
 * Threat model (docs/THREAT-MODEL.md): a shell-capable agent running as the
 * same user can read the key file. Two mitigations ship here:
 *   1. POS_KEY_FILE lets an operator move the key to a path owned by another
 *      user (privilege separation) — the kernel only ever reads it.
 *   2. Signature validity is never the only check: tenet 7 re-executes recorded
 *      commands (`--reverify`), so a forged "exit:0" is caught by reality.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalJson } from "./canon.mjs";
import { osRoot } from "./paths.mjs";

export function keyPath(root = osRoot()) {
  return process.env.POS_KEY_FILE || join(root, "keys", "pos.key");
}

export function ensureKey(root = osRoot()) {
  const path = keyPath(root);
  if (existsSync(path)) return readFileSync(path, "utf8").trim();
  const key = randomBytes(32).toString("hex");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, key + "\n", { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort on platforms without POSIX modes */
  }
  return key;
}

export function sign(payload, root = osRoot()) {
  const key = ensureKey(root);
  return createHmac("sha256", key).update(canonicalJson(payload)).digest("hex");
}

export function verifySignature(payload, signature, root = osRoot()) {
  if (typeof signature !== "string" || signature.length !== 64) return false;
  const expected = sign(payload, root);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
