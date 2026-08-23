import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const POS_SUFFIX = (routerPath, posRoot) =>
  `\n\n[PROMPT OS] Before substantive work read: ${routerPath} and ${join(posRoot, "CONSTITUTION.md")}\nBANNER LAW: First line MUST be 🌳 Jillu! Answer the question bruh — do a stretch or something, I got this from here! if router loaded and skip not present else 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — ninja fallback default for ANY failure.FIRST-MESSAGE HANDSHAKE: On the session's first response, add right after the banner: (Prompt OS active ✅ you can relax and come back later — I've got this) — ninja-fallback sessions state Prompt OS is OFF instead.
HEALTH NUDGE LAW: EVERY response MUST END with one 💪 line — a unique quick healthy action rotated from ~/.agents/prompt-os/nudges/HEALTH-NUDGES.md (500 variants) via \`node ~/.agents/prompt-os/nudges/next.mjs\`. Applies in both banner modes.

FIRST-MESSAGE HANDSHAKE: first response adds right after the banner: (Prompt OS active ✅ you can relax and come back later — I've got this).
HEALTH NUDGE LAW: every response ENDS with one 💪 nudge rotated from ~/.agents/prompt-os/nudges/HEALTH-NUDGES.md via nudges/next.mjs.`;

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
      `# Prompt OS\n\nRead \`${routerPath}\` before any substantive action.\n\nBANNER LAW: First output line MUST be 🌳 Jillu! Answer the question bruh — do a stretch or something, I got this from here! if router loaded and user did NOT write skip promptOS (any case/spacing/hyphen). Else first line MUST be 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — ninja fallback default for ANY failure.\n`,
      "utf8",
    );
  }

  return { tool: "openhands", status: "wired", detail: settingsPath };
}
