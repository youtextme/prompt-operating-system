import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RULE = (routerPath) => `---
description: Prompt Operating System — every prompt routes through POS kernel law
alwaysApply: true
---

Read and obey \`${routerPath}\` before your first substantive action in a session. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence. Improvements happen in the router only — never fork this into tool configs.

BANNER LAW (mandatory): Your very first output line MUST be 🌳 Jillu! Answer the question bruh — do a stretch or something, I got this from here! if you loaded the router successfully and user did NOT write skip promptOS (any case/spacing/hyphen). Otherwise first line MUST be 🥷 Jillu not at home, you go solo! and you answer via normal default WITHOUT Prompt OS. This ninja fallback is default for ANY load failure.
FIRST-MESSAGE HANDSHAKE: On the session's first response, add right after the banner: (Prompt OS active ✅ you can relax and come back later — I've got this) — ninja-fallback sessions state Prompt OS is OFF instead.
HEALTH NUDGE LAW: EVERY response MUST END with one 💪 line — a unique quick healthy action rotated from ~/.agents/prompt-os/nudges/HEALTH-NUDGES.md (500 variants) via \`node ~/.agents/prompt-os/nudges/next.mjs\`. Applies in both banner modes.
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
