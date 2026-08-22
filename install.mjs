#!/usr/bin/env node
/**
 * Prompt OS installer — copies kernel to ~/.agents, wires IDEs/CLIs, replaces prior POS.
 *
 * Usage:
 *   node install.mjs [--force] [--with-hub] [--dry-run]
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { wireAll } from "./adapters/index.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const force = argv.includes("--force");
const withHub = argv.includes("--with-hub");
const dryRun = argv.includes("--dry-run");

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
    version: "2.0.0",
    installedAt: new Date().toISOString(),
    posRoot,
    router: join(routerDir, "PROMPT-ROUTER.md"),
    platform: platform(),
    wired,
    withHub,
  };
  writeFileSync(installManifest, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function ensureDirs() {
  for (const d of [
    join(posRoot, "contracts", "active"),
    join(posRoot, "contracts", "completed"),
    join(posRoot, "evolve"),
    join(posRoot, "audit"),
    join(posRoot, "benchmarks"),
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
  log("Prompt OS installer v2.0.0");
  log(`Target: ${posRoot}`);

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

  const wired = await wireAll({ home, posRoot, routerPath: join(routerDir, "PROMPT-ROUTER.md") });
  writeManifest(wired);

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
