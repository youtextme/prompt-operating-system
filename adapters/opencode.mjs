/**
 * opencode adapter — wires Prompt OS router into opencode
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireOpenCode({ home, routerPath }) {
  const isWin = process.platform === "win32";
  const configDir = existsSync(join(home, "AppData/Roaming/opencode"))
    ? join(home, "AppData/Roaming/opencode")
    : join(home, ".config/opencode");

  mkdirSync(configDir, { recursive: true });

  const configPath = join(configDir, "opencode.jsonc");

  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
    } catch (err) {
      console.warn(`Failed to parse opencode config: ${err.message}`);
    }
  }

  config.instructions = config.instructions || [];
  if (!config.instructions.includes(routerPath)) {
    config.instructions.unshift(routerPath);
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  return { tool: "opencode", status: "wired", detail: configPath };
}
