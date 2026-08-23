import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { devinKnowledge, ollamaSystemPrompt } from "./status-law.mjs";

export async function wireDevin({ home, routerPath, posRoot }) {
  const devinDir = join(home, ".devin");
  if (!existsSync(devinDir)) {
    return { tool: "devin", status: "skipped", detail: "not installed" };
  }

  mkdirSync(devinDir, { recursive: true });
  const knowledge = join(devinDir, "PROMPT-OS.md");
  writeFileSync(knowledge, devinKnowledge(routerPath, posRoot), "utf8");

  return { tool: "devin", status: "wired", detail: knowledge };
}

export async function wireOllama({ home, routerPath, posRoot }) {
  const hintPath = join(posRoot, "ollama", "POS-SYSTEM-PROMPT.txt");
  mkdirSync(join(posRoot, "ollama"), { recursive: true });
  const hubScript = join(posRoot, "hub", "server.mjs");
  writeFileSync(hintPath, ollamaSystemPrompt(routerPath, posRoot, hubScript), "utf8");

  return {
    tool: "ollama",
    status: "wired",
    detail: `${hintPath} — use POS hub :8555 or agent hosts above for routed prompts`,
  };
}
