/**
 * Prompt OS — detect installed IDEs/CLIs and wire router injection.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { wireClaude } from "./claude.mjs";
import { wireCursor } from "./cursor.mjs";
import { wireDevin } from "./devin.mjs";
import { wireOllama } from "./ollama.mjs";
import { wireOpenClaw } from "./openclaw.mjs";
import { wireOpenHands } from "./openhands.mjs";
import { wireOpenCode } from "./opencode.mjs";
import { wireVSCode } from "./vscode.mjs";
import { wireEnforce } from "./enforce.mjs";

export function detectTools(home = homedir()) {
  const isWin = platform() === "win32";
  const paths = {
    cursor: join(home, ".cursor"),
    vscode: join(home, isWin ? "AppData/Roaming/Code/User" : ".config/Code/User"),
    opencode: join(home, isWin ? "AppData/Roaming/opencode" : ".config/opencode"),
    opencodeAlt: join(home, ".config", "opencode"),
    claude: join(home, ".claude"),
    openclaw: join(home, ".openclaw"),
    windsurf: join(home, ".codeium", "windsurf"),
    continue: join(home, ".continue"),
    devin: join(home, ".devin"),
    openhands: join(home, ".openhands"),
  };

  return [
    { id: "cursor", path: paths.cursor, detected: existsSync(paths.cursor) },
    { id: "vscode", path: paths.vscode, detected: existsSync(paths.vscode) },
    {
      id: "opencode",
      path: existsSync(paths.opencode) ? paths.opencode : paths.opencodeAlt,
      detected: existsSync(paths.opencode) || existsSync(paths.opencodeAlt),
    },
    { id: "claude", path: paths.claude, detected: existsSync(paths.claude) },
    { id: "openclaw", path: paths.openclaw, detected: existsSync(paths.openclaw) },
    { id: "openhands", path: paths.openhands, detected: existsSync(paths.openhands) },
    { id: "windsurf", path: paths.windsurf, detected: existsSync(paths.windsurf) },
    { id: "continue", path: paths.continue, detected: existsSync(paths.continue) },
    { id: "devin", path: paths.devin, detected: existsSync(paths.devin) },
    { id: "ollama", path: join(home, ".ollama"), detected: existsSync(join(home, ".ollama")) || true },
  ];
}

export async function wireAll({ home, posRoot, routerPath, enforce = false }) {
  const results = [];
  const ctx = { home, posRoot, routerPath };

  for (const fn of [wireCursor, wireOpenCode, wireClaude, wireVSCode, wireOpenClaw, wireOpenHands, wireDevin, wireOllama]) {
    try {
      results.push(await fn(ctx));
    } catch (err) {
      results.push({ tool: fn.name, status: "error", detail: String(err.message || err) });
    }
  }

  // Windsurf uses same pattern as Cursor (.codeium/windsurf) — reuse cursor adapter path variant
  const windsurfRules = join(home, ".codeium", "windsurf", "rules");
  if (existsSync(join(home, ".codeium", "windsurf"))) {
    mkdirSync(windsurfRules, { recursive: true });
    const rulePath = join(windsurfRules, "00-prompt-os.md");
    writeFileSync(rulePath, windsurfRule(routerPath), "utf8");
    results.push({ tool: "windsurf", status: "wired", detail: rulePath });
  }

  // Continue config hint
  const continueConfig = join(home, ".continue", "config.json");
  if (existsSync(join(home, ".continue"))) {
    results.push({
      tool: "continue",
      status: "detected",
      detail: `Add to Continue system message: Read ${routerPath}`,
    });
  }

  // Devin fallback note if only detected
  if (existsSync(join(home, ".devin")) && !results.some((r) => r.tool === "devin" && r.status === "wired")) {
    results.push({
      tool: "devin",
      status: "detected",
      detail: "See ~/.devin/PROMPT-OS.md",
    });
  }

  writeWiringManifest(home, results);

  if (enforce) {
    const er = await wireEnforce({ home, posRoot, routerPath, mode: "hard" });
    for (const e of er) {
      results.push({ tool: `enforce:${e.component}`, status: e.status, detail: e.detail });
    }
  }

  return results;
}

function windsurfRule(routerPath) {
  return `# Prompt OS\n\nRead and obey \`${routerPath}\` before any substantive action.\n`;
}

function writeWiringManifest(home, results) {
  const path = join(home, ".agents", "prompt-os", "WIRING.json");
  writeFileSync(
    path,
    JSON.stringify({ updatedAt: new Date().toISOString(), tools: results }, null, 2) + "\n",
    "utf8",
  );
}
