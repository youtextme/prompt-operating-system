#!/usr/bin/env node
/**
 * Layer 5 — Critique
 * Independent verifier. Inputs: artifact bytes + objective file only.
 * Output: machine-checked pass (exit 0) or fail (exit 2). Never a self-score.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findTheater, nowIso, writeJson, readJson, readText } from "./common.mjs";
import { scanClaims } from "./truth.mjs";
import { validateHypotheses } from "./hypothesis.mjs";
import { loadContext } from "./context.mjs";
import { validateNeed } from "./need.mjs";

export const LAYER = 5;
export const NAME = "critique";

/**
 * Boolean formula: no theater ∧ zero unsupported claims ∧ hypotheses logged ∧
 * context brief exists ∧ objective valid. Numeric quality cannot flip the boolean.
 */
export function critique({ artifactText, objective, runDir }) {
  const failures = [];
  const notes = [];

  const need = validateNeed(objective);
  if (!need.ok) failures.push(`need: ${need.reason}`);

  const theater = findTheater(artifactText || "");
  if (theater.length) {
    failures.push(`theater: ${theater.join("; ")}`);
  } else {
    notes.push("no theater patterns");
  }

  const truth = scanClaims(artifactText || "");
  if (!truth.ok) {
    failures.push(`truth: ${truth.reason}`);
  } else {
    notes.push(`truth: ${truth.claims.length} claims checked`);
  }

  if (runDir) {
    const ctx = loadContext(runDir);
    if (!ctx.ok) failures.push(`context: ${ctx.reason}`);
    else notes.push("context brief present");

    const hyp = validateHypotheses(runDir);
    if (!hyp.ok) failures.push(`hypothesis: ${hyp.reason}`);
    else notes.push(`hypotheses: ${hyp.phases} phase(s)`);

    // Process coverage when artifact declares steps
    if (/^##\s+Steps\b/m.test(artifactText || "") || /^\d+\.\s+\S+/m.test(artifactText || "")) {
      const stepLines = (artifactText.match(/^\d+\.\s+.+$/gm) || []).length;
      if (stepLines > 0 && !/observation|receipt|evidence|result/i.test(artifactText)) {
        failures.push("process: steps declared without coverage evidence");
      } else if (stepLines > 0) {
        notes.push(`process: ${stepLines} steps with coverage markers`);
      }
    }
  }

  // Soft quality score — reported but cannot flip boolean
  let quality = 100;
  quality -= theater.length * 25;
  quality -= (truth.unsupported?.length || 0) * 15;
  quality -= failures.length * 10;
  quality = Math.max(0, Math.min(100, quality));

  const ok = failures.length === 0;
  return {
    ok,
    code: ok ? 0 : 2,
    pass: ok,
    failures,
    notes,
    quality,
    reason: ok ? "critique pass" : failures.join(" | "),
  };
}

export function critiqueRun(runDir, opts = {}) {
  const objPath = join(runDir, "objective.json");
  if (!existsSync(objPath)) {
    return { ok: false, code: 2, reason: "objective.json missing" };
  }
  const objective = readJson(objPath);
  const artifactRel =
    opts.artifact ||
    objective.definition_of_done?.checks?.find((c) => c.predicate === "artifact_exists")?.path ||
    `artifacts/${objective.slug}.md`;
  const artifactPath = join(runDir, artifactRel);
  if (!existsSync(artifactPath)) {
    return { ok: false, code: 2, reason: `artifact missing: ${artifactRel}` };
  }
  const artifactText = readFileSync(artifactPath, "utf8");
  const result = critique({ artifactText, objective, runDir });
  const report = {
    layer: LAYER,
    run: objective.slug,
    artifact: artifactRel,
    graded_at: nowIso(),
    ...result,
  };
  writeJson(join(runDir, "critique-report.json"), report);
  return { ...result, report, artifactPath };
}

function main(argv) {
  const runDir = argv.find((a) => !a.startsWith("--"));
  const aIdx = argv.indexOf("--artifact");
  if (!runDir) {
    process.stderr.write("usage: critique.mjs <run-dir> [--artifact rel/path.md]\n");
    process.exit(1);
  }
  const result = critiqueRun(runDir, {
    artifact: aIdx >= 0 ? argv[aIdx + 1] : undefined,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.code);
}

const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("critique.mjs"));
if (isMain) main(process.argv.slice(2));
