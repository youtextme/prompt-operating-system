import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { statusLawBlock } from "./status-law.mjs";

/** Portable router path for cross-machine repo rules. */
export const ROUTER_HOME = "~/.agents/router/PROMPT-ROUTER.md";

const RULE = (routerPath) => `---
description: Prompt Operating System — every prompt routes through POS kernel law
alwaysApply: true
---

${statusLawBlock(routerPath)}
`;

/** Repo .cursor/rules — required for Cursor Cloud agents (they read the repo, not ~/.cursor). */
export async function wireCursorRepo({ repoRoot, routerPath = ROUTER_HOME }) {
  if (!repoRoot || !existsSync(repoRoot)) {
    return { tool: "cursor-repo", status: "skipped", detail: "no repo root" };
  }

  const rulesDir = join(repoRoot, ".cursor", "rules");
  mkdirSync(rulesDir, { recursive: true });

  const template = join(repoRoot, "templates", "00-prompt-os.mdc");
  if (existsSync(template)) {
    cpSync(template, join(rulesDir, "00-prompt-os.mdc"), { force: true });
  } else {
    writeFileSync(join(rulesDir, "00-prompt-os.mdc"), RULE(routerPath), "utf8");
  }

  return { tool: "cursor-repo", status: "wired", detail: join(rulesDir, "00-prompt-os.mdc") };
}

export async function wireCursor({ home, routerPath, posRoot, repoRoot }) {
  const results = [];

  if (repoRoot) {
    results.push(await wireCursorRepo({ repoRoot, routerPath: ROUTER_HOME }));
  }

  const cursorDir = join(home, ".cursor");
  if (!existsSync(cursorDir)) {
    if (results.length) return results;
    return { tool: "cursor", status: "skipped", detail: "not installed" };
  }

  const rulesDir = join(cursorDir, "rules");
  mkdirSync(rulesDir, { recursive: true });

  const legacyRule = join(rulesDir, "00-outcome-os.mdc");
  if (existsSync(legacyRule)) {
    writeFileSync(legacyRule + ".bak", readFileSync(legacyRule, "utf8"), "utf8");
  }

  const rulePath = join(rulesDir, "00-prompt-os.mdc");
  writeFileSync(rulePath, RULE(routerPath), "utf8");

  const agentsDir = join(cursorDir, "agents");
  mkdirSync(agentsDir, { recursive: true });
  for (const role of ["builder", "evaluator", "researcher", "experimenter"]) {
    const src = join(posRoot, "roles", `${role}.md`);
    const dest = join(agentsDir, `${role}.md`);
    if (existsSync(src)) writeFileSync(dest, readFileSync(src, "utf8"), "utf8");
  }

  const hooksDir = join(cursorDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const sessionHook = join(hooksDir, "session-start.mjs");
  if (!existsSync(sessionHook)) {
    writeFileSync(
      sessionHook,
      `// Prompt OS session start — remind agent of router law
export default async function sessionStart() {
  return {
    message: "Prompt OS active. Read PROMPT-ROUTER.md + STATUS-LAW.md before substantive work.",
  };
}
`,
      "utf8",
    );
  }

  results.push({ tool: "cursor", status: "wired", detail: rulePath });
  return results.length === 1 ? results[0] : results;
}
