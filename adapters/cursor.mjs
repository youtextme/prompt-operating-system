import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RULE = (routerPath) => `---
description: Prompt Operating System — every prompt routes through POS kernel law
alwaysApply: true
---

Read and obey \`${routerPath}\` before your first substantive action in a session. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence. Improvements happen in the router only — never fork this into tool configs.
`;

export async function wireCursor({ home, routerPath, posRoot }) {
  const cursorDir = join(home, ".cursor");
  if (!existsSync(cursorDir)) {
    return { tool: "cursor", status: "skipped", detail: "not installed" };
  }

  const rulesDir = join(cursorDir, "rules");
  mkdirSync(rulesDir, { recursive: true });

  // Replace legacy outcome-os rule if present
  const legacyRule = join(rulesDir, "00-outcome-os.mdc");
  if (existsSync(legacyRule)) {
    writeFileSync(legacyRule + ".bak", readFileSync(legacyRule, "utf8"), "utf8");
  }

  const rulePath = join(rulesDir, "00-prompt-os.mdc");
  writeFileSync(rulePath, RULE(routerPath), "utf8");

  // Agent role stubs → point to POS roles
  const agentsDir = join(cursorDir, "agents");
  mkdirSync(agentsDir, { recursive: true });
  for (const role of ["builder", "evaluator", "researcher", "experimenter"]) {
    const src = join(posRoot, "roles", `${role}.md`);
    const dest = join(agentsDir, `${role}.md`);
    if (existsSync(src)) writeFileSync(dest, readFileSync(src, "utf8"), "utf8");
  }

  // Optional hooks template
  const hooksDir = join(cursorDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const sessionHook = join(hooksDir, "session-start.mjs");
  if (!existsSync(sessionHook)) {
    writeFileSync(
      sessionHook,
      `// Prompt OS session start — remind agent of router law
export default async function sessionStart() {
  return {
    message: "Prompt OS active. Read PROMPT-ROUTER.md before substantive work.",
  };
}
`,
      "utf8",
    );
  }

  return { tool: "cursor", status: "wired", detail: rulePath };
}
