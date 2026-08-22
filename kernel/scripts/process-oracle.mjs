#!/usr/bin/env node
/**
 * Turn-level process oracle (VPR F(s_t, a_t)).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { osRoot } from "../lib/paths.mjs";
import { record } from "./audit.mjs";

export const ORACLE_TYPES = {
  lint: { cmd: (paths) => ["npm", "run", "lint", "--", ...paths], fallback: null },
  typecheck: { cmd: () => ["npm", "run", "typecheck"], fallback: null },
  test: { cmd: () => ["npm", "test"], fallback: null },
  count: { cmd: (arg) => ["node", "-e", `console.log(${arg})`] },
};

export function runOracle(type, context = {}) {
  const started = Date.now();
  let exitCode = 0;
  let output = "";
  let pass = true;

  if (type === "lint" && existsSync("package.json")) {
    const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "lint"], {
      encoding: "utf8",
      shell: true,
    });
    exitCode = r.status ?? 1;
    output = (r.stdout || "") + (r.stderr || "");
    pass = exitCode === 0;
  } else if (type === "schema" && context.schemaPath && context.dataPath) {
    pass = existsSync(context.dataPath);
    exitCode = pass ? 0 : 1;
    output = pass ? "schema file exists" : "missing data file";
  } else if (type === "curl" && context.url) {
    try {
      const r = spawnSync("curl", ["-sf", context.url], { encoding: "utf8", shell: true });
      exitCode = r.status ?? 1;
      output = (r.stdout || "").slice(0, 500);
      pass = exitCode === 0;
    } catch {
      pass = false;
      exitCode = 1;
    }
  } else if (type === "file_exists" && context.path) {
    pass = existsSync(context.path);
    exitCode = pass ? 0 : 1;
    output = context.path;
  } else {
    output = `oracle ${type}: skipped (no context)`;
    pass = true;
    exitCode = 0;
  }

  const result = {
    type,
    pass,
    exitCode,
    durationMs: Date.now() - started,
    output: output.slice(0, 1000),
    credit: pass ? 1 : -1,
  };

  try {
    record("process-oracle", type, JSON.stringify({ pass, exitCode, context }));
  } catch {
    /* audit optional */
  }

  appendOracleLog(result);
  return result;
}

function oracleLogPath() {
  return join(osRoot(), "audit", "oracles.jsonl");
}

function appendOracleLog(result) {
  mkdirSync(join(osRoot(), "audit"), { recursive: true });
  appendFileSync(oracleLogPath(), JSON.stringify({ ts: new Date().toISOString(), ...result }) + "\n");
}

export function turnCredit(terminalOutcome, oracles = [], historyScore = 0, weights = { alpha: 0.4, beta: 0.4, gamma: 0.2 }) {
  const F = oracles.length ? oracles.reduce((s, o) => s + (o.credit || 0), 0) / oracles.length : 0;
  const G = weights.alpha * (terminalOutcome ? 1 : 0) + weights.beta * Math.max(0, F) + weights.gamma * historyScore;
  return { G, F, O: terminalOutcome ? 1 : 0, H: historyScore };
}

function main() {
  const type = process.argv[2];
  const ctx = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  const r = runOracle(type, ctx);
  process.stdout.write(JSON.stringify(r) + "\n");
  process.exit(r.pass ? 0 : 1);
}

if (process.argv[1]?.includes("process-oracle.mjs")) main();
