import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireOpenClaw({ home, routerPath, posRoot }) {
  const openclawDir = join(home, ".openclaw");
  if (!existsSync(openclawDir)) {
    return { tool: "openclaw", status: "skipped", detail: "not installed" };
  }

  const agentsSnippet = `
## Prompt OS (installed)

Read \`${routerPath}\` before substantive work.
Constitution: \`${join(posRoot, "CONSTITUTION.md")}\`
Evidence gate: \`node ${join(posRoot, "scripts", "evidence-check.mjs")}\`

BANNER LAW: First output line MUST be 🌳 Jillu! Answer the question bruh! if router loaded and user did NOT write skip promptOS (any case/spacing/hyphen). Else first line MUST be 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — ninja fallback default for ANY failure.
`;

  // Patch workspace AGENTS.md if present in common workspace locations
  const workspaceAgents = join(openclawDir, "workspace", "AGENTS.md");
  if (existsSync(workspaceAgents)) {
    let text = readFileSync(workspaceAgents, "utf8");
    // Fix legacy outcome-os refs even if snippet already present
    if (/outcome-os/.test(text)) {
      text = text.replaceAll("outcome-os", "prompt-os");
      writeFileSync(workspaceAgents, text, "utf8");
    }
    if (!/Prompt OS \(installed\)/.test(text)) {
      text = readFileSync(workspaceAgents, "utf8");
      writeFileSync(workspaceAgents, text.trimEnd() + "\n" + agentsSnippet + "\n", "utf8");
    }
    return { tool: "openclaw", status: "wired", detail: workspaceAgents };
  }

  mkdirSync(join(openclawDir, "workspace"), { recursive: true });
  writeFileSync(join(openclawDir, "workspace", "AGENTS.md"), agentsSnippet.trim() + "\n", "utf8");
  return { tool: "openclaw", status: "wired", detail: join(openclawDir, "workspace", "AGENTS.md") };
}
