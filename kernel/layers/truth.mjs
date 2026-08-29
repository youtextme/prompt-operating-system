#!/usr/bin/env node
/**
 * Layer 4 — Truth-seeking
 * Every numeric claim, URL, or factual assertion must be traceable to a source
 * or explicitly labeled unverified. Unsupported claims fail closed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nowIso, writeJson } from "./common.mjs";

export const LAYER = 4;
export const NAME = "truth";

/** Numeric or URL claim finders. */
export const CLAIM_PATTERNS = [
  // URLs
  { kind: "url", re: /https?:\/\/[^\s)\]>"']+/gi },
  // Percents — no trailing \b after % ( % is non-word; \b would fail before space)
  { kind: "percent", re: /\b\d+(?:\.\d+)?%/g },
  // Large integers / decimals (skip years 19xx/20xx alone and lone small counts in lists)
  { kind: "number", re: /(?<![\w./-])(?:\$)?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d+\.\d+\b(?!%)/g },
];

/** Nearby source markers / unverified tags. */
export const SOURCE_PATTERNS = [
  /\[(?:source|cite|ref|unverified)[^\]]*\]/i,
  /\((?:source|cite|ref):\s*[^)]+\)/i,
  /https?:\/\/\S+/i,
  /\bunverified\b/i,
  /\baccording to\b/i,
  /\bvia\b/i,
  /\bcited?\b/i,
  /\barxiv\.org\b/i,
  /\bnature\.com\b/i,
  /\bdoi:\s*\S+/i,
];

const WINDOW = 280; // chars around claim

/**
 * Scan artifact text for unsupported claims.
 * @param {string} text
 */
export function scanClaims(text) {
  const body = String(text || "");
  const claims = [];
  const seen = new Set();

  for (const { kind, re } of CLAIM_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) {
      const value = m[0];
      const start = m.index;
      const key = `${kind}:${start}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // URLs are self-sourcing when they ARE the claim
      if (kind === "url") {
        claims.push({
          kind,
          value,
          start,
          supported: true,
          reason: "url is its own locator",
        });
        continue;
      }

      const left = Math.max(0, start - WINDOW);
      const right = Math.min(body.length, start + value.length + WINDOW);
      const neighborhood = body.slice(left, right);
      const hasSource = SOURCE_PATTERNS.some((p) => p.test(neighborhood));
      claims.push({
        kind,
        value,
        start,
        supported: hasSource,
        reason: hasSource ? "source/unverified marker nearby" : "no source or unverified tag nearby",
      });
    }
  }

  const unsupported = claims.filter((c) => !c.supported);
  return {
    ok: unsupported.length === 0,
    code: unsupported.length === 0 ? 0 : 2,
    claims,
    unsupported,
    reason:
      unsupported.length === 0
        ? "all claims sourced or tagged"
        : `${unsupported.length} unsupported claim(s)`,
  };
}

export function gradeTruth(artifactPathOrText, opts = {}) {
  let text = artifactPathOrText;
  let path = null;
  if (opts.isPath || (typeof artifactPathOrText === "string" && existsSync(artifactPathOrText) && !artifactPathOrText.includes("\n"))) {
    path = artifactPathOrText;
    text = readFileSync(path, "utf8");
  }
  const result = scanClaims(text);
  if (opts.runDir) {
    const out = join(opts.runDir, "truth-report.json");
    writeJson(out, { layer: LAYER, scanned_at: nowIso(), path, ...result });
    result.reportPath = out;
  }
  return result;
}

function main(argv) {
  const path = argv.find((a) => !a.startsWith("--"));
  const runIdx = argv.indexOf("--run");
  if (!path) {
    process.stderr.write("usage: truth.mjs <artifact.md> [--run <run-dir>]\n");
    process.exit(1);
  }
  const result = gradeTruth(path, {
    isPath: true,
    runDir: runIdx >= 0 ? argv[runIdx + 1] : undefined,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.code);
}

const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("truth.mjs"));
if (isMain) main(process.argv.slice(2));
