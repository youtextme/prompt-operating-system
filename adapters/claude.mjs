import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { claudeMd } from "./status-law.mjs";

export async function wireClaude({ home, routerPath, posRoot }) {
  const claudeDir = join(home, ".claude");
  if (!existsSync(claudeDir)) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(claudeDir, { recursive: true });
  }

  const claudeMdPath = join(claudeDir, "CLAUDE.md");
  writeFileSync(claudeMdPath, claudeMd(routerPath, posRoot), "utf8");
  return { tool: "claude", status: "wired", detail: claudeMdPath };
}
