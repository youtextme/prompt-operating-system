#!/usr/bin/env node
/**
 * Layer 3 — Hypothesis
 * Each phase declares a falsifiable hypothesis, the cheapest observable test,
 * and the artifact that carries the observation. Refuted hypotheses are logged.
 */
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nowIso, writeJson, readJson, ensureDir } from "./common.mjs";

export const LAYER = 3;
export const NAME = "hypothesis";

/**
 * @param {string} runDir
 * @param {object} phase
 */
export function declarePhase(runDir, phase = {}) {
  if (!existsSync(join(runDir, "objective.json"))) {
    return { ok: false, code: 2, reason: "objective missing" };
  }
  const planPath = join(runDir, "phase-plan.json");
  const plan = existsSync(planPath)
    ? readJson(planPath)
    : { layer: LAYER, phases: [], created_at: nowIso() };

  const id = phase.id || `P${plan.phases.length + 1}`;
  const hypothesis = String(phase.hypothesis || "").trim();
  const test = String(phase.test || phase.cheapest_observable_test || "").trim();
  const observationArtifact =
    phase.observation_artifact || `phases/${id}/observation.json`;

  if (hypothesis.length < 8) {
    return { ok: false, code: 2, reason: "hypothesis too short" };
  }
  if (test.length < 8) {
    return { ok: false, code: 2, reason: "cheapest observable test required" };
  }

  const entry = {
    id,
    hypothesis,
    cheapest_observable_test: test,
    observation_artifact: observationArtifact,
    status: "open",
    declared_at: nowIso(),
  };
  const idx = plan.phases.findIndex((p) => p.id === id);
  if (idx >= 0) plan.phases[idx] = { ...plan.phases[idx], ...entry };
  else plan.phases.push(entry);
  plan.updated_at = nowIso();

  writeJson(planPath, plan);
  ensureDir(join(runDir, "phases", id));
  writeFileSync(
    join(runDir, "phases", id, "hypothesis.md"),
    [
      `# Phase ${id}`,
      "",
      "## Hypothesis",
      "",
      hypothesis,
      "",
      "## Cheapest observable test",
      "",
      test,
      "",
      "## Observation artifact",
      "",
      observationArtifact,
      "",
    ].join("\n"),
    "utf8",
  );

  return { ok: true, code: 0, phase: entry, planPath };
}

/**
 * Record observation for a phase. Always writes to disk whether held or refuted.
 */
export function recordObservation(runDir, phaseId, observation = {}) {
  const planPath = join(runDir, "phase-plan.json");
  if (!existsSync(planPath)) {
    return { ok: false, code: 2, reason: "phase-plan.json missing" };
  }
  const plan = readJson(planPath);
  const phase = plan.phases.find((p) => p.id === phaseId);
  if (!phase) return { ok: false, code: 2, reason: `phase ${phaseId} not found` };

  const held = observation.held === true;
  const record = {
    phase_id: phaseId,
    hypothesis: phase.hypothesis,
    held,
    refuted: !held,
    observation: observation.note || observation.observation || "",
    metrics: observation.metrics || {},
    recorded_at: nowIso(),
  };

  const outPath = join(runDir, phase.observation_artifact);
  ensureDir(join(outPath, ".."));
  writeJson(outPath, record);

  phase.status = held ? "held" : "refuted";
  phase.observation_recorded_at = record.recorded_at;
  phase.observation_path = outPath;
  plan.updated_at = nowIso();
  writeJson(planPath, plan);

  if (!held) {
    appendFileSync(join(runDir, "refuted-hypotheses.jsonl"), JSON.stringify(record) + "\n", "utf8");
  }

  return { ok: true, code: 0, phase, observation: record };
}

export function validateHypotheses(runDir) {
  const planPath = join(runDir, "phase-plan.json");
  if (!existsSync(planPath)) {
    return { ok: false, code: 2, reason: "no phase plan (need ≥1 falsifiable hypothesis)" };
  }
  const plan = readJson(planPath);
  if (!plan.phases?.length) {
    return { ok: false, code: 2, reason: "no phases declared" };
  }
  for (const p of plan.phases) {
    if (!p.hypothesis || !p.cheapest_observable_test || !p.observation_artifact) {
      return { ok: false, code: 2, reason: `phase ${p.id} incomplete` };
    }
    if (p.status !== "open") {
      const obs = join(runDir, p.observation_artifact);
      if (!existsSync(obs) && !(p.observation_path && existsSync(p.observation_path))) {
        return { ok: false, code: 2, reason: `phase ${p.id} ended without observation on disk` };
      }
    }
  }
  return { ok: true, code: 0, reason: "hypotheses ok", phases: plan.phases.length };
}

function main(argv) {
  const cmd = argv[0];
  const runDir = argv[1];
  if (!cmd || !runDir) {
    process.stderr.write(
      "usage: hypothesis.mjs declare <run-dir> --hypothesis H --test T [--id P1]\n" +
        "       hypothesis.mjs observe <run-dir> <phaseId> --held|--refuted [--note N]\n" +
        "       hypothesis.mjs validate <run-dir>\n",
    );
    process.exit(1);
  }
  if (cmd === "declare") {
    const hIdx = argv.indexOf("--hypothesis");
    const tIdx = argv.indexOf("--test");
    const idIdx = argv.indexOf("--id");
    const result = declarePhase(runDir, {
      hypothesis: hIdx >= 0 ? argv[hIdx + 1] : "",
      test: tIdx >= 0 ? argv[tIdx + 1] : "",
      id: idIdx >= 0 ? argv[idIdx + 1] : undefined,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(result.code);
  }
  if (cmd === "observe") {
    const phaseId = argv[2];
    const held = argv.includes("--held");
    const nIdx = argv.indexOf("--note");
    const result = recordObservation(runDir, phaseId, {
      held,
      note: nIdx >= 0 ? argv[nIdx + 1] : "",
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(result.code);
  }
  if (cmd === "validate") {
    const result = validateHypotheses(runDir);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(result.code);
  }
  process.stderr.write(`unknown command ${cmd}\n`);
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("hypothesis.mjs"));
if (isMain) main(process.argv.slice(2));
