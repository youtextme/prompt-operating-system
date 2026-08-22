#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { osRoot } from "./evidence-check.mjs";

const dir = () => join(osRoot(), "audit");

function logFile() {
  mkdirSync(dir(), { recursive: true });
  const d = new Date();
  return join(dir(), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}.jsonl`);
}

export function record(actor, action, detail, ts = new Date().toISOString()) {
  const entry = JSON.stringify({ ts, actor: actor || "unknown", action: action || "", detail: detail || "" });
  appendFileSync(logFile(), entry + "\n");
  return entry;
}

export function tail(n = 5) {
  const f = logFile();
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").trim().split(/\r?\n/).filter(Boolean).slice(-n).map((l) => JSON.parse(l));
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === "append") {
    const get = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : ""; };
    process.stdout.write(record(get("--actor"), get("--action"), get("--detail")) + "\n");
    return;
  }
  if (cmd === "tail") {
    for (const e of tail(Number(argv[1]) || 5)) process.stdout.write(JSON.stringify(e) + "\n");
    return;
  }
  process.stderr.write("usage: audit.mjs append --actor A --action X --detail Y | tail [n]\n");
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
