#!/usr/bin/env node
/**
 * pos — Prompt OS CLI
 *   pos doctor          — verify install + tool wiring
 *   pos evidence-check  — proxy to kernel gate
 *   pos watchdog        — proxy to stall detector
 *   pos install         — re-run installer
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

function kernelScript(name, args) {
  const script = join(posRoot, "scripts", name);
  if (!existsSync(script)) {
    process.stderr.write(`missing ${script} — run install first\n`);
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    env: { ...process.env, PROMPT_OS_ROOT: posRoot },
  });
  process.exit(r.status ?? 1);
}

function doctor() {
  const lines = ["Prompt OS doctor", ""];
  const manifest = join(posRoot, "INSTALL.json");
  if (existsSync(manifest)) {
    const m = JSON.parse(readFileSync(manifest, "utf8"));
    lines.push(`Install: ${m.installedAt} (v${m.version})`);
  } else {
    lines.push("Install: NOT FOUND — run install.sh / install.ps1");
  }
  lines.push(`Kernel:  ${existsSync(posRoot) ? "ok" : "MISSING"} ${posRoot}`);
  lines.push(`Router:  ${existsSync(routerPath) ? "ok" : "MISSING"} ${routerPath}`);
  lines.push("");
  lines.push("Detected tools:");
  for (const t of detectTools(home)) {
    lines.push(`  ${t.id.padEnd(12)} ${t.detected ? "yes" : "no ".padEnd(3)} ${t.path || ""}`);
  }
  lines.push("");
  lines.push("Run kernel self-tests:");
  const test = spawnSync(process.execPath, [join(posRoot, "scripts", "evidence-check.test.mjs")], {
    encoding: "utf8",
    env: { ...process.env, PROMPT_OS_ROOT: posRoot },
  });
  lines.push(test.stdout || "");
  if (test.status !== 0) lines.push("evidence-check tests FAILED");
  const wd = spawnSync(process.execPath, [join(posRoot, "scripts", "watchdog.mjs"), "--self-test"], {
    encoding: "utf8",
  });
  lines.push(wd.stdout || "");
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(test.status === 0 && wd.status === 0 ? 0 : 1);
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "doctor":
    doctor();
    break;
  case "evidence-check":
    kernelScript("evidence-check.mjs", rest);
    break;
  case "watchdog":
    kernelScript("watchdog.mjs", rest);
    break;
  case "audit":
    kernelScript("audit.mjs", rest);
    break;
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

  pos doctor
  pos install [--force] [--with-hub]
  pos evidence-check <contract.md> [--done]
  pos watchdog --file <transcript>
  pos audit append --actor A --action X --detail Y
  pos wire

`);
}
