#!/usr/bin/env node
/**
 * Layer 1 — Need
 * Compile a natural-language ask into a typed objective before any generation.
 * The objective must be parseable by a checker without invoking the model.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runRoot, slugify, nowIso, writeJson, readJson } from "./common.mjs";

export const LAYER = 1;
export const NAME = "need";

const DEFAULT_BOUNDARY = {
  max_phases: 6,
  max_retrievals: 8,
  wall_clock_minutes: 60,
  max_tokens: 200_000,
};

/**
 * @param {string} ask
 * @param {object} [opts]
 */
export function compileNeed(ask, opts = {}) {
  const job = String(ask || "").trim();
  if (job.length < 8) {
    return { ok: false, code: 2, reason: "ask too short (need ≥8 chars)" };
  }
  const slug = opts.slug || slugify(job);
  const success = opts.success?.length
    ? opts.success
    : [`Artifact satisfies the job: ${job.slice(0, 120)}`, "Independent critique exits 0"];
  const kill = opts.kill?.length
    ? opts.kill
    : [
        "Cheapest falsifying experiment shows the ask is unreachable",
        "Boundary exhausted with zero progress on success predicates",
      ];
  const boundary = { ...DEFAULT_BOUNDARY, ...(opts.boundary || {}) };
  const artifactRel = opts.artifact || `artifacts/${slug}.md`;
  const objective = {
    layer: LAYER,
    slug,
    job,
    success,
    kill,
    boundary,
    definition_of_done: {
      checks: [
        { id: "artifact", predicate: "artifact_exists", path: artifactRel },
        { id: "no_theater", predicate: "zero_theater" },
        { id: "sourced", predicate: "zero_unsupported_claims" },
        { id: "hypothesis", predicate: "hypothesis_logged" },
        { id: "context", predicate: "context_brief_exists" },
        { id: "gate", predicate: "evidence_check_done" },
      ],
    },
    created_at: nowIso(),
  };
  return { ok: true, code: 0, objective };
}

/** Predicates: file exists, ≥1 success, ≥1 kill, boolean DoD evaluable without model. */
export function validateNeed(objective) {
  if (!objective || typeof objective !== "object") {
    return { ok: false, code: 2, reason: "objective missing" };
  }
  if (!objective.job || String(objective.job).trim().length < 8) {
    return { ok: false, code: 2, reason: "job missing or too short" };
  }
  if (!Array.isArray(objective.success) || objective.success.length < 1) {
    return { ok: false, code: 2, reason: "need ≥1 measurable success statement" };
  }
  if (!Array.isArray(objective.kill) || objective.kill.length < 1) {
    return { ok: false, code: 2, reason: "need ≥1 kill statement" };
  }
  if (!objective.boundary || typeof objective.boundary !== "object") {
    return { ok: false, code: 2, reason: "boundary missing" };
  }
  const dod = objective.definition_of_done;
  if (!dod?.checks?.length) {
    return { ok: false, code: 2, reason: "definition_of_done.checks missing" };
  }
  for (const c of dod.checks) {
    if (!c.id || !c.predicate) {
      return { ok: false, code: 2, reason: "DoD check missing id/predicate" };
    }
  }
  return { ok: true, code: 0, reason: "need ok" };
}

export function writeNeed(ask, opts = {}) {
  const compiled = compileNeed(ask, opts);
  if (!compiled.ok) return compiled;
  const root = opts.root || runRoot(compiled.objective.slug);
  mkdirSync(root, { recursive: true });
  const path = join(root, "objective.json");
  writeJson(path, compiled.objective);
  // Human-readable twin
  const md = [
    `# Objective: ${compiled.objective.slug}`,
    "",
    `Status: active`,
    `Layer: 1 — Need`,
    `Created: ${compiled.objective.created_at}`,
    "",
    "## Job",
    "",
    compiled.objective.job,
    "",
    "## Success",
    "",
    ...compiled.objective.success.map((s, i) => `- S${i + 1}: ${s}`),
    "",
    "## Kill",
    "",
    ...compiled.objective.kill.map((k, i) => `- K${i + 1}: ${k}`),
    "",
    "## Boundary",
    "",
    `- max_phases: ${compiled.objective.boundary.max_phases}`,
    `- max_retrievals: ${compiled.objective.boundary.max_retrievals}`,
    `- wall_clock_minutes: ${compiled.objective.boundary.wall_clock_minutes}`,
    "",
    "## Definition of done (boolean, no model)",
    "",
    ...compiled.objective.definition_of_done.checks.map(
      (c) => `- [ ] ${c.id}: \`${c.predicate}\`${c.path ? ` @ ${c.path}` : ""}`,
    ),
    "",
  ].join("\n");
  writeFileSync(join(root, "objective.md"), md, "utf8");
  return { ...compiled, root, path };
}

export function loadNeed(root) {
  const path = join(root, "objective.json");
  if (!existsSync(path)) return { ok: false, code: 2, reason: "objective.json missing before workers" };
  const objective = readJson(path);
  const v = validateNeed(objective);
  return { ...v, objective, path };
}

function main(argv) {
  const ask = argv.filter((a) => !a.startsWith("--")).join(" ").trim();
  const slugFlag = argv.indexOf("--slug");
  const slug = slugFlag >= 0 ? argv[slugFlag + 1] : undefined;
  if (!ask) {
    process.stderr.write('usage: need.mjs "<natural language ask>" [--slug name]\n');
    process.exit(1);
  }
  const result = writeNeed(ask, { slug });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.code);
}

const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("need.mjs"));
if (isMain) main(process.argv.slice(2));
