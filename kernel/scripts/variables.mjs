#!/usr/bin/env node
/**
 * Variable awareness — registry of values that can change and affect routing.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { osRoot } from "../lib/paths.mjs";

/** @typedef {{ id: string, value: unknown, type: string, source: string, mutable: boolean, affects: string[] }} Variable */

const DEFAULTS = [
  { id: "classification", value: null, type: "enum:trivial|non_trivial|program", source: "intake", mutable: true, affects: ["router_step", "contract_required"] },
  { id: "compute_tier", value: null, type: "enum:frontier-primary|local-capable|local-light|unknown", source: "environment", mutable: true, affects: ["model_routing", "parallelism"] },
  { id: "model_primary", value: null, type: "string", source: "environment", mutable: true, affects: ["eval_quality", "cost"] },
  { id: "hardware.ram_gb", value: null, type: "number", source: "environment", mutable: true, affects: ["local_model_choice", "parallel_agents"] },
  { id: "hardware.gpu", value: null, type: "boolean", source: "environment", mutable: true, affects: ["local_inference"] },
  { id: "time_budget_hours", value: null, type: "number", source: "prompt|human", mutable: true, affects: ["program_required", "slice_count"] },
  { id: "budget_usd", value: null, type: "number", source: "human", mutable: true, affects: ["compute_tier", "agent_count"] },
  { id: "north_star.target", value: null, type: "number", source: "contract", mutable: true, affects: ["kill_criteria", "reward"] },
  { id: "slice_count", value: null, type: "number", source: "program", mutable: true, affects: ["no_one_big_shot", "reward"] },
  { id: "user_gate_required", value: false, type: "boolean", source: "intake", mutable: true, affects: ["autonomy_pause"] },
  { id: "agent_parallelism", value: null, type: "number", source: "environment|prompt", mutable: true, affects: ["orchestration"] },
  { id: "ralph_max_iterations", value: 12, type: "number", source: "constitution", mutable: false, affects: ["loop_cap"] },
  { id: "adoptability_weight", value: 0.5, type: "number", source: "reward_config", mutable: true, affects: ["reward"] },
  { id: "thoroughness_weight", value: 0.3, type: "number", source: "reward_config", mutable: true, affects: ["reward"] },
  { id: "oracle_weight", value: 0.2, type: "number", source: "reward_config", mutable: true, affects: ["reward"] },
];

export function variablesPath(root = osRoot()) {
  return join(root, "state", "variables.json");
}

export function loadRegistry(root = osRoot()) {
  const path = variablesPath(root);
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  return { updatedAt: null, variables: DEFAULTS.map((v) => ({ ...v })) };
}

export function saveRegistry(registry, root = osRoot()) {
  const dir = join(root, "state");
  mkdirSync(dir, { recursive: true });
  registry.updatedAt = new Date().toISOString();
  writeFileSync(variablesPath(root), JSON.stringify(registry, null, 2) + "\n", "utf8");
}

export function setVariable(registry, id, value, source = "runtime") {
  let v = registry.variables.find((x) => x.id === id);
  if (!v) {
    v = { id, value, type: typeof value, source, mutable: true, affects: [] };
    registry.variables.push(v);
  } else {
    v.value = value;
    v.source = source;
  }
  return registry;
}

export function getVariable(registry, id) {
  return registry.variables.find((x) => x.id === id)?.value;
}

export function inferFromPrompt(prompt) {
  const p = String(prompt || "").toLowerCase();
  const vars = {};
  const hourMatch = p.match(/(\d+)\s*[-–]?\s*(\d+)?\s*(hours?|hrs?)/);
  if (hourMatch) {
    const hi = Number(hourMatch[2] || hourMatch[1]);
    vars.time_budget_hours = hi;
  }
  if (/\b100s?\s+of\s+agents|\bhundreds?\s+of\s+agents|\bmany\s+agents\b/.test(p)) {
    vars.agent_parallelism = 100;
  } else if (/\bparallel|swarm|multiple agents\b/.test(p)) {
    vars.agent_parallelism = 8;
  }
  if (/\bbrowse\s+\d[\d,]*\s+names|\b50,?000\b/.test(p)) vars.domain = "baby-names-scale";
  if (/\bstock|\b100x|\bpenny stock|\bticker\b/.test(p)) vars.domain = "finance-research";
  if (/\bincremental|\bbit by bit|\bsteady|\bslowly\b|\bno one big\b/.test(p)) {
    vars.program_required = true;
  }
  if (/\b1\s*billion|\b100x|\bipo\b/.test(p)) vars.ambition = "high";
  return vars;
}

export function varianceBranches(registry) {
  const branches = [];
  const tier = getVariable(registry, "compute_tier");
  if (tier === "local-light") {
    branches.push({ if: "compute_tier=local-light", then: "Cap parallel agents ≤4; prefer slice queue over swarm" });
  }
  if (tier === "frontier-primary") {
    branches.push({ if: "compute_tier=frontier-primary", then: "Contracts/eval on frontier; research sweeps on local if available" });
  }
  const hours = getVariable(registry, "time_budget_hours");
  if (hours && hours > 2) {
    branches.push({ if: `time_budget_hours=${hours}`, then: "Mandatory program decomposition (NoOneBigShotOutcome)" });
  }
  const par = getVariable(registry, "agent_parallelism");
  if (par && par > 10) {
    branches.push({ if: `agent_parallelism=${par}`, then: "Map to slice-parallel workers, not single context" });
  }
  return branches;
}

function main() {
  const cmd = process.argv[2];
  const reg = loadRegistry();
  if (cmd === "list") {
    process.stdout.write(JSON.stringify(reg, null, 2) + "\n");
    return;
  }
  if (cmd === "set" && process.argv[3]) {
    setVariable(reg, process.argv[3], JSON.parse(process.argv[4] || "null"));
    saveRegistry(reg);
    process.stdout.write("ok\n");
    return;
  }
  process.stdout.write("usage: variables.mjs list | set <id> <json-value>\n");
}

if (process.argv[1]?.includes("variables.mjs")) main();
