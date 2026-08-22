/**
 * Windsurf adapter — wires Prompt OS router into Windsurf
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireWindsurf({ home, routerPath }) {
  const rulesDir = join(home, ".codeium", "windsurf", "rules");
  mkdirSync(rulesDir, { recursive: true });

  const rulePath = join(rulesDir, "00-prompt-os.md");
  writeFileSync(rulePath, windsurfRule(routerPath), "utf8");

  return { tool: "windsurf", status: "wired", detail: rulePath };
}

function windsurfRule(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence.

## Mandatory Skills

Load these skills for non-trivial builds:
- outcome-os (contract-based building)
- bar-raiser (quality gate)

## Community Skills

Available from ~/.agents/prompt-os/skills/community/:
- superpowers — shipping methodology
- anthropic-skills — design & testing
`;
}
