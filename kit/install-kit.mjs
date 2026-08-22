#!/usr/bin/env node
/** Install VibeSetup kit skills into ~/.agents/prompt-os/skills/community */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { osRoot } from "../kernel/lib/paths.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dir, "manifest.json"), "utf8"));
const dest = join(osRoot(), "skills", "community");

function installRepo(entry) {
  mkdirSync(dest, { recursive: true });
  const target = join(dest, entry.id);
  if (entry.npx) {
    process.stdout.write(`  ${entry.id}: use npx ${entry.npx}\n`);
    return { id: entry.id, status: "npx", path: entry.npx };
  }
  const url = `https://github.com/${entry.owner}/${entry.repo}.git`;
  if (existsSync(target)) {
    return { id: entry.id, status: "exists", path: target };
  }
  const r = spawnSync("git", ["clone", "--depth", "1", url, target], { encoding: "utf8" });
  if (r.status !== 0) {
    return { id: entry.id, status: "failed", error: r.stderr };
  }
  return { id: entry.id, status: "cloned", path: target };
}

function main() {
  process.stdout.write("Installing kit to " + dest + "\n");
  const results = manifest.repos.filter((r) => !r.optional).map(installRepo);
  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

if (process.argv[1]?.includes("install-kit.mjs")) main();
