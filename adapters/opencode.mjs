import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

function opencodeConfigPath(home) {
  const candidates = [
    join(home, platform() === "win32" ? "AppData/Roaming/opencode" : ".config/opencode", "opencode.jsonc"),
    join(home, ".config", "opencode", "opencode.jsonc"),
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

export async function wireOpenCode({ home, routerPath }) {
  const configPath = opencodeConfigPath(home);
  const configDir = join(configPath, "..");
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  let config = {};
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
    try {
      const stripJsonc = (s) => s.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m.startsWith('"') ? m : ""));
      config = JSON.parse(stripJsonc(raw).replace(/,\s*([\]}])/g, "$1"));
    } catch {
      config = { $schema: "https://opencode.ai/config.json" };
    }
  } else {
    config = { $schema: "https://opencode.ai/config.json", model: "opencode/big-pickle" };
  }

  const instructions = Array.isArray(config.instructions) ? config.instructions : [];
  const filtered = instructions.filter((i) => !/PROMPT-ROUTER|prompt-os|outcome-os/i.test(String(i)));
  filtered.unshift(routerPath);
  config.instructions = filtered;

  if (!config.permission) {
    config.permission = { "*": "allow" };
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return { tool: "opencode", status: "wired", detail: configPath };
}
