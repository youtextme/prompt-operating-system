/**
 * Canonical serialization + digests.
 * Every signature and hash chain in POS is computed over canonicalJson so that
 * key order, whitespace, or re-serialization can never change a digest.
 */
import { createHash } from "node:crypto";

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

export function sha256(input) {
  return createHash("sha256").update(typeof input === "string" ? input : canonicalJson(input)).digest("hex");
}

export function shortHash(input, len = 12) {
  return sha256(input).slice(0, len);
}
