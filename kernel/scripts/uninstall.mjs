#!/usr/bin/env node
/**
 * Remove Prompt OS OS-level wiring — no PowerShell, no cmd flash.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PROFILE_MARKER } from "./os-wire.mjs";

const home = homedir();
const isWin = platform() === "win32";
const isLinux = platform() === "linux";
const isDarwin = platform() === "darwin";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", windowsHide: true });
}

export function removeCursorHook(homeDir = home) {
  const hooksJsonPath = join(homeDir, ".cursor", "hooks.json");
  if (existsSync(hooksJsonPath)) {
    try {
      const hooks = JSON.parse(readFileSync(hooksJsonPath, "utf8"));
      hooks.hooks = hooks.hooks || {};
      if (Array.isArray(hooks.hooks.beforeSubmitPrompt)) {
        hooks.hooks.beforeSubmitPrompt = hooks.hooks.beforeSubmitPrompt.filter(
          (h) => !/before-submit-prompt/.test(String(h.command || "")),
        );
        if (!hooks.hooks.beforeSubmitPrompt.length) delete hooks.hooks.beforeSubmitPrompt;
      }
      writeFileSync(hooksJsonPath, JSON.stringify(hooks, null, 2) + "\n", "utf8");
      log("  removed Cursor beforeSubmitPrompt hook");
    } catch {
      log("  WARN: could not edit ~/.cursor/hooks.json");
    }
  }
  const hookFile = join(homeDir, ".cursor", "hooks", "before-submit-prompt.mjs");
  if (existsSync(hookFile)) {
    unlinkSync(hookFile);
    log("  deleted before-submit-prompt.mjs");
  }
}

export function stopGatewayAutostart(homeDir = home) {
  if (isWin) {
    run("schtasks", ["/Delete", "/F", "/TN", "PromptOSGateway"]);
    log("  removed Windows scheduled task PromptOSGateway (if present)");
    return;
  }
  if (isLinux) {
    run("systemctl", ["--user", "stop", "prompt-os-gateway.service"]);
    run("systemctl", ["--user", "disable", "prompt-os-gateway.service"]);
    const unit = join(homeDir, ".config", "systemd", "user", "prompt-os-gateway.service");
    if (existsSync(unit)) unlinkSync(unit);
    run("systemctl", ["--user", "daemon-reload"]);
    log("  removed systemd user service (if present)");
    return;
  }
  if (isDarwin) {
    const plist = join(homeDir, "Library", "LaunchAgents", "com.prompt-os.gateway.plist");
    if (existsSync(plist)) {
      run("launchctl", ["bootout", `gui/${process.getuid()}`, plist]);
      unlinkSync(plist);
      log("  removed launchd agent");
    }
  }
}

export function stopGatewayProcesses() {
  if (isWin) {
    run("taskkill", ["/F", "/IM", "node.exe", "/FI", "WINDOWTITLE eq *gateway*"]);
  } else {
    run("pkill", ["-f", "prompt-os/enforce/gateway.mjs"]);
  }
  for (const pidFile of ["gateway.os.pid", "gateway.cloud.pid"]) {
    const p = join(home, ".agents", "prompt-os", pidFile);
    if (existsSync(p)) unlinkSync(p);
  }
}

export function clearWindowsUserEnv() {
  if (!isWin) return;
  for (const name of ["OPENAI_BASE_URL", "OPENAI_API_BASE", "OLLAMA_HOST", "PROMPT_OS_ROOT"]) {
    run("reg", ["delete", "HKCU\\Environment", "/v", name, "/f"]);
  }
  log("  cleared Windows user env vars (if present)");
}

export function stripPosProfileBlock(content, sourceLinePattern) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let skip = false;
  for (const line of lines) {
    if (line.includes(PROFILE_MARKER)) {
      skip = true;
      continue;
    }
    if (skip) {
      if (sourceLinePattern.test(line)) {
        skip = false;
      }
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + (out.length ? "\n" : "");
}

export function removeShellProfileWiring(homeDir = home) {
  if (isWin) {
    const block = `${PROFILE_MARKER}\n. "$env:USERPROFILE\\.pos-env.ps1"\n`;
    for (const rel of [
      join("Documents", "PowerShell", "profile.ps1"),
      join("Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"),
      join("Documents", "WindowsPowerShell", "profile.ps1"),
      join("Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1"),
    ]) {
      const p = join(homeDir, rel);
      if (!existsSync(p)) continue;
      let c = readFileSync(p, "utf8");
      if (!c.includes(PROFILE_MARKER)) continue;
      c = stripPosProfileBlock(c, /\.pos-env\.ps1/);
      writeFileSync(p, c, "utf8");
      log(`  cleaned ${rel}`);
    }
    return;
  }
  for (const name of [".bashrc", ".zshrc", ".profile"]) {
    const p = join(homeDir, name);
    if (!existsSync(p)) continue;
    if (!readFileSync(p, "utf8").includes(PROFILE_MARKER)) continue;
    writeFileSync(p, stripPosProfileBlock(readFileSync(p, "utf8"), /\.pos-env\.sh/), "utf8");
    log(`  cleaned ${name}`);
  }
}

export function uninstallPromptOs({ homeDir = home, removeKernel = true } = {}) {
  log("Uninstalling Prompt OS wiring…");
  stopGatewayProcesses();
  stopGatewayAutostart(homeDir);
  removeCursorHook(homeDir);
  removeShellProfileWiring(homeDir);
  clearWindowsUserEnv();

  const paths = [
    join(homeDir, ".cursor", "rules", "00-prompt-os.mdc"),
    join(homeDir, ".cursor", "skills", "possandbox"),
    join(homeDir, ".pos-env.sh"),
    join(homeDir, ".pos-env.ps1"),
    join(homeDir, ".config", "environment.d", "prompt-os.conf"),
  ];
  if (removeKernel) {
    paths.push(join(homeDir, ".agents", "prompt-os"), join(homeDir, ".agents", "router"));
  }
  for (const p of paths) {
    if (!existsSync(p)) continue;
    rmSync(p, { recursive: true, force: true });
    log(`  removed ${p.replace(homeDir, "~")}`);
  }

  log("Done. Restart Cursor.");
  return { ok: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  uninstallPromptOs();
}
