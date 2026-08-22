/**
 * Cursor adapter — wires Prompt OS router into Cursor
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireCursor({ home, posRoot, routerPath }) {
  const rulesDir = join(home, ".cursor", "rules");
  const rulePath = join(rulesDir, "00-prompt-os.mdc");

  mkdirSync(rulesDir, { recursive: true });
  writeFileSync(rulePath, cursorRule(routerPath), "utf8");

  // Copy agent roles
  const agentsDir = join(home, ".cursor", "agents");
  mkdirSync(agentsDir, { recursive: true });

  const roles = ["researcher", "experimenter", "builder", "evaluator"];
  for (const role of roles) {
    const src = join(posRoot, "kernel", "roles", `${role}.md`);
    const dest = join(agentsDir, `${role}.md`);
    if (existsSync(src)) {
      writeFileSync(dest, readFileSync(src, "utf8"), "utf8");
    }
  }

  return { tool: "cursor", status: "wired", detail: rulePath };
}

function cursorRule(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action in a session. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence.

## Mandatory Skills

Load these skills for non-trivial builds:
- outcome-os (contract-based building)
- recruit (staffing protocol)
- bar-raiser (quality gate)

## Community Skills

Available on demand:
- superpowers (shipping methodology)
- agent-skills (production engineering)
- grill-me (requirements clarification)
- anthropic-skills (design & testing)
- ralph (outer loop engine)

## Hooks

- session-start: Load constitution
- stop: Run evidence-check before claiming done
`;
}
