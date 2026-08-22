import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireDevin({ home, routerPath, posRoot }) {
  const devinDir = join(home, ".devin");
  if (!existsSync(devinDir)) {
    return { tool: "devin", status: "skipped", detail: "not installed" };
  }

  mkdirSync(devinDir, { recursive: true });
  const knowledge = join(devinDir, "PROMPT-OS.md");
  writeFileSync(
    knowledge,
    `# Devin — Prompt OS\n\nLoad before sessions:\n\n1. \`${routerPath}\`\n2. \`${join(posRoot, "CONSTITUTION.md")}\`\n\nNon-trivial → outcome contract + evaluator. Builder ≠ Evaluator.\n`,
    "utf8",
  );

  return { tool: "devin", status: "wired", detail: knowledge };
}

export async function wireOllama({ home, routerPath, posRoot }) {
  const hintPath = join(posRoot, "ollama", "POS-SYSTEM-PROMPT.txt");
  mkdirSync(join(posRoot, "ollama"), { recursive: true });
  const body = `You operate under Prompt OS. Read ${routerPath} for processing law.
Constitution: ${join(posRoot, "CONSTITUTION.md")}
Classify trivial vs non-trivial. Non-trivial requires outcome contract before building.
For POS-routed inference use: node ${join(posRoot, "hub", "server.mjs")} on port 8555 (prepends this context).
Raw ollama serve (11434) does NOT auto-load POS — use OpenHands/Cursor/opencode or the hub.`;
  writeFileSync(hintPath, body, "utf8");

  return {
    tool: "ollama",
    status: "wired",
    detail: `${hintPath} — use POS hub :8555 or agent hosts above for routed prompts`,
  };
}
