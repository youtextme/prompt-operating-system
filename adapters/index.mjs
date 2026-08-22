/**
 * Prompt OS — detect installed IDEs/CLIs and wire router injection.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { wireCursor } from "./cursor.mjs";
import { wireClaude } from "./claude.mjs";
import { wireOpenClaw } from "./openclaw.mjs";
import { wireOpenCode } from "./opencode.mjs";
import { wireVSCode } from "./vscode.mjs";
import { wireWindsurf } from "./windsurf.mjs";
import { wireContinue } from "./continue.mjs";
import { wireDevin } from "./devin.mjs";

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
    zed: join(home, ".config", "zed"),
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
    { id: "windsurf", path: paths.windsurf, detected: existsSync(paths.windsurf) },
    { id: "continue", path: paths.continue, detected: existsSync(paths.continue) },
    { id: "devin", path: paths.devin, detected: existsSync(paths.devin) },
    { id: "zed", path: paths.zed, detected: existsSync(paths.zed) },
  ];
}

export async function wireAll({ home, posRoot, routerPath }) {
  const results = [];
  const ctx = { home, posRoot, routerPath };

  // Wire each detected tool
  const adapters = [
    wireCursor,
    wireOpenCode,
    wireClaude,
    wireVSCode,
    wireOpenClaw,
    wireWindsurf,
    wireContinue,
    wireDevin,
  ];

  for (const adapter of adapters) {
    try {
      const result = await adapter(ctx);
      results.push(result);
    } catch (err) {
      results.push({
        tool: adapter.name.replace("wire", "").toLowerCase(),
        status: "error",
        detail: String(err.message || err),
      });
    }
  }

  writeWiringManifest(home, results);
  return results;
}

function writeWiringManifest(home, results) {
  const posRoot = join(home, ".agents", "prompt-os");
  mkdirSync(posRoot, { recursive: true });

  const path = join(posRoot, "WIRING.json");
  writeFileSync(
    path,
    JSON.stringify({ updatedAt: new Date().toISOString(), tools: results }, null, 2) + "\n",
    "utf8",
  );
}
