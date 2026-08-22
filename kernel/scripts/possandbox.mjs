#!/usr/bin/env node
/**
 * POS Sandbox — prompt validator with step trace, variance, reward preview, gist export.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectEnvironment } from "./detect-environment.mjs";
import { loadRegistry, saveRegistry, setVariable, inferFromPrompt, varianceBranches } from "./variables.mjs";
import { computeReward } from "./reward.mjs";
import { osRoot, routerPath, tracesDir } from "../lib/paths.mjs";

function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 48)
      .replace(/-+$/, "") || "prompt"
  );
}

export function classifyPrompt(prompt) {
  const p = prompt.toLowerCase();
  if (prompt.length < 80 && !/\b(build|create|deploy|research|analyze|design)\b/.test(p)) {
    return { classification: "trivial", confidence: 0.7, reason: "Short Q&A or lookup shape" };
  }
  const programSignals =
    /\b(\d+\s*[-–]?\s*\d+\s*hours?|100s?\s+of\s+agents|incremental|bit by bit|steady|slowly)\b/.test(p) ||
    (prompt.length > 400 && /\b(research|prototype|competitor|flow|cohort)\b/.test(p));
  if (programSignals) {
    return {
      classification: "program",
      confidence: 0.85,
      reason: "Multi-hour / multi-agent / incremental delivery (NoOneBigShotOutcome)",
    };
  }
  return { classification: "non_trivial", confidence: 0.8, reason: "New capability or unknowns" };
}

export function suggestSlices(prompt, classification) {
  if (classification !== "program") return [];
  const p = prompt.toLowerCase();
  const slices = [];
  if (/research|competitor|market|learn/.test(p)) {
    slices.push({ id: "01-research", job: "Sourced research corpus", deliverable: "research/report.md" });
  }
  if (/flow|hook|browse|ux|customer/.test(p)) {
    slices.push({ id: "02-flows", job: "Customer flow + hook hypothesis", deliverable: "docs/flows.md" });
  }
  if (/50,?000|names|data/.test(p)) {
    slices.push({ id: "03-data", job: "Name dataset", deliverable: "data/names/" });
  }
  if (/site|app|build|prototype/.test(p)) {
    slices.push({ id: "04-mvp", job: "Browse MVP", deliverable: "deployed URL" });
  }
  if (/stock|chart|100x|ticker|invest/.test(p)) {
    return [
      { id: "01-comparables", job: "Historical comparables with sources", deliverable: "research/comparables.md" },
      { id: "02-factor-rubric", job: "MECE factor rubric", deliverable: "research/factor-rubric.md" },
      { id: "03-backtest", job: "Reproducible backtest", deliverable: "backtest/" },
      { id: "04-chart", job: "Scenario chart + disclaimer", deliverable: "docs/chart-spec.md" },
    ];
  }
  if (!slices.length) {
    slices.push(
      { id: "01-spec", job: "Outcome contract", deliverable: "docs/outcome-contract.md" },
      { id: "02-poc", job: "Kill experiment", deliverable: "poc/" },
      { id: "03-build", job: "First usable increment", deliverable: "demo/" },
    );
  }
  while (slices.length < 3) {
    slices.push({ id: `0${slices.length + 1}-increment`, job: "Additional increment", deliverable: "docs/slice.md" });
  }
  return slices;
}

function buildSteps({ classification, env, registry, slices, variance, prompt }) {
  const steps = [];
  steps.push({
    step: "0",
    name: "Load the law",
    action: `Read router + constitution`,
    reasoning: "Kernel law overrides tool defaults",
    guardrails: ["PROMPT-ROUTER single source"],
  });
  steps.push({
    step: "1",
    name: "Classify",
    action: classification.classification,
    reasoning: classification.reason,
    guardrails: ["When unsure → non_trivial"],
    output: classification,
  });
  if (classification.classification === "trivial") {
    steps.push({ step: "1b", name: "Fast path", action: "Direct answer", reasoning: "No contract", guardrails: [] });
    return steps;
  }
  steps.push({
    step: "2",
    name: "Intake + variables",
    action: "Schema + env bind",
    reasoning: `tier=${env.computeTier} ram=${env.hardware.ramGb}GB ollama=${env.ollama.available}`,
    guardrails: ["Falsifiable metric"],
    variables: registry.variables.filter((v) => v.value != null),
  });
  if (classification.classification === "program") {
    steps.push({
      step: "2b",
      name: "NoOneBigShotOutcome",
      action: `${slices.length} slices`,
      reasoning: "Human-usable increments",
      guardrails: ["Slice-level proven"],
      slices,
    });
  }
  steps.push({ step: "2.5", name: "Bar-raiser", action: "Baseline+PoC+A/B", reasoning: "Kill risky ideas early", guardrails: ["Pre-registered kills"] });
  steps.push({
    step: "3",
    name: "Recruit",
    action: "R/E/B/Eval",
    reasoning: `Workers ~${Math.min(8, Math.floor(env.hardware.cpuCores / 2))}`,
    guardrails: ["Builder ≠ Evaluator"],
  });
  steps.push({ step: "4", name: "Artifacts", action: "Mandatory by task type", reasoning: "Block generic output", guardrails: ["Design tokens for UI"] });
  steps.push({ step: "5", name: "Verify L1-L5", action: "evidence-check + panel", reasoning: "No self-grade", guardrails: ["exit 0 required"] });
  steps.push({ step: "5b", name: "VPR oracles", action: "Turn-level F(s,a)", reasoning: "Dense process credit", guardrails: ["oracles.jsonl"] });
  steps.push({ step: "6", name: "Reward G", action: "adoptability+thoroughness", reasoning: "Optimize real-world adoption", guardrails: ["evolve log"] });
  if (variance.length) {
    steps.push({ step: "V", name: "Variance", action: "Conditional routes", reasoning: "Mutable variables change path", guardrails: [], branches: variance });
  }
  if (/100x|penny stock/i.test(prompt)) {
    steps.push({
      step: "K",
      name: "Kill-criteria guard",
      action: "Reframe as research pack not prediction",
      reasoning: "100X stock pick is not falsifiable short-term",
      guardrails: ["Disclaimer slice required"],
    });
  }
  return steps;
}

export function renderMarkdown(trace) {
  const L = [];
  L.push("# POS Sandbox Trace", "", `- **ID:** ${trace.id}`, `- **At:** ${trace.at}`, "");
  L.push("## Prompt", "", "```", trace.prompt, "```", "");
  L.push("## Environment", "", "```json", JSON.stringify(trace.environment, null, 2), "```", "");
  L.push(`## Classification: \`${trace.classification.classification}\` (${trace.classification.reason})`, "");
  L.push("## Variables", "", "| id | value | affects |", "|----|-------|---------|");
  for (const v of trace.variables.filter((x) => x.value != null)) {
    L.push(`| ${v.id} | ${JSON.stringify(v.value)} | ${(v.affects || []).join("; ")} |`);
  }
  L.push("", "## Reward preview", "", `- G=${trace.rewardPreview.G.toFixed(3)} — ${trace.rewardPreview.interpretation}`, "");
  if (trace.slices.length) {
    L.push("## Slices", "");
    for (const s of trace.slices) L.push(`- **${s.id}:** ${s.job} → \`${s.deliverable}\``);
    L.push("");
  }
  L.push("## Trace", "");
  for (const s of trace.steps) {
    L.push(`### Step ${s.step} — ${s.name}`, "", `**Action:** ${s.action}`, "", `**Reasoning:** ${s.reasoning}`, "", `**Guardrails:** ${(s.guardrails || []).join("; ")}`, "");
    if (s.branches) for (const b of s.branches) L.push(`- IF ${b.if} → ${b.then}`);
    if (s.slices) for (const sl of s.slices) L.push(`- slice ${sl.id}: ${sl.deliverable}`);
    L.push("");
  }
  L.push("---", "Generated by possandbox.mjs");
  return L.join("\n");
}

function createGist(markdown, description) {
  const tmp = join(tracesDir(), `gist-${Date.now()}.md`);
  mkdirSync(tracesDir(), { recursive: true });
  writeFileSync(tmp, markdown, "utf8");
  try {
    return execSync(`gh gist create "${tmp}" --desc "${description.replace(/"/g, "'")}"`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function runSandbox(prompt, opts = {}) {
  const env = await detectEnvironment();
  let registry = loadRegistry();
  const inferred = inferFromPrompt(prompt);
  const classification = classifyPrompt(prompt);

  setVariable(registry, "classification", classification.classification, "possandbox");
  setVariable(registry, "compute_tier", env.computeTier, "environment");
  setVariable(registry, "hardware.ram_gb", env.hardware.ramGb, "environment");
  setVariable(registry, "hardware.gpu", env.hardware.gpu.available, "environment");
  setVariable(registry, "model_primary", env.ollama.models[0]?.name || "frontier", "environment");
  if (inferred.time_budget_hours) setVariable(registry, "time_budget_hours", inferred.time_budget_hours, "prompt");
  if (inferred.agent_parallelism) setVariable(registry, "agent_parallelism", inferred.agent_parallelism, "prompt");
  if (classification.classification === "program") setVariable(registry, "program_required", true, "possandbox");
  const slices = suggestSlices(prompt, classification.classification);
  setVariable(registry, "slice_count", slices.length, "possandbox");
  saveRegistry(registry);

  const variance = varianceBranches(registry);
  const rewardPreview = computeReward({
    humanVerifySteps: slices.length * 2,
    barRaiser: classification.classification !== "trivial",
    metricAligned: !/billion users/i.test(prompt) || classification.classification === "program",
  });

  const id = slugify(prompt.slice(0, 40)) + "-" + Date.now().toString(36);
  const trace = {
    id,
    at: new Date().toISOString(),
    prompt,
    environment: env,
    classification,
    variables: registry.variables,
    variance,
    slices,
    steps: buildSteps({ classification, env, registry, slices, variance, prompt }),
    rewardPreview,
  };

  const markdown = renderMarkdown(trace);
  mkdirSync(tracesDir(), { recursive: true });
  const tracePath = join(tracesDir(), `${id}.md`);
  writeFileSync(tracePath, markdown, "utf8");
  writeFileSync(join(tracesDir(), `${id}.json`), JSON.stringify(trace, null, 2) + "\n", "utf8");

  const gistUrl = opts.gist ? createGist(markdown, `POS Sandbox: ${prompt.slice(0, 72)}`) : null;
  return { trace, markdown, tracePath, gistUrl };
}

async function main() {
  const argv = process.argv.slice(2);
  const gist = argv.includes("--gist");
  const jsonOut = argv.includes("--json");
  const fi = argv.indexOf("--file");
  const prompt = fi >= 0 ? readFileSync(argv[fi + 1], "utf8") : argv.filter((a) => !a.startsWith("-")).join(" ").trim();
  if (!prompt) {
    process.stderr.write('usage: possandbox.mjs "<prompt>" [--gist] [--json]\n');
    process.exit(1);
  }
  const r = await runSandbox(prompt, { gist });
  if (jsonOut) process.stdout.write(JSON.stringify({ ...r.trace, gistUrl: r.gistUrl, tracePath: r.tracePath }, null, 2) + "\n");
  else {
    process.stdout.write(r.markdown + "\n");
    if (r.gistUrl) process.stdout.write("\nGist: " + r.gistUrl + "\n");
    process.stdout.write("\nTrace: " + r.tracePath + "\n");
  }
}

if (process.argv[1]?.includes("possandbox.mjs")) main();
