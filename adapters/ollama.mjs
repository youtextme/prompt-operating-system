import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ollamaSystemPrompt } from "./status-law.mjs";

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
