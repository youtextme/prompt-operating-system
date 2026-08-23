import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openClawSnippet } from "./status-law.mjs";

export async function wireOpenClaw({ home, routerPath, posRoot }) {
  const openclawDir = join(home, ".openclaw");
  if (!existsSync(openclawDir)) {
    return { tool: "openclaw", status: "skipped", detail: "not installed" };
  }

  const evidenceScript = join(posRoot, "scripts", "evidence-check.mjs");
  const agentsSnippet = openClawSnippet(routerPath, posRoot, evidenceScript);

  const workspaceAgents = join(openclawDir, "workspace", "AGENTS.md");
  if (existsSync(workspaceAgents)) {
    let text = readFileSync(workspaceAgents, "utf8");
    if (/outcome-os/.test(text)) {
      text = text.replaceAll("outcome-os", "prompt-os");
      writeFileSync(workspaceAgents, text, "utf8");
    }
    if (!/Prompt OS \(installed\)/.test(text)) {
      text = readFileSync(workspaceAgents, "utf8");
      writeFileSync(workspaceAgents, text.trimEnd() + "\n" + agentsSnippet + "\n", "utf8");
    } else if (/Jillu|BANNER LAW/.test(text)) {
      text = readFileSync(workspaceAgents, "utf8").replace(
        /## Prompt OS \(installed\)[\s\S]*?(?=\n## |\n# |$)/,
        agentsSnippet.trim() + "\n",
      );
      writeFileSync(workspaceAgents, text, "utf8");
    }
    return { tool: "openclaw", status: "wired", detail: workspaceAgents };
  }

  mkdirSync(join(openclawDir, "workspace"), { recursive: true });
  writeFileSync(join(openclawDir, "workspace", "AGENTS.md"), agentsSnippet.trim() + "\n", "utf8");
  return { tool: "openclaw", status: "wired", detail: join(openclawDir, "workspace", "AGENTS.md") };
}
