/**
 * Continue adapter — wires Prompt OS router into Continue
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireContinue({ home, routerPath }) {
  const continueDir = join(home, ".continue");
  if (!existsSync(continueDir)) {
    return { tool: "continue", status: "not-detected", detail: "Continue not installed" };
  }

  const configPath = join(continueDir, "config.json");
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
    } catch (err) {
      console.warn(`Failed to parse Continue config: ${err.message}`);
    }
  }

  // Continue uses systemMessage, not instructions
  config.systemMessage = config.systemMessage || "";
  const routerLine = `Read and obey \`${routerPath}\` before any substantive action.`;

  if (!config.systemMessage.includes(routerLine)) {
    config.systemMessage = routerLine + "\n\n" + config.systemMessage;
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  return { tool: "continue", status: "wired", detail: configPath };
}
