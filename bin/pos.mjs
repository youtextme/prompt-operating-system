#!/usr/bin/env node
/**
 * pos — Prompt OS CLI
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectTools, wireAll } from "../adapters/index.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, "..");
const home = homedir();
const posRoot = process.env.PROMPT_OS_ROOT || join(home, ".agents", "prompt-os");
const routerPath = join(home, ".agents", "router", "PROMPT-ROUTER.md");

function scriptPath(name) {
  const installed = join(posRoot, "scripts", name);
  if (existsSync(installed)) return installed;
  return join(repoRoot, "kernel", "scripts", name);
}

function runScript(name, args, inherit = true) {
  const script = scriptPath(name);
  if (!existsSync(script)) {
    process.stderr.write(`missing ${script}\n`);
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [script, ...args], {
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
    env: { ...process.env, PROMPT_OS_ROOT: posRoot },
  });
  if (!inherit && r.stdout) process.stdout.write(r.stdout);
  if (!inherit && r.stderr) process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}

async function sandbox(args) {
  const gist = args.includes("--gist");
  const rest = args.filter((a) => a !== "--gist" && a !== "--json");
  const prompt = rest.join(" ").trim();
  if (!prompt) {
    process.stderr.write('usage: pos sandbox "<prompt>" [--gist] [--json]\n');
    process.exit(1);
  }
  runScript("possandbox.mjs", [prompt, ...(gist ? ["--gist"] : []), ...(args.includes("--json") ? ["--json"] : [])]);
}

function doctor() {
  const lines = ["Prompt OS doctor v2.1", ""];
  const manifest = join(posRoot, "INSTALL.json");
  if (existsSync(manifest)) {
    lines.push(`Install: ${JSON.parse(readFileSync(manifest, "utf8")).installedAt}`);
  } else lines.push("Install: NOT FOUND");
  lines.push(`Kernel: ${posRoot}`);
  lines.push(`Router: ${routerPath}`);
  lines.push("");
  lines.push("Primitives:");
  for (const s of ["evidence-check.mjs", "possandbox.mjs", "reward.mjs", "variables.mjs", "detect-environment.mjs", "program.mjs", "process-oracle.mjs"]) {
    lines.push(`  ${existsSync(scriptPath(s)) ? "ok" : "MISSING"} ${s}`);
  }
  const layersDir = existsSync(join(posRoot, "layers", "index.mjs"))
    ? join(posRoot, "layers")
    : join(repoRoot, "kernel", "layers");
  lines.push("");
  lines.push("Seven layers:");
  for (const s of ["need.mjs", "context.mjs", "hypothesis.mjs", "truth.mjs", "critique.mjs", "retrieve.mjs", "autonomy.mjs"]) {
    lines.push(`  ${existsSync(join(layersDir, s)) ? "ok" : "MISSING"} ${s}`);
  }
  lines.push("");
  for (const t of detectTools(home)) {
    if (t.detected) lines.push(`  tool: ${t.id}`);
  }
  const test = spawnSync(process.execPath, [scriptPath("evidence-check.test.mjs")], { encoding: "utf8", env: { ...process.env, PROMPT_OS_ROOT: posRoot } });
  lines.push(test.stdout || "");
  const sb = spawnSync(process.execPath, [scriptPath("possandbox.test.mjs")], { encoding: "utf8", env: { ...process.env, PROMPT_OS_ROOT: posRoot } });
  lines.push(sb.stdout || "");
  const layersTest = join(layersDir, "layers.test.mjs");
  if (existsSync(layersTest)) {
    const lt = spawnSync(process.execPath, [layersTest], { encoding: "utf8", env: { ...process.env, PROMPT_OS_ROOT: posRoot } });
    lines.push(lt.stdout || "");
    if (lt.stderr) lines.push(lt.stderr);
    process.stdout.write(lines.join("\n") + "\n");
    process.exit(test.status === 0 && sb.status === 0 && lt.status === 0 ? 0 : 1);
  }
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(test.status === 0 && sb.status === 0 ? 0 : 1);
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "doctor":
    doctor();
    break;
  case "sandbox":
  case "possandbox":
    await sandbox(rest);
    break;
  case "env":
    runScript("detect-environment.mjs", rest, false);
    break;
  case "variables":
    runScript("variables.mjs", rest, false);
    break;
  case "reward":
    runScript("reward.mjs", rest, false);
    break;
  case "program":
    runScript("program.mjs", rest, false);
    break;
  case "oracle":
    runScript("process-oracle.mjs", rest, false);
    break;
  case "evidence-check":
    runScript("evidence-check.mjs", rest);
    break;
  case "watchdog":
    runScript("watchdog.mjs", rest);
    break;
  case "audit":
    runScript("audit.mjs", rest);
    break;
  case "enforce":
    runScript("enforce.mjs", rest);
    break;
  case "gateway":
    runScript("enforce.mjs", ["gateway", ...rest]);
    break;
  case "layers":
  case "layer": {
    const layersIdx = join(posRoot, "layers", "index.mjs");
    const layersRepo = join(repoRoot, "kernel", "layers", "index.mjs");
    const script = existsSync(layersIdx) ? layersIdx : layersRepo;
    const r = spawnSync(process.execPath, [script, ...rest], {
      stdio: "inherit",
      env: { ...process.env, PROMPT_OS_ROOT: posRoot },
    });
    process.exit(r.status ?? 1);
    break;
  }
  case "critique": {
    const script = existsSync(join(posRoot, "layers", "critique.mjs"))
      ? join(posRoot, "layers", "critique.mjs")
      : join(repoRoot, "kernel", "layers", "critique.mjs");
    const r = spawnSync(process.execPath, [script, ...rest], {
      stdio: "inherit",
      env: { ...process.env, PROMPT_OS_ROOT: posRoot },
    });
    process.exit(r.status ?? 1);
    break;
  }
  case "install":
    spawnSync(process.execPath, [join(repoRoot, "install.mjs"), ...rest], { stdio: "inherit" });
    break;
  case "wire":
    wireAll({ home, posRoot, routerPath }).then((w) => {
      for (const x of w) process.stdout.write(`${x.tool}: ${x.status}\n`);
    });
    break;
  default:
    process.stdout.write(`Prompt OS CLI

  pos sandbox "<prompt>" [--gist]     # /possandbox — trace + optional gist
  pos doctor                          # verify primitives
  pos layers                          # seven-layer objective runner
  pos layers run "<ask>"              # MAPE-K loop → checkable artifact
  pos critique <run-dir>              # Layer 5 independent pass/fail
  pos env                             # model + hardware detection
  pos variables list                  # mutable variable registry
  pos reward '<json>'                 # compute G reward
  pos program status <slug>           # slice progress
  pos evidence-check <file> [--done|--slice]
  pos enforce on|off|status|doctor [--strict]
  pos gateway                         # start mandatory gateway :8555
  pos install [--force] [--soft] [--with-kit]

`);
}
