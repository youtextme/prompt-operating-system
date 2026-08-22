/**
 * Claude Code adapter — wires Prompt OS router into Claude Code
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireClaude({ home, routerPath }) {
  const claudeDir = join(home, ".claude");
  mkdirSync(claudeDir, { recursive: true });

  const claudePath = join(claudeDir, "CLAUDE.md");
  writeFileSync(claudePath, claudeInstruction(routerPath), "utf8");

  return { tool: "claude", status: "wired", detail: claudePath };
}

function claudeInstruction(routerPath) {
  return `# Prompt Router

Read and obey \`${routerPath}\` before any task. Same pipeline as every agent on this machine (Outcome OS constitution, shared skills, capped loops, evidence-based done).

## Classification

- Trivial (Q&A, rename, one-line fix): answer directly
- Non-trivial (new capability, multi-file change): run contract pipeline

## Community Skills

Available from ~/.agents/prompt-os/skills/community/:
- superpowers — shipping methodology
- grill-me — requirements clarification
- anthropic-skills — design & testing
- ralph — outer loop engine
`;
}
