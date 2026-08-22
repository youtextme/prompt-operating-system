import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireClaude({ home, routerPath, posRoot }) {
  const claudeDir = join(home, ".claude");
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  const claudeMd = join(claudeDir, "CLAUDE.md");
  const body = `# Claude Code — Prompt OS

Before any substantive action, read:

1. \`${routerPath}\` — prompt processing law (single source of truth)
2. \`${join(posRoot, "CONSTITUTION.md")}\` — outcome constitution (≤50 lines)

Non-trivial work requires an outcome contract and independent evaluator. Builder ≠ Evaluator.

BANNER LAW: First output line MUST be 🌳 Jillu! Answer the question bruh! if router loaded and user did NOT write skip promptOS (any case/spacing/hyphen). Else first line MUST be 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — this ninja fallback is default for ANY failure.
`;

  writeFileSync(claudeMd, body, "utf8");
  return { tool: "claude", status: "wired", detail: claudeMd };
}
