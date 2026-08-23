import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { markdownRule } from "./status-law.mjs";

export async function wireVSCode({ home, routerPath }) {
  const userDir =
    platform() === "win32"
      ? join(home, "AppData", "Roaming", "Code", "User")
      : join(home, ".config", "Code", "User");

  if (!existsSync(join(userDir, ".."))) {
    return { tool: "vscode", status: "skipped", detail: "not installed" };
  }

  mkdirSync(userDir, { recursive: true });

  const copilotInstructions = join(userDir, "copilot-instructions.md");
  writeFileSync(copilotInstructions, markdownRule(routerPath), "utf8");

  return { tool: "vscode", status: "wired", detail: copilotInstructions };
}
