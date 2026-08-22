#!/usr/bin/env node
/**
 * Reward function — objective: real-world adoptability + thoroughness + oracles.
 * G = α·adoptability + β·thoroughness + γ·oracle + δ·history
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { osRoot } from "../lib/paths.mjs";
import { loadRegistry, getVariable } from "./variables.mjs";
import { parseContract, countCommandPairs, extractCommandEvidence, hasBarRaiserEvidence } from "./evidence-check.mjs";

const DEFAULT_WEIGHTS = { adoptability: 0.45, thoroughness: 0.35, oracle: 0.15, history: 0.05 };

export function loadWeights(root = osRoot()) {
  const path = join(root, "state", "reward-config.json");
  if (existsSync(path)) return { ...DEFAULT_WEIGHTS, ...JSON.parse(readFileSync(path, "utf8")) };
  return { ...DEFAULT_WEIGHTS };
}

/**
 * Score a slice or contract artifact for agent reward signal.
 * @param {object} input
 */
export function computeReward(input) {
  const {
    humanUsable = false,
    humanVerifySteps = 0,
    commandReceipts = 0,
    sourcesCited = 0,
    barRaiser = false,
    sliceProven = false,
    programProgress = 0,
    metricAligned = false,
    selfGrade = false,
    stallDetected = false,
  } = input;

  const weights = input.weights || DEFAULT_WEIGHTS;

  let adoptability = 0;
  if (humanUsable) adoptability += 0.4;
  if (humanVerifySteps >= 3) adoptability += 0.3;
  else if (humanVerifySteps >= 1) adoptability += 0.15;
  if (metricAligned) adoptability += 0.2;
  if (sliceProven) adoptability += 0.1;

  let thoroughness = 0;
  if (sourcesCited >= 10) thoroughness += 0.35;
  else if (sourcesCited >= 5) thoroughness += 0.25;
  else if (sourcesCited >= 1) thoroughness += 0.1;
  if (barRaiser) thoroughness += 0.35;
  if (programProgress > 0) thoroughness += Math.min(0.3, programProgress * 0.1);

  let oracle = 0;
  if (commandReceipts >= 2) oracle += 0.6;
  else if (commandReceipts >= 1) oracle += 0.3;
  if (input.lintPass) oracle += 0.2;
  if (input.schemaValid) oracle += 0.2;

  let history = sliceProven ? 0.5 : 0;
  if (input.auditEntries >= 3) history += 0.5;

  let penalty = 0;
  if (selfGrade) penalty += 0.5;
  if (stallDetected) penalty += 0.3;

  const G =
    weights.adoptability * adoptability +
    weights.thoroughness * thoroughness +
    weights.oracle * oracle +
    weights.history * history -
    penalty;

  return {
    G: Math.max(0, Math.min(1, G)),
    components: { adoptability, thoroughness, oracle, history, penalty },
    weights,
    interpretation:
      G >= 0.75
        ? "high-adoption-likely: human can use + verified"
        : G >= 0.5
          ? "promising: needs more oracle or human-verify"
          : G >= 0.25
            ? "weak: more research/slices required"
            : "reject: insufficient for real-world adoption",
  };
}

export function rewardFromSliceText(sliceText, evidenceText = "") {
  const humanUsable = /## Human-usable deliverable/i.test(sliceText) && !/TODO|TBD/i.test(sliceText);
  const verifySection = sliceText.match(/## Human verify([\s\S]*?)(?=\n## |\s*$)/i);
  const humanVerifySteps = verifySection
    ? (verifySection[1].match(/^\s*-\s+\[/gm) || []).length
    : 0;
  const ce = extractCommandEvidence(evidenceText || "");
  const { commands } = countCommandPairs(ce);
  const sourcesCited = (evidenceText.match(/https?:\/\//g) || []).length;
  return computeReward({
    humanUsable,
    humanVerifySteps,
    commandReceipts: commands,
    sourcesCited,
    barRaiser: hasBarRaiserEvidence(evidenceText),
    sliceProven: /^Status:\s*proven/im.test(sliceText),
    metricAligned: /North Star|Metric:/i.test(sliceText),
    selfGrade: /builder self-grade|i confirm it works/i.test(evidenceText) && !/evaluator/i.test(evidenceText),
  });
}

export function rewardFromContract(contractText, evidenceText = "") {
  const parsed = parseContract(contractText);
  const ce = extractCommandEvidence(evidenceText || "");
  const { commands } = countCommandPairs(ce);
  return computeReward({
    humanUsable: parsed.status === "proven" || parsed.status === "killed",
    humanVerifySteps: 2,
    commandReceipts: commands,
    barRaiser: hasBarRaiserEvidence(evidenceText),
    sliceProven: parsed.status === "proven",
    metricAligned: !parsed.hasPlaceholderMetric,
    selfGrade: !/evaluator/i.test(evidenceText) && evidenceText.length > 20,
  });
}

function main() {
  const raw = process.argv.slice(2).join(" ").trim();
  if (!raw) {
    process.stdout.write(JSON.stringify({ usage: "reward.mjs '<json input>'" }) + "\n");
    return;
  }
  const input = JSON.parse(raw);
  const reg = loadRegistry();
  input.weights = {
    adoptability: getVariable(reg, "adoptability_weight") ?? DEFAULT_WEIGHTS.adoptability,
    thoroughness: getVariable(reg, "thoroughness_weight") ?? DEFAULT_WEIGHTS.thoroughness,
    oracle: getVariable(reg, "oracle_weight") ?? DEFAULT_WEIGHTS.oracle,
    history: DEFAULT_WEIGHTS.history,
  };
  process.stdout.write(JSON.stringify(computeReward(input), null, 2) + "\n");
}

if (process.argv[1]?.includes("reward.mjs")) main();
