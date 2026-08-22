import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const POS_SUFFIX = (routerPath, posRoot) =>
  `\n\n[PROMPT OS] Before substantive work read: ${routerPath} and ${join(posRoot, "CONSTITUTION.md")}\nBANNER LAW: First line MUST be 🌳 Jillu! Answer the question bruh! if router loaded and skip not present else 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — ninja fallback default for ANY failure.`;

export async function wireOpenHands({ home, routerPath, posRoot }) {
  const settingsPath = join(home, ".openhands", "settings.json");
  if (!existsSync(settingsPath)) {
    return { tool: "openhands", status: "skipped", detail: "not installed" };
  }

  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  const agent = settings.agent_settings || settings;
  if (!agent.agent_context) agent.agent_context = {};
  const suffix = POS_SUFFIX(routerPath, posRoot);
  agent.agent_context.system_message_suffix = suffix;
  agent.agent_context.load_user_skills = agent.agent_context.load_user_skills ?? true;

  if (settings.agent_settings) {
    settings.agent_settings = agent;
  } else {
    Object.assign(settings, agent);
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");

  const microagents = join(home, ".openhands", "microagents", "prompt-os.md");
  const microDir = join(home, ".openhands", "microagents");
  if (!existsSync(microDir)) {
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(microDir, { recursive: true });
    } catch {
      /* optional dir */
    }
  }
  if (existsSync(microDir)) {
    writeFileSync(
      microagents,
      `# Prompt OS\n\nRead \`${routerPath}\` before any substantive action.\n\nBANNER LAW: First output line MUST be 🌳 Jillu! Answer the question bruh! if router loaded and user did NOT write skip promptOS (any case/spacing/hyphen). Else first line MUST be 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — ninja fallback default for ANY failure.\n`,
      "utf8",
    );
  }

  return { tool: "openhands", status: "wired", detail: settingsPath };
}
