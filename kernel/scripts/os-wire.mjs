#!/usr/bin/env node
/**
 * OS-level Prompt OS wiring — shell profiles, login env, gateway autostart.
 * Ring 0 complement to gateway env vars: every shell + GUI session inherits POS routing.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export const PROFILE_MARKER = "# POS enforce env (managed by Prompt OS — do not edit)";
export const PROFILE_SOURCE_SH = '[ -f "$HOME/.pos-env.sh" ] && . "$HOME/.pos-env.sh"';

export function defaultEnvVars(posRoot) {
  return {
    OPENAI_BASE_URL: "http://127.0.0.1:8555/v1",
    OPENAI_API_BASE: "http://127.0.0.1:8555/v1",
    OLLAMA_HOST: "127.0.0.1:8555",
    PROMPT_OS_ROOT: posRoot,
  };
}

/** Write ~/.pos-env.sh or ~/.pos-env.ps1 with current gateway vars. */
export function writePosEnvFile(home, vars) {
  if (platform() === "win32") {
    const ps1 = join(home, ".pos-env.ps1");
    let content = "# POS enforce env\n";
    for (const [k, v] of Object.entries(vars)) {
      content += `$env:${k} = '${String(v).replace(/'/g, "''")}'\n`;
    }
    writeFileSync(ps1, content, "utf8");
    return ps1;
  }

  const sh = join(home, ".pos-env.sh");
  let content = existsSync(sh) ? readFileSync(sh, "utf8") : "# POS enforce env\n";
  if (!content.includes("# POS enforce env")) content = "# POS enforce env\n" + content;

  for (const [key, val] of Object.entries(vars)) {
    const line = `export ${key}="${val}"`;
    const re = new RegExp(`^export ${key}=.*$`, "m");
    content = re.test(content) ? content.replace(re, line) : content.trimEnd() + "\n" + line + "\n";
  }
  writeFileSync(sh, content, "utf8");
  return sh;
}

/** Append POS source block to a shell profile if missing. */
export function appendShellProfile(profilePath, sourceLine = PROFILE_SOURCE_SH) {
  const block = `${PROFILE_MARKER}\n${sourceLine}\n`;
  if (!existsSync(profilePath)) {
    writeFileSync(profilePath, block, "utf8");
    return { path: profilePath, status: "created", ok: true };
  }
  const content = readFileSync(profilePath, "utf8");
  if (content.includes(PROFILE_MARKER)) {
    return { path: profilePath, status: "ok", ok: true };
  }
  writeFileSync(profilePath, content.trimEnd() + "\n\n" + block, "utf8");
  return { path: profilePath, status: "wired", ok: true };
}

/** Source ~/.pos-env.sh from bash/zsh/login profiles (Unix). */
export function wireShellProfiles(home = homedir()) {
  const results = [];
  if (platform() === "win32") {
    const r = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `
$marker = '${PROFILE_MARKER.replace(/'/g, "''")}'
$line = '. "$env:USERPROFILE\\.pos-env.ps1"'
$profile = $PROFILE.CurrentUserAllHosts
$dir = Split-Path $profile -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
if (-not (Test-Path $profile)) { New-Item -ItemType File -Force $profile | Out-Null }
$c = Get-Content $profile -Raw -ErrorAction SilentlyContinue
if ($null -eq $c) { $c = '' }
if ($c -notmatch [regex]::Escape($marker)) {
  Add-Content $profile ("\\n" + $marker + "\\n" + $line + "\\n")
}
`,
      ],
      { encoding: "utf8" },
    );
    results.push({
      component: "powershell-profile",
      status: r.status === 0 ? "wired" : "warn",
      detail: r.stderr?.trim() || "CurrentUserAllHosts",
      ok: r.status === 0,
    });
    return results;
  }

  for (const name of [".bashrc", ".zshrc", ".profile"]) {
    const r = appendShellProfile(join(home, name));
    results.push({ component: `shell:${name}`, ...r });
  }
  return results;
}

/** systemd user environment.d — picked up at graphical login on many distros. */
export function wireLinuxEnvironmentD(home, vars) {
  if (platform() !== "linux") {
    return { component: "environment.d", status: "skipped", ok: true };
  }
  const dir = join(home, ".config", "environment.d");
  mkdirSync(dir, { recursive: true });
  const conf = join(dir, "prompt-os.conf");
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(conf, body + "\n", "utf8");
  return { component: "environment.d", status: "wired", detail: conf, ok: true };
}

function systemdUnitContent({ node, gw, posRoot }) {
  return `[Unit]
Description=Prompt OS gateway (OpenAI/Ollama proxy on :8555)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${node} ${gw}
Restart=always
RestartSec=3
Environment=PROMPT_OS_ROOT=${posRoot}

[Install]
WantedBy=default.target
`;
}

function launchdPlistContent({ node, gw, posRoot, home }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.prompt-os.gateway</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${gw}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PROMPT_OS_ROOT</key>
    <string>${posRoot}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(home, ".agents", "prompt-os", "gateway.launchd.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(home, ".agents", "prompt-os", "gateway.launchd.err.log")}</string>
</dict>
</plist>
`;
}

/** Install and enable systemd user unit (Linux). */
export function installSystemdGatewayService(home, posRoot) {
  if (platform() !== "linux") {
    return { component: "systemd", status: "skipped", ok: true };
  }
  const node = process.execPath;
  const gw = join(posRoot, "enforce", "gateway.mjs");
  if (!existsSync(gw)) {
    return { component: "systemd", status: "error", detail: "gateway.mjs missing", ok: false };
  }

  const unitDir = join(home, ".config", "systemd", "user");
  mkdirSync(unitDir, { recursive: true });
  const unitPath = join(unitDir, "prompt-os-gateway.service");
  writeFileSync(unitPath, systemdUnitContent({ node, gw, posRoot }), "utf8");

  const reload = spawnSync("systemctl", ["--user", "daemon-reload"], { encoding: "utf8" });
  const enable = spawnSync("systemctl", ["--user", "enable", "prompt-os-gateway.service"], {
    encoding: "utf8",
  });
  const start = spawnSync("systemctl", ["--user", "start", "prompt-os-gateway.service"], {
    encoding: "utf8",
  });

  const ok = reload.status === 0 && existsSync(unitPath);
  return {
    component: "systemd",
    status: ok ? "wired" : "partial",
    detail: unitPath,
    enabled: enable.status === 0,
    started: start.status === 0,
    ok,
  };
}

/** Install launchd agent (macOS). */
export function installLaunchdGatewayAgent(home, posRoot) {
  if (platform() !== "darwin") {
    return { component: "launchd", status: "skipped", ok: true };
  }
  const node = process.execPath;
  const gw = join(posRoot, "enforce", "gateway.mjs");
  if (!existsSync(gw)) {
    return { component: "launchd", status: "error", detail: "gateway.mjs missing", ok: false };
  }

  const agentsDir = join(home, "Library", "LaunchAgents");
  mkdirSync(agentsDir, { recursive: true });
  const plistPath = join(agentsDir, "com.prompt-os.gateway.plist");
  writeFileSync(plistPath, launchdPlistContent({ node, gw, posRoot, home }), "utf8");

  spawnSync("launchctl", ["bootout", `gui/${process.getuid()}`, plistPath], { encoding: "utf8" });
  const load = spawnSync("launchctl", ["bootstrap", `gui/${process.getuid()}`, plistPath], {
    encoding: "utf8",
  });

  return {
    component: "launchd",
    status: load.status === 0 ? "wired" : "partial",
    detail: plistPath,
    ok: existsSync(plistPath),
  };
}

/** Windows logon task to start gateway. */
export function installWindowsGatewayTask(home, posRoot) {
  if (platform() !== "win32") {
    return { component: "schtasks", status: "skipped", ok: true };
  }
  const node = process.execPath.replace(/\\/g, "\\\\");
  const gw = join(posRoot, "enforce", "gateway.mjs").replace(/\\/g, "\\\\");
  const taskName = "PromptOSGateway";
  const tr = `cmd /c start /min "" "${process.execPath}" "${join(posRoot, "enforce", "gateway.mjs")}"`;
  const r = spawnSync(
    "schtasks",
    [
      "/Create",
      "/F",
      "/SC",
      "ONLOGON",
      "/TN",
      taskName,
      "/TR",
      tr,
      "/RL",
      "LIMITED",
    ],
    { encoding: "utf8" },
  );
  return {
    component: "schtasks",
    status: r.status === 0 ? "wired" : "warn",
    detail: taskName,
    ok: r.status === 0,
  };
}

export function gatewayHealthy(timeoutMs = 2000) {
  try {
    const r = spawnSync(
      process.execPath,
      [
        "-e",
        `fetch('http://127.0.0.1:8555/health',{signal:AbortSignal.timeout(${timeoutMs})}).then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))`,
      ],
      { encoding: "utf8", timeout: timeoutMs + 500 },
    );
    return r.status === 0;
  } catch {
    return false;
  }
}

/** Nohup fallback when systemd/launchd unavailable (matches cloud-start.sh). */
export function startGatewayFallback(home, posRoot) {
  if (gatewayHealthy()) {
    return { component: "gateway", status: "ok", detail: "already healthy on :8555", ok: true };
  }

  const gw = join(posRoot, "enforce", "gateway.mjs");
  if (!existsSync(gw)) {
    return { component: "gateway", status: "error", detail: "gateway.mjs missing", ok: false };
  }

  const log = join(posRoot, "gateway.os.log");
  const pidfile = join(posRoot, "gateway.os.pid");

  if (platform() !== "win32") {
    spawnSync(
      "sh",
      ["-c", `nohup "${process.execPath}" "${gw}" >>"${log}" 2>&1 & echo $! > "${pidfile}"`],
      { encoding: "utf8", env: { ...process.env, PROMPT_OS_ROOT: posRoot } },
    );
  } else {
    spawnSync(
      process.execPath,
      [gw],
      {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, PROMPT_OS_ROOT: posRoot },
      },
    );
  }

  for (let i = 0; i < 20; i++) {
    if (gatewayHealthy(500)) {
      return { component: "gateway", status: "started", detail: ":8555", ok: true };
    }
    spawnSync("node", ["-e", "setTimeout(()=>{},250)"], { encoding: "utf8" });
  }

  return { component: "gateway", status: "warn", detail: `not healthy — see ${log}`, ok: false };
}

/** Full OS-level wiring: env file, profiles, login env, autostart service, gateway up. */
export function wireOsLevel({ home = homedir(), posRoot }) {
  const vars = defaultEnvVars(posRoot);
  const envFile = writePosEnvFile(home, vars);
  const results = [{ component: "pos-env", status: "wired", detail: envFile, ok: true }];

  results.push(...wireShellProfiles(home));
  results.push(wireLinuxEnvironmentD(home, vars));

  const service =
    platform() === "linux"
      ? installSystemdGatewayService(home, posRoot)
      : platform() === "darwin"
        ? installLaunchdGatewayAgent(home, posRoot)
        : installWindowsGatewayTask(home, posRoot);
  results.push(service);

  if (gatewayHealthy()) {
    results.push({ component: "gateway", status: "ok", detail: "healthy on :8555", ok: true });
  } else {
    results.push(startGatewayFallback(home, posRoot));
  }

  return results;
}

/** Doctor checks for OS-level rings. */
export function doctorOsLevel(home = homedir(), posRoot) {
  const lines = [];
  let ok = true;
  const plat = platform();

  if (plat === "win32") {
    const ps1 = join(home, ".pos-env.ps1");
    lines.push(`${existsSync(ps1) ? "ok" : "FAIL"} ~/.pos-env.ps1`);
    if (!existsSync(ps1)) ok = false;
  } else {
    const sh = join(home, ".pos-env.sh");
    lines.push(`${existsSync(sh) ? "ok" : "FAIL"} ~/.pos-env.sh`);
    if (!existsSync(sh)) ok = false;

    let profileOk = false;
    for (const name of [".bashrc", ".zshrc", ".profile"]) {
      const p = join(home, name);
      if (existsSync(p) && readFileSync(p, "utf8").includes(PROFILE_MARKER)) profileOk = true;
    }
    lines.push(`${profileOk ? "ok" : "FAIL"} shell profile sources POS env`);
    if (!profileOk) ok = false;

    if (plat === "linux") {
      const envd = join(home, ".config", "environment.d", "prompt-os.conf");
      lines.push(`${existsSync(envd) ? "ok" : "FAIL"} environment.d/prompt-os.conf`);
      if (!existsSync(envd)) ok = false;

      const unit = join(home, ".config", "systemd", "user", "prompt-os-gateway.service");
      lines.push(`${existsSync(unit) ? "ok" : "FAIL"} systemd user unit`);
      if (!existsSync(unit)) ok = false;
    }

    if (plat === "darwin") {
      const plist = join(home, "Library", "LaunchAgents", "com.prompt-os.gateway.plist");
      lines.push(`${existsSync(plist) ? "ok" : "FAIL"} launchd agent`);
      if (!existsSync(plist)) ok = false;
    }
  }

  if (gatewayHealthy()) lines.push("ok gateway health :8555");
  else {
    lines.push("WARN gateway not healthy on :8555");
  }

  return { ok, lines };
}
