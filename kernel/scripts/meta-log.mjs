#!/usr/bin/env node
/**
 * Meta execution log — source of truth for agents (not humans-first narrative).
 * Usage:
 *   node scripts/meta-log.mjs start --ask "…"
 *   node scripts/meta-log.mjs append --run <id> --actor <role> --action <verb> --detail "…"
 *   node scripts/meta-log.mjs event --run <id> --type spawn --payload '{"seat":"…"}'
 *   node scripts/meta-log.mjs close --run <id>
 *   node scripts/meta-log.mjs list
 */
import { mkdirSync, appendFileSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runsDir = join(root, ".agents", "meta", "runs");

function args() {
  const a = process.argv.slice(2);
  const cmd = a[0] || "help";
  const out = { cmd, flags: {} };
  for (let i = 1; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const k = a[i].slice(2);
      const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : "true";
      out.flags[k] = v;
    }
  }
  return out;
}

function ensureRun(id) {
  const dir = join(runsDir, id);
  mkdirSync(dir, { recursive: true });
  const jsonl = join(dir, "meta.jsonl");
  if (!existsSync(jsonl)) writeFileSync(jsonl, "", "utf8");
  return dir;
}

function append(id, record) {
  const dir = ensureRun(id);
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n";
  appendFileSync(join(dir, "meta.jsonl"), line, "utf8");
  const tl = join(dir, "timeline.md");
  const bullet = `- \`${record.ts || new Date().toISOString()}\` **${record.actor || record.type || "event"}**: ${record.action || ""} ${record.detail || record.type || ""}\n`;
  if (!existsSync(tl)) writeFileSync(tl, `# Timeline — ${id}\n\n`, "utf8");
  appendFileSync(tl, bullet, "utf8");
  return dir;
}

function start(ask) {
  const id = `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
  ensureRun(id);
  writeFileSync(
    join(runsDir, id, "run.json"),
    JSON.stringify(
      {
        id,
        ask: ask || "",
        startedAt: new Date().toISOString(),
        status: "active",
        objectiveRunner: "letscook",
        jitBoard: true,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  append(id, { type: "start", actor: "orchestrator", action: "start", detail: ask || "" });
  // Latest pointer for board UI
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, "LATEST"), id, "utf8");
  console.log(id);
  return id;
}

function close(id) {
  const dir = ensureRun(id);
  const runPath = join(dir, "run.json");
  let run = {};
  if (existsSync(runPath)) run = JSON.parse(readFileSync(runPath, "utf8"));
  run.status = "closed";
  run.closedAt = new Date().toISOString();
  writeFileSync(runPath, JSON.stringify(run, null, 2) + "\n", "utf8");
  append(id, { type: "close", actor: "logging-meta", action: "close", detail: "run closed" });
  const lines = existsSync(join(dir, "meta.jsonl"))
    ? readFileSync(join(dir, "meta.jsonl"), "utf8").trim().split("\n").filter(Boolean)
    : [];
  writeFileSync(
    join(dir, "META-SUMMARY.md"),
    `# Meta summary — ${id}\n\n- Events: ${lines.length}\n- Ask: ${run.ask || ""}\n- Started: ${run.startedAt}\n- Closed: ${run.closedAt}\n\nRead \`meta.jsonl\` for precise facts.\n`,
    "utf8",
  );
  console.log(`closed ${id} events=${lines.length}`);
}

function list() {
  mkdirSync(runsDir, { recursive: true });
  const ids = readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const id of ids) {
    const rp = join(runsDir, id, "run.json");
    if (existsSync(rp)) {
      const r = JSON.parse(readFileSync(rp, "utf8"));
      console.log(`${id}\t${r.status}\t${(r.ask || "").slice(0, 60)}`);
    } else console.log(id);
  }
}

const { cmd, flags } = args();
switch (cmd) {
  case "start":
    start(flags.ask);
    break;
  case "append":
    if (!flags.run) {
      console.error("need --run");
      process.exit(2);
    }
    append(flags.run, {
      type: "append",
      actor: flags.actor || "unknown",
      action: flags.action || "note",
      detail: flags.detail || "",
    });
    console.log("ok");
    break;
  case "event":
    if (!flags.run) {
      console.error("need --run");
      process.exit(2);
    }
    append(flags.run, {
      type: flags.type || "event",
      actor: flags.actor || "orchestrator",
      action: flags.action || flags.type || "event",
      detail: flags.detail || flags.payload || "",
      payload: flags.payload ? safeJson(flags.payload) : undefined,
    });
    console.log("ok");
    break;
  case "close":
    if (!flags.run) {
      console.error("need --run");
      process.exit(2);
    }
    close(flags.run);
    break;
  case "list":
    list();
    break;
  default:
    console.log(`meta-log.mjs start|append|event|close|list`);
    process.exit(cmd === "help" ? 0 : 1);
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
