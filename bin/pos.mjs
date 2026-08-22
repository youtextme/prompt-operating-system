#!/usr/bin/env node
/**
 * Prompt OS CLI - doctor command and utilities
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();
const posRoot = join(home, ".agents", "prompt-os");
const routerPath = join(home, ".agents", "router", "PROMPT-ROUTER.md");

async function doctor() {
  const checks = [
    {
      name: "Router file",
      check: () => existsSync(routerPath),
      path: routerPath,
    },
    {
      name: "Constitution",
      check: () => existsSync(join(posRoot, "CONSTITUTION.md")),
      path: join(posRoot, "CONSTITUTION.md"),
    },
    {
      name: "Contracts directory",
      check: () => existsSync(join(posRoot, "contracts")),
      path: join(posRoot, "contracts"),
    },
    {
      name: "Scripts directory",
      check: () => existsSync(join(posRoot, "kernel", "scripts")),
      path: join(posRoot, "kernel", "scripts"),
    },
    {
      name: "Skills directory",
      check: () => existsSync(join(posRoot, "skills")),
      path: join(posRoot, "skills"),
    },
    {
      name: "Wiring manifest",
      check: () => existsSync(join(posRoot, "WIRING.json")),
      path: join(posRoot, "WIRING.json"),
    },
  ];

  console.log("Prompt OS Health Check\n");

  let allPassed = true;
  for (const check of checks) {
    const passed = check.check();
    const status = passed ? "✓" : "✗";
    console.log(`${status} ${check.name}: ${passed ? "OK" : "MISSING"}`);
    if (!passed) {
      console.log(`  Expected: ${check.path}`);
      allPassed = false;
    }
  }

  // Check wiring
  if (existsSync(join(posRoot, "WIRING.json"))) {
    console.log("\nWired tools:");
    const wiring = JSON.parse(readFileSync(join(posRoot, "WIRING.json"), "utf8"));
    for (const tool of wiring.tools || []) {
      const status = tool.status === "wired" ? "✓" : "!";
      console.log(`${status} ${tool.tool}: ${tool.status} — ${tool.detail}`);
    }
  }

  // Check community skills
  if (existsSync(join(posRoot, "skills", "community"))) {
    console.log("\nCommunity skills:");
    const skillsDir = join(posRoot, "skills", "community");
    const skills = ["superpowers", "agent-skills", "grill-me", "anthropic-skills", "ralph", "app-store-review", "ccusage"];
    for (const skill of skills) {
      const skillPath = join(skillsDir, skill);
      const status = existsSync(skillPath) ? "✓" : "!";
      console.log(`${status} ${skill}: ${existsSync(skillPath) ? "installed" : "not installed"}`);
    }
  }

  process.exit(allPassed ? 0 : 1);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === "doctor") {
  doctor();
} else {
  console.log(`
Prompt OS CLI

Usage: pos <command>

Commands:
  doctor  Run health check

Examples:
  pos doctor
  node bin/pos.mjs doctor
  `);
  process.exit(1);
}
