/**
 * Wire enforce mode into IDE/CLI configs — merge, never replace existing settings.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const GATEWAY = "http://127.0.0.1:8555/v1";

async function loadEnforceApi() {
  const installed = join(__dir, "..", "scripts", "enforce.mjs");
  const dev = join(__dir, "..", "kernel", "scripts", "enforce.mjs");
  const path = existsSync(installed) ? installed : dev;
  return import(pathToFileURL(path).href);
}

export async function wireEnforce({ home = homedir(), posRoot, routerPath, mode = "hard" }) {
  const { writeEnforceManifest, installEnforceHooks } = await loadEnforceApi();
  const results = [];
  writeEnforceManifest(mode);
  const hooks = installEnforceHooks();
  results.push({ component: "manifest", status: "ok", detail: join(posRoot, "ENFORCE.json") });
  results.push({ component: "cursor-hook", status: hooks.cursor ? "ok" : "skipped", detail: hooks.cursor || "" });

  const isWin = platform() === "win32";
  const opencodeCandidates = isWin
    ? [join(home, "AppData/Roaming/opencode/opencode.jsonc"), join(home, ".config/opencode/opencode.jsonc")]
    : [join(home, ".config/opencode/opencode.jsonc")];
  for (const opencodePath of opencodeCandidates) {
    if (existsSync(opencodePath)) {
      try {
        let raw = readFileSync(opencodePath, "utf8").replace(/^\uFEFF/, "");
        const config = JSON.parse(raw.replace(/\/\/.*$/gm, "").replace(/,\s*([\]}])/g, "$1"));
        config.openai = { ...(config.openai || {}), baseURL: GATEWAY };
        config.env = { ...(config.env || {}), OPENAI_BASE_URL: GATEWAY, OPENAI_API_BASE: GATEWAY, OLLAMA_HOST: "127.0.0.1:8555" };
        writeFileSync(opencodePath, JSON.stringify(config, null, 2) + "\n", "utf8");
        results.push({ component: "opencode-gateway", status: "ok", detail: opencodePath });
      } catch (err) {
        results.push({ component: "opencode-gateway", status: "error", detail: String(err.message) });
      }
    }
  }

  const continueConfig = join(home, ".continue", "config.json");
  if (existsSync(continueConfig)) {
    try {
      const config = JSON.parse(readFileSync(continueConfig, "utf8"));
      for (const m of config.models || []) {
        if (m.provider === "ollama" || /ollama/i.test(m.model || "")) {
          m.apiBase = "http://127.0.0.1:8555";
        }
      }
      config.env = { ...(config.env || {}), OPENAI_BASE_URL: GATEWAY };
      writeFileSync(continueConfig, JSON.stringify(config, null, 2) + "\n", "utf8");
      results.push({ component: "continue-gateway", status: "ok", detail: continueConfig });
    } catch (err) {
      results.push({ component: "continue-gateway", status: "warn", detail: String(err.message) });
    }
  }

  results.push({
    component: "ollama",
    status: "ok",
    detail: `HARD: OLLAMA_HOST=127.0.0.1:8555 OPENAI_BASE_URL=${GATEWAY}`,
  });

  return results;
}
