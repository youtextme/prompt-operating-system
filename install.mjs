#!/usr/bin/env node
/**
 * Prompt OS installer — copies kernel to ~/.agents, wires IDEs/CLIs, replaces prior POS.
 *
 * Usage:
 *   node install.mjs [--force] [--with-hub] [--dry-run]
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { wireAll } from "./adapters/index.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const force = argv.includes("--force");
const withHub = argv.includes("--with-hub") || argv.includes("--enforce") || !argv.includes("--soft");
const withKit = argv.includes("--with-kit");
const enforce = !argv.includes("--soft");
const dryRun = argv.includes("--dry-run");
const repoFlagIdx = argv.indexOf("--repo");
const repoRoot =
  repoFlagIdx >= 0 && argv[repoFlagIdx + 1]
    ? resolve(argv[repoFlagIdx + 1])
    : __dir;

const home = homedir();
const agentsRoot = join(home, ".agents");
const posRoot = join(agentsRoot, "prompt-os");
const routerDir = join(agentsRoot, "router");
const legacyRoot = join(agentsRoot, "outcome-os");
const installManifest = join(posRoot, "INSTALL.json");

function log(msg) {
  process.stdout.write(msg + "\n");
}

function backupIfExists(path, backupRoot) {
  if (!existsSync(path)) return;
  const rel = path.replace(agentsRoot + (platform() === "win32" ? "\\" : "/"), "").replace(/\\/g, "/");
  const dest = join(backupRoot, rel);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(path, dest, { recursive: true, force: true });
  log(`  backed up ${rel}`);
}

function copyKernel() {
  const src = join(__dir, "kernel");
  mkdirSync(posRoot, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const to = join(posRoot, entry);
    cpSync(from, to, { recursive: true, force: true });
  }
  mkdirSync(routerDir, { recursive: true });
  cpSync(join(src, "router", "PROMPT-ROUTER.md"), join(routerDir, "PROMPT-ROUTER.md"), { force: true });
  cpSync(join(src, "router", "STATUS-LAW.md"), join(routerDir, "STATUS-LAW.md"), { force: true });
  if (existsSync(join(__dir, "adapters"))) {
    cpSync(join(__dir, "adapters"), join(posRoot, "adapters"), { recursive: true, force: true });
  }
  if (existsSync(join(__dir, "kernel", "enforce"))) {
    cpSync(join(__dir, "kernel", "enforce"), join(posRoot, "enforce"), { recursive: true, force: true });
  }
}

function migrateLegacy() {
  if (!existsSync(legacyRoot)) return;
  log("Migrating legacy outcome-os → prompt-os …");
  for (const sub of ["contracts", "evolve", "audit", "benchmarks"]) {
    const from = join(legacyRoot, sub);
    const to = join(posRoot, sub);
    if (existsSync(from)) {
      mkdirSync(to, { recursive: true });
      cpSync(from, to, { recursive: true, force: true });
    }
  }
  const legacyMarker = join(legacyRoot, "MIGRATED-TO-PROMPT-OS.txt");
  writeFileSync(
    legacyMarker,
    `Migrated to ${posRoot} on ${new Date().toISOString()}\n` +
      `Router: ${join(routerDir, "PROMPT-ROUTER.md")}\n`,
    "utf8",
  );
}

function writeManifest(wired) {
  const manifest = {
    version: "3.6.0",
    installedAt: new Date().toISOString(),
    posRoot,
    router: join(routerDir, "PROMPT-ROUTER.md"),
    platform: platform(),
    wired,
    withHub,
    enforce,
  };
  writeFileSync(installManifest, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function ensureDirs() {
  for (const d of [
    join(posRoot, "contracts", "active"),
    join(posRoot, "contracts", "completed"),
    join(posRoot, "programs"),
    join(posRoot, "traces"),
    join(posRoot, "state"),
    join(posRoot, "benchmarks"),
    join(posRoot, "evolve"),
    join(posRoot, "audit"),
    join(posRoot, "runs"),
    join(posRoot, "skills", "community"),
  ]) {
    mkdirSync(d, { recursive: true });
  }
  if (!existsSync(join(posRoot, "evolve", "log.md"))) {
    writeFileSync(join(posRoot, "evolve", "log.md"), "# Evolution log\n\n", "utf8");
  }
  if (!existsSync(join(posRoot, "evolve", "PROMOTIONS.md"))) {
    writeFileSync(join(posRoot, "evolve", "PROMOTIONS.md"), "# Promotion queue\n\n", "utf8");
  }
}

async function installHub() {
  const hubDest = join(posRoot, "hub");
  const hubSrc = join(__dir, "hub");
  if (!existsSync(hubSrc)) return;
  cpSync(hubSrc, hubDest, { recursive: true, force: true });
  log("Local LLM Hub installed (optional). Start: node ~/.agents/prompt-os/hub/server.mjs");
}

async function main() {
  log("Prompt OS installer v3.6.0 — seven-layer objective runner");
  log(`Target: ${posRoot}`);
  if (repoRoot !== __dir) log(`Repo wiring: ${repoRoot}`);

  if (existsSync(installManifest) && !force) {
    const prev = JSON.parse(readFileSync(installManifest, "utf8"));
    log(`Existing install from ${prev.installedAt}. Use --force to replace.`);
  }

  if (dryRun) {
    log("[dry-run] would install kernel and wire tools");
    return;
  }

  if (existsSync(posRoot) && force) {
    const backupRoot = join(agentsRoot, `.backup-${Date.now()}`);
    mkdirSync(backupRoot, { recursive: true });
    log(`Backing up to ${backupRoot}`);
    backupIfExists(posRoot, backupRoot);
    backupIfExists(join(routerDir, "PROMPT-ROUTER.md"), backupRoot);
  }

  copyKernel();
  migrateLegacy();
  ensureDirs();

  if (withHub) await installHub();

  if (withKit || argv.includes("--with-kit")) {
    const kitScript = join(__dir, "kit", "install-kit.mjs");
    if (existsSync(kitScript)) {
      spawnSync(process.execPath, [kitScript], { stdio: "inherit" });
    }
  }

  // Copy possandbox skill to Cursor if present
  const skillSrc = join(__dir, "skills", "possandbox");
  const skillDest = join(home, ".cursor", "skills", "possandbox");
  if (existsSync(skillSrc)) {
    mkdirSync(join(home, ".cursor", "skills"), { recursive: true });
    cpSync(skillSrc, skillDest, { recursive: true, force: true });
    log(`  skill: possandbox → ${skillDest}`);
  }

  const wired = await wireAll({
    home,
    posRoot,
    routerPath: join(routerDir, "PROMPT-ROUTER.md"),
    enforce,
    repoRoot,
  });
  writeManifest(wired);

  if (enforce) {
    const { setUserEnvVars, writeEnforceManifest } = await import("./kernel/scripts/enforce.mjs");
    const manifest = writeEnforceManifest("hard");
    setUserEnvVars(manifest);
    log("Hard enforce enabled (default). Use --soft to disable.");
  }

  log("");
  log("✓ Prompt OS installed");
  log(`  Kernel:  ${posRoot}`);
  log(`  Router:  ${join(routerDir, "PROMPT-ROUTER.md")}`);
  log(`  Doctor:  node ${join(__dir, "bin", "pos.mjs")} doctor`);
  log("");
  for (const w of wired) {
    log(`  ${w.tool}: ${w.status} — ${w.detail}`);
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});
