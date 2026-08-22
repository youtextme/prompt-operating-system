#!/usr/bin/env node
/**
 * pos enforce — hard-block installation, gateway, doctor, env wiring.
 *
 * Expert synthesis (2025–2026 LLM gateway research):
 * - Transparent OpenAI-compatible proxy (LiteLLM, Forge, Indus) — single choke point
 * - Prepend-only middleware (Nexus, Barbacane) — never strip client tools/MCP
 * - IDE hooks (Cursor beforeSubmitPrompt) — prompt-level hard ring
 * - Fail-closed strict mode when kernel missing
 * - Backward compat: existing skills, MCP configs, system messages preserved
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { enforcePaths, loadEnforceConfig } from "../enforce/gateway.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const home = homedir();
const isWin = platform() === "win32";

function posRoot() {
  return process.env.PROMPT_OS_ROOT || join(home, ".agents", "prompt-os");
}

function manifestPath() {
  return join(posRoot(), "ENFORCE.json");
}

export function writeEnforceManifest(mode = "hard") {
  const { routerPath } = enforcePaths(home);
  const manifest = {
    version: "1.0.0",
    mode,
    strict: mode === "hard",
    port: 8555,
    ollamaUpstream: "http://127.0.0.1:11434",
    posRoot: posRoot(),
    routerPath,
    gatewayEndpoints: {
      openai: "http://127.0.0.1:8555/v1",
      ollama: "http://127.0.0.1:8555",
    },
    envVars: {
      OPENAI_BASE_URL: "http://127.0.0.1:8555/v1",
      OPENAI_API_BASE: "http://127.0.0.1:8555/v1",
      OLLAMA_HOST: "127.0.0.1:8555",
    },
    rings: {
      gateway: "All OpenAI/Ollama clients pointed at :8555 — prepend-only injection",
      cursorHook: "beforeSubmitPrompt — audit + fail-closed if kernel missing",
      ideWiring: "Global rules/suffixes — backup ring",
      exitGate: "evidence-check.mjs — proven/killed only with receipts",
    },
    backwardCompat: {
      skills: "Untouched except possandbox additive install",
      mcp: "Passthrough — tools[] unchanged in gateway",
      systemMessages: "Prepend-only — never replace",
      legacyOutcomeOs: "Migrated paths preserved under prompt-os/",
    },
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

export function installEnforceHooks() {
  const cursorDir = join(home, ".cursor");
  if (!existsSync(cursorDir)) return { cursor: "skipped" };

  const hooksDir = join(cursorDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });

  const hookSrc = join(posRoot(), "enforce", "hooks", "before-submit-prompt.mjs");
  const hookDest = join(hooksDir, "before-submit-prompt.mjs");
  if (existsSync(hookSrc)) {
    cpSync(hookSrc, hookDest, { force: true });
  }

  const hooksJsonPath = join(cursorDir, "hooks.json");
  let hooks = { version: 1, hooks: {} };
  if (existsSync(hooksJsonPath)) {
    try {
      hooks = JSON.parse(readFileSync(hooksJsonPath, "utf8"));
      hooks.hooks = hooks.hooks || {};
    } catch {
      hooks = { version: 1, hooks: {} };
    }
  }

  const entry = {
    command: "./hooks/before-submit-prompt.mjs",
    matcher: "UserPromptSubmit",
    failClosed: true,
  };
  const existing = hooks.hooks.beforeSubmitPrompt || [];
  const filtered = existing.filter((h) => !/before-submit-prompt/.test(String(h.command || "")));
  hooks.hooks.beforeSubmitPrompt = [entry, ...filtered];
  writeFileSync(hooksJsonPath, JSON.stringify(hooks, null, 2) + "\n", "utf8");

  return { cursor: hookDest, hooksJson: hooksJsonPath };
}

export function setUserEnvVars(manifest) {
  const vars = manifest.envVars || {};
  const results = [];
  for (const [key, val] of Object.entries(vars)) {
    if (isWin) {
      const r = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `[Environment]::SetEnvironmentVariable('${key}', '${val}', 'User')`,
        ],
        { encoding: "utf8" },
      );
      results.push({ key, val, ok: r.status === 0, err: r.stderr });
    } else {
      const profile = join(home, ".pos-env.sh");
      let content = existsSync(profile) ? readFileSync(profile, "utf8") : "# POS enforce env\n";
      const line = `export ${key}="${val}"`;
      if (!content.includes(line)) content += line + "\n";
      writeFileSync(profile, content, "utf8");
      results.push({ key, val, ok: true, profile });
    }
  }
  return results;
}

export function doctorStrict() {
  const lines = ["POS enforce doctor (strict)", ""];
  let ok = true;
  const manifest = loadEnforceConfig(home);

  lines.push(`Mode: ${manifest.mode} strict=${manifest.strict}`);
  if (manifest.mode !== "hard") {
    lines.push("FAIL: mode is not hard — run: pos enforce on");
    ok = false;
  }

  for (const f of ["CONSTITUTION.md", join("enforce", "gateway.mjs"), join("enforce", "inject.mjs")]) {
    const p = join(manifest.posRoot, f);
    const exists = existsSync(p);
    lines.push(`${exists ? "ok" : "FAIL"} ${f}`);
    if (!exists) ok = false;
  }

  if (!existsSync(manifest.routerPath)) {
    lines.push("FAIL PROMPT-ROUTER.md");
    ok = false;
  } else lines.push("ok PROMPT-ROUTER.md");

  const hooksJson = join(home, ".cursor", "hooks.json");
  if (existsSync(hooksJson)) {
    const h = JSON.parse(readFileSync(hooksJson, "utf8"));
    const hasHook = h.hooks?.beforeSubmitPrompt?.some((x) => /before-submit-prompt/.test(x.command || ""));
    lines.push(`${hasHook ? "ok" : "FAIL"} cursor beforeSubmitPrompt hook`);
    if (!hasHook) ok = false;
  } else {
    lines.push("WARN cursor hooks.json missing");
  }

  // Gateway health
  try {
    const res = spawnSync(
      "node",
      ["-e", "fetch('http://127.0.0.1:8555/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j))).catch(e=>process.exit(1))"],
      { encoding: "utf8", timeout: 3000, shell: isWin },
    );
    if (res.status === 0) lines.push(`ok gateway ${res.stdout.trim()}`);
    else {
      lines.push("WARN gateway not running — start: pos gateway");
    }
  } catch {
    lines.push("WARN gateway not reachable");
  }

  lines.push("");
  lines.push(ok ? "STRICT: pass" : "STRICT: fail");
  return { ok, lines };
}

function cmdOn() {
  const manifest = writeEnforceManifest("hard");
  const hooks = installEnforceHooks();
  const env = setUserEnvVars(manifest);
  process.stdout.write("POS enforce ON (hard mode)\n\n");
  process.stdout.write(`  manifest: ${manifestPath()}\n`);
  process.stdout.write(`  cursor hook: ${hooks.cursor || "skipped"}\n`);
  for (const e of env) process.stdout.write(`  env ${e.key}=${e.val} ${e.ok ? "ok" : "FAIL"}\n`);
  process.stdout.write("\nStart gateway: pos gateway\n");
  process.stdout.write("Verify: pos enforce doctor --strict\n");
}

function cmdOff() {
  writeEnforceManifest("soft");
  process.stdout.write("POS enforce OFF (soft mode — wiring only)\n");
}

function cmdStatus() {
  const p = manifestPath();
  const m = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { mode: "none" };
  process.stdout.write(JSON.stringify(m, null, 2) + "\n");
}

function cmdGateway() {
  const gatewayScript = join(posRoot(), "enforce", "gateway.mjs");
  spawnSync(process.execPath, [gatewayScript], { stdio: "inherit", env: { ...process.env, PROMPT_OS_ROOT: posRoot() } });
}

function main(argv) {
  const cmd = argv[0];
  switch (cmd) {
    case "on":
    case "install":
      cmdOn();
      break;
    case "off":
      cmdOff();
      break;
    case "status":
      cmdStatus();
      break;
    case "doctor":
      {
        const r = doctorStrict();
        process.stdout.write(r.lines.join("\n") + "\n");
        if (argv.includes("--strict")) process.exit(r.ok ? 0 : 1);
      }
      break;
    case "gateway":
      cmdGateway();
      break;
    default:
      process.stdout.write(`pos enforce — hard prompt routing

  pos enforce on          Enable hard mode + hooks + env vars
  pos enforce off         Revert to soft (wiring-only)
  pos enforce status      Show ENFORCE.json
  pos enforce doctor      Verify rings (--strict exits 1 on fail)
  pos enforce gateway     Start mandatory gateway on :8555

`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}

export { main as enforceMain };
