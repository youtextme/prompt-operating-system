#!/usr/bin/env node
/**
 * Layer 6 — New information (bounded retrieval)
 * Search only when a gap is named. Every retrieval writes to disk with URL +
 * timestamp before it is used in generation. Budget enforced by the gateway.
 */
import { appendFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { nowIso, writeJson, readJson, ensureDir } from "./common.mjs";
import { isAuthorized } from "./context.mjs";

export const LAYER = 6;
export const NAME = "retrieve";

function retrievalCount(runDir) {
  const dir = join(runDir, "retrieval");
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      n += readdirSync(join(dir, ent.name)).filter((f) => f.endsWith(".json")).length;
    } else if (ent.name.endsWith(".json") && ent.name !== "ledger.json") {
      n += 1;
    }
  }
  return n;
}

export function budgetLeft(runDir) {
  const obj = readJson(join(runDir, "objective.json"));
  const max = obj.boundary?.max_retrievals ?? 8;
  const used = retrievalCount(runDir);
  return { max, used, left: Math.max(0, max - used) };
}

/**
 * @param {string} runDir
 * @param {{ gap: string, source: string, content?: string, url?: string, phase?: string }} req
 */
export function retrieve(runDir, req = {}) {
  if (!existsSync(join(runDir, "objective.json"))) {
    return { ok: false, code: 2, reason: "objective missing" };
  }
  if (!existsSync(join(runDir, "context-manifest.json"))) {
    return { ok: false, code: 2, reason: "context brief required before retrieval" };
  }

  const gap = String(req.gap || "").trim();
  const source = String(req.source || "").trim();
  if (gap.length < 4) return { ok: false, code: 2, reason: "gap must be named" };
  if (source.length < 2) return { ok: false, code: 2, reason: "source must be named" };

  if ((source.startsWith("/") || /^file:/i.test(source)) && !isAuthorized(runDir, source)) {
    return { ok: false, code: 2, reason: `source refused by tool gateway: ${source}` };
  }

  const bud = budgetLeft(runDir);
  if (bud.left <= 0) {
    return {
      ok: false,
      code: 2,
      reason: `retrieval budget exhausted (${bud.used}/${bud.max})`,
      budget: bud,
    };
  }

  const phase = req.phase || "P0";
  const dir = ensureDir(join(runDir, "retrieval", phase));
  const id = `R${String(bud.used + 1).padStart(3, "0")}`;
  const url = req.url || (source.startsWith("http") ? source : null);
  const record = {
    layer: LAYER,
    id,
    gap,
    source,
    url,
    phase,
    retrieved_at: nowIso(),
    content: req.content || req.body || `[placeholder retrieval for gap: ${gap} from ${source}]`,
  };

  const jsonPath = join(dir, `${id}.json`);
  const mdPath = join(dir, `${id}.md`);
  writeJson(jsonPath, record);
  writeFileSync(
    mdPath,
    [
      `# Retrieval ${id}`,
      "",
      `- Gap: ${gap}`,
      `- Source: ${source}`,
      `- URL: ${url || "(none)"}`,
      `- Timestamp: ${record.retrieved_at}`,
      `- Phase: ${phase}`,
      "",
      "## Content",
      "",
      record.content,
      "",
    ].join("\n"),
    "utf8",
  );

  ensureDir(join(runDir, "retrieval"));
  appendFileSync(
    join(runDir, "retrieval", "ledger.jsonl"),
    JSON.stringify({
      id,
      gap,
      source,
      url,
      path: jsonPath,
      retrieved_at: record.retrieved_at,
    }) + "\n",
    "utf8",
  );

  return {
    ok: true,
    code: 0,
    record,
    path: jsonPath,
    mdPath,
    budget: budgetLeft(runDir),
  };
}

function main(argv) {
  const runDir = argv.find((a) => !a.startsWith("--"));
  const gIdx = argv.indexOf("--gap");
  const sIdx = argv.indexOf("--source");
  const uIdx = argv.indexOf("--url");
  const pIdx = argv.indexOf("--phase");
  const cIdx = argv.indexOf("--content");
  if (!runDir || gIdx < 0 || sIdx < 0) {
    process.stderr.write(
      "usage: retrieve.mjs <run-dir> --gap G --source S [--url U] [--phase P1] [--content TEXT]\n",
    );
    process.exit(1);
  }
  const result = retrieve(runDir, {
    gap: argv[gIdx + 1],
    source: argv[sIdx + 1],
    url: uIdx >= 0 ? argv[uIdx + 1] : undefined,
    phase: pIdx >= 0 ? argv[pIdx + 1] : undefined,
    content: cIdx >= 0 ? argv[cIdx + 1] : undefined,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.code);
}

const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("retrieve.mjs"));
if (isMain) main(process.argv.slice(2));
