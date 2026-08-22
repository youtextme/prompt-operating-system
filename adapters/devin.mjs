/**
 * Devin adapter — wires Prompt OS router into Devin
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireDevin({ home, routerPath }) {
  const devinDir = join(home, ".devin");
  if (!existsSync(devinDir)) {
    return { tool: "devin", status: "not-detected", detail: "Devin not installed" };
  }

  const rulesDir = join(devinDir, "rules");
  mkdirSync(rulesDir, { recursive: true });

  const rulePath = join(rulesDir, "00-prompt-os.mdc");
  writeFileSync(rulePath, devinRule(routerPath), "utf8");

  // Note: superpowers plugin is installed separately via devin plugins install
  return { tool: "devin", status: "wired", detail: rulePath };
}

function devinRule(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence.

## Required Plugins

Install superpowers plugin for methodology:
\`devin plugins install obra/superpowers\`

## Community Skills

Available from ~/.agents/prompt-os/skills/community/:
- superpowers — shipping methodology (via plugin)
- agent-skills — production engineering
- anthropic-skills — design & testing
`;
}
