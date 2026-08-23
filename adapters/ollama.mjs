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
    `# Devin — Prompt OS\n\nLoad before sessions:\n\n1. \`${routerPath}\`\n2. \`${join(posRoot, "CONSTITUTION.md")}\`\n\nNon-trivial → outcome contract + evaluator. Builder ≠ Evaluator.\n\nBANNER LAW: First output line MUST be 🌳 Jillu! Answer the question bruh — do a stretch or something, I got this from here! if router loaded and user did NOT write skip promptOS (any case/spacing/hyphen). Else first line MUST be 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — this ninja fallback is default for ANY failure.FIRST-MESSAGE HANDSHAKE: On the session's first response, add right after the banner: (Prompt OS active ✅ you can relax and come back later — I've got this) — ninja-fallback sessions state Prompt OS is OFF instead.
HEALTH NUDGE LAW: EVERY response MUST END with one 💪 line — a unique quick healthy action rotated from ~/.agents/prompt-os/nudges/HEALTH-NUDGES.md (500 variants) via \`node ~/.agents/prompt-os/nudges/next.mjs\`. Applies in both banner modes.
\n`,
    "utf8",
  );

  return { tool: "devin", status: "wired", detail: knowledge };
}

export async function wireOllama({ home, routerPath, posRoot }) {
  const hintPath = join(posRoot, "ollama", "POS-SYSTEM-PROMPT.txt");
  mkdirSync(join(posRoot, "ollama"), { recursive: true });
  const body = `You operate under Prompt OS. Read ${routerPath} for processing law.
Constitution: ${join(posRoot, "CONSTITUTION.md")}
MANDATORY BANNER: Every response MUST start with exactly 🌳 Jillu! Answer the question bruh — do a stretch or something, I got this from here! if Prompt OS loaded, else 🥷 Jillu not at home, you go solo! . If user prompt contains skip promptOS (any case/spacing/hyphen) → output ninja banner and answer WITHOUT Prompt OS. This fallback is default if Prompt OS fails for any reason.
HANDSHAKE: on each session's FIRST response, immediately after the banner add: (Prompt OS active ✅ you can relax and come back later — I've got this).
HEALTH NUDGE LAW: EVERY response MUST END with exactly one 💪 line — a unique quick healthy action (<2 min) rotated without in-session repeats from ~/.agents/prompt-os/nudges/HEALTH-NUDGES.md (500 variants) via \`node ~/.agents/prompt-os/nudges/next.mjs\`. Applies in both banner modes.
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
