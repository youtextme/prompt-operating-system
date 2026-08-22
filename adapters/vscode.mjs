import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export async function wireVSCode({ home, routerPath }) {
  const userDir =
    platform() === "win32"
      ? join(home, "AppData", "Roaming", "Code", "User")
      : join(home, ".config", "Code", "User");

  if (!existsSync(join(userDir, ".."))) {
    return { tool: "vscode", status: "skipped", detail: "not installed" };
  }

  mkdirSync(userDir, { recursive: true });

  // GitHub Copilot custom instructions (VS Code 1.96+)
  const copilotInstructions = join(userDir, "copilot-instructions.md");
  writeFileSync(
    copilotInstructions,
    `# Prompt OS\n\nRead and obey \`${routerPath}\` before substantive AI-assisted work.\n\nBANNER LAW: First output line MUST be 🌳 Jillu! Answer the question bruh! if router loaded and user did NOT write skip promptOS (any case/spacing/hyphen). Else first line MUST be 🥷 Jillu not at home, you go solo! and answer WITHOUT Prompt OS — ninja fallback default for ANY failure.\n`,
    "utf8",
  );

  return { tool: "vscode", status: "wired", detail: copilotInstructions };
}
