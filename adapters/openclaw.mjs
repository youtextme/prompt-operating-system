/**
 * OpenClaw adapter — wires Prompt OS router into OpenClaw
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireOpenClaw({ home, routerPath }) {
  const openclawDir = join(home, ".openclaw");
  mkdirSync(openclawDir, { recursive: true });

  const agentsPath = join(openclawDir, "AGENTS.md");
  writeFileSync(agentsPath, openClawInstruction(routerPath), "utf8");

  return { tool: "openclaw", status: "wired", detail: agentsPath };
}

function openClawInstruction(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. This loads the Outcome OS constitution, classifies trivial vs non-trivial tasks, and routes to contract-based building with evidence verification.

## Rules

- Non-trivial tasks require outcome contracts
- Load outcome-os skill for builds
- Cap loops at 12 iterations
- Never self-grade work

## Community Skills

Available from ~/.agents/prompt-os/skills/community/:
- superpowers — shipping methodology
- ralph — outer loop engine
- ccusage — cost tracking
`;
}
