# Installation System Design

## Overview

The installation system must:
1. Work on Windows (PowerShell), macOS (bash), and Linux (bash)
2. Auto-detect ALL IDEs and CLIs on the system
3. Integrate community skills from VibeSetup
4. Set up the local LLM hub with role-based routing
5. Migrate existing Outcome OS installations
6. Validate installation after completion
7. Support --force, --with-hub, --dry-run flags
8. Create backup of existing installations

## Platform-Specific Entry Points

### Windows (PowerShell)

**File:** `install.ps1`

```powershell
# Prompt OS — one-command install (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Repo = if ($env:PROMPT_OS_REPO) { $env:PROMPT_OS_REPO } else { "https://github.com/youtextme/prompt-operating-system.git" }
$Branch = if ($env:PROMPT_OS_BRANCH) { $env:PROMPT_OS_BRANCH } else { "main" }
$Tmp = Join-Path $env:TEMP ("pos-install-" + [guid]::NewGuid().ToString("n"))

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20+ required. Install from https://nodejs.org/"
    exit 1
}

New-Item -ItemType Directory -Path $Tmp -Force | Out-Null
try {
    # Try git clone first
    git clone --depth 1 --branch $Branch $Repo (Join-Path $Tmp "repo") 2>$null
    if ($LASTEXITCODE -eq 0) {
        node (Join-Path $Tmp "repo\install.mjs") @args
    } else {
        # Fallback to zip download
        $Zip = Join-Path $Tmp "repo.zip"
        Invoke-WebRequest -Uri "https://github.com/youtextme/prompt-operating-system/archive/refs/heads/$Branch.zip" -OutFile $Zip
        Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
        $Extracted = Get-ChildItem $Tmp -Directory | Where-Object { $_.Name -like "prompt-operating-system*" } | Select-Object -First 1
        node (Join-Path $Extracted.FullName "install.mjs") @args
    }
} finally {
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
```

### macOS/Linux (Bash)

**File:** `install.sh`

```bash
#!/bin/bash
# Prompt OS — one-command install (macOS/Linux)
set -euo pipefail

REPO="${PROMPT_OS_REPO:-https://github.com/youtextme/prompt-operating-system.git}"
BRANCH="${PROMPT_OS_BRANCH:-main}"
TMP=$(mktemp -d)

cleanup() {
    rm -rf "$TMP"
}
trap cleanup EXIT

if ! command -v node &> /dev/null; then
    echo "Node.js 20+ required. Install from https://nodejs.org/"
    exit 1
fi

cd "$TMP"
# Try git clone first
if git clone --depth 1 --branch "$BRANCH" "$REPO" repo 2>/dev/null; then
    node repo/install.mjs "$@"
else
    # Fallback to zip download
    curl -fsSL "https://github.com/youtextme/prompt-operating-system/archive/refs/heads/$BRANCH.zip" -o repo.zip
    unzip -q repo.zip
    cd prompt-operating-system-*
    node install.mjs "$@"
fi
```

### Universal (Node.js)

**File:** `install.mjs`

This is the core installer that both platform scripts call.

## Auto-Detection Logic

### Platform Detection

```javascript
import { platform, homedir } from "node:os";

const isWin = platform() === "win32";
const isMac = platform() === "darwin";
const isLinux = platform() === "linux";
const home = homedir();
```

### Tool Path Detection

```javascript
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
  cursor_rules: join(home, ".cursor", "rules"),
  vscode_settings: join(home, isWin ? "AppData/Roaming/Code/User" : ".config/Code/User", "settings.json"),
};
```

### Detection Function

```javascript
function detectTools(home = homedir()) {
  const tools = [
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

  return tools.filter(t => t.detected);
}
```

## Wiring Logic

### Cursor

**Mechanism:** `.cursor/rules/00-prompt-os.mdc`

```javascript
function wireCursor({ home, posRoot, routerPath }) {
  const rulesDir = join(home, ".cursor", "rules");
  const rulePath = join(rulesDir, "00-prompt-os.mdc");

  mkdirSync(rulesDir, { recursive: true });
  writeFileSync(rulePath, cursorRule(routerPath), "utf8");

  // Also copy agent roles
  const agentsDir = join(home, ".cursor", "agents");
  mkdirSync(agentsDir, { recursive: true });

  const roles = ["researcher", "experimenter", "builder", "evaluator"];
  for (const role of roles) {
    const src = join(posRoot, "kernel", "roles", `${role}.md`);
    const dest = join(agentsDir, `${role}.md`);
    if (existsSync(src)) {
      writeFileSync(dest, readFileSync(src, "utf8"), "utf8");
    }
  }

  return { tool: "cursor", status: "wired", detail: rulePath };
}

function cursorRule(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action in a session. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence.

## Mandatory Skills

Load these skills for non-trivial builds:
- outcome-os (contract-based building)
- recruit (staffing protocol)
- bar-raiser (quality gate)

## Hooks

- session-start: Load constitution
- stop: Run evidence-check before claiming done
`;
}
```

### VS Code

**Mechanism:** `copilot-instructions.md`

```javascript
function wireVSCode({ home, routerPath }) {
  const instructionsPath = join(home, isWin ? "AppData/Roaming/Code/User" : ".config/Code/User", "copilot-instructions.md");

  writeFileSync(instructionsPath, vscodeInstruction(routerPath), "utf8");

  return { tool: "vscode", status: "wired", detail: instructionsPath };
}

function vscodeInstruction(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. This defines how every prompt is processed through outcome contracts and verification.

## Classification

- Trivial (Q&A, rename, one-line fix): answer directly
- Non-trivial (new capability, multi-file change): run contract pipeline

## Verification

All non-trivial work requires:
- Falsifiable North Star metric
- Outcome contract
- Evidence with command receipts
- Independent evaluation
`;
}
```

### opencode

**Mechanism:** `instructions` in config.json

```javascript
function wireOpenCode({ home, routerPath }) {
  const configDir = existsSync(join(home, "AppData/Roaming/opencode"))
    ? join(home, "AppData/Roaming/opencode")
    : join(home, ".config/opencode");

  const configPath = join(configDir, "opencode.jsonc");

  let config = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  }

  config.instructions = config.instructions || [];
  if (!config.instructions.includes(routerPath)) {
    config.instructions.unshift(routerPath);
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  return { tool: "opencode", status: "wired", detail: configPath };
}
```

### Claude Code

**Mechanism:** `~/.claude/CLAUDE.md`

```javascript
function wireClaude({ home, routerPath }) {
  const claudeDir = join(home, ".claude");
  mkdirSync(claudeDir, { recursive: true });

  const claudePath = join(claudeDir, "CLAUDE.md");
  writeFileSync(claudePath, claudeInstruction(routerPath), "utf8");

  return { tool: "claude", status: "wired", detail: claudePath };
}

function claudeInstruction(routerPath) {
  return `# Prompt Router

Read and obey \`${routerPath}\` before any task. Same pipeline as every agent on this machine (Outcome OS constitution, shared skills, capped loops, evidence-based done).
`;
}
```

### OpenClaw

**Mechanism:** `workspace/AGENTS.md`

```javascript
function wireOpenClaw({ home, routerPath }) {
  const openclawDir = join(home, ".openclaw");
  mkdirSync(openclawDir, { recursive: true });

  const agentsPath = join(openclawDir, "AGENTS.md");
  writeFileSync(agentsPath, openClawInstruction(routerPath), "utf8");

  return { tool: "openclaw", status: "wired", detail: agentsPath };
}

function openClawInstruction(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. This loads the Outcome OS constitution, classifies trivial vs non-trivial tasks, and routes to contract-based building with evidence verification.

## Rules

- Non-trivial tasks require outcome contracts
- Load outcome-os skill for builds
- Cap loops at 12 iterations
- Never self-grade work
`;
}
```

### Windsurf

**Mechanism:** `.codeium/windsurf/rules/00-prompt-os.md`

```javascript
function wireWindsurf({ home, routerPath }) {
  const rulesDir = join(home, ".codeium", "windsurf", "rules");
  mkdirSync(rulesDir, { recursive: true });

  const rulePath = join(rulesDir, "00-prompt-os.md");
  writeFileSync(rulePath, windsurfRule(routerPath), "utf8");

  return { tool: "windsurf", status: "wired", detail: rulePath };
}

function windsurfRule(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence.
`;
}
```

### Continue

**Mechanism:** System message in config.json

```javascript
function wireContinue({ home, routerPath }) {
  const continueDir = join(home, ".continue");
  if (!existsSync(continueDir)) {
    return { tool: "continue", status: "not-detected", detail: "Continue not installed" };
  }

  const configPath = join(continueDir, "config.json");
  let config = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, "utf8"));
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
```

### Devin

**Mechanism:** `.devin/rules/00-prompt-os.mdc` + superpowers plugin

```javascript
function wireDevin({ home, routerPath }) {
  const devinDir = join(home, ".devin");
  if (!existsSync(devinDir)) {
    return { tool: "devin", status: "not-detected", detail: "Devin not installed" };
  }

  const rulesDir = join(devinDir, "rules");
  mkdirSync(rulesDir, { recursive: true });

  const rulePath = join(rulesDir, "00-prompt-os.mdc");
  writeFileSync(rulePath, devinRule(routerPath), "utf8");

  // Note: superpowers plugin is installed separately via devin plugins install
  return { tool: "devin", status: "wired", detail: rulePath };
}

function devinRule(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. It loads the constitution, classifies trivial vs non-trivial, and routes to contracts + machine-enforced evidence.

## Required Plugins

Install superpowers plugin for methodology:
\`devin plugins install obra/superpowers\`
`;
}
```

## Community Skills Integration

### Skills to Clone

```javascript
const skills = [
  {
    name: "superpowers",
    repo: "https://github.com/obra/superpowers.git",
    version: "6.3.0", // specific tag/commit
    type: "methodology",
  },
  {
    name: "agent-skills",
    repo: "https://github.com/addyosmani/agent-skills.git",
    version: "latest",
    type: "production",
  },
  {
    name: "grill-me",
    repo: "https://github.com/mattpocock/skills.git",
    version: "latest",
    type: "clarification",
  },
  {
    name: "anthropic-skills",
    repo: "https://github.com/anthropics/skills.git",
    version: "latest",
    type: "design",
  },
  {
    name: "ralph",
    repo: "https://github.com/snarktank/ralph.git",
    version: "latest",
    type: "loop",
  },
  {
    name: "app-store-review",
    repo: "https://github.com/safaiyeh/app-store-review-skill.git",
    version: "latest",
    type: "audit",
  },
  {
    name: "ccusage",
    repo: "https://github.com/ccusage/ccusage.git",
    version: "latest",
    type: "monitoring",
  },
];
```

### Installation Function

```javascript
async function installSkills(skillsDir) {
  const communityDir = join(skillsDir, "community");
  mkdirSync(communityDir, { recursive: true });

  const results = [];

  for (const skill of skills) {
    const skillDir = join(communityDir, skill.name);
    try {
      if (existsSync(skillDir)) {
        results.push({ skill: skill.name, status: "already-installed", detail: skillDir });
        continue;
      }

      const tmpDir = join(skillsDir, `.tmp-${skill.name}`);
      mkdirSync(tmpDir, { recursive: true });

      // Clone with depth 1 for speed
      const cloneCmd = `git clone --depth 1 ${skill.repo} ${tmpDir}`;
      await exec(cloneCmd);

      // Move to final location
      renameSync(tmpDir, skillDir);

      // Create skill manifest
      const manifest = {
        name: skill.name,
        repo: skill.repo,
        version: skill.version,
        type: skill.type,
        installedAt: new Date().toISOString(),
      };
      writeFileSync(join(skillDir, "skill-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

      results.push({ skill: skill.name, status: "installed", detail: skillDir });
    } catch (err) {
      results.push({ skill: skill.name, status: "error", detail: String(err.message) });
    }
  }

  return results;
}
```

### Conflict Resolution

**File:** `skills/skill-loader.mjs`

```javascript
const conflictRules = {
  methodology: ["superpowers", "grill-me"], // Only one methodology skill
  // Other types don't conflict
};

function resolveConflicts(requestedSkills) {
  const byType = {};
  for (const skill of requestedSkills) {
    const type = skill.type || "general";
    byType[type] = byType[type] || [];
    byType[type].push(skill);
  }

  const resolved = [];
  for (const [type, skillsOfType] of Object.entries(byType)) {
    if (conflictRules[type]) {
      // Only keep the first one (priority)
      resolved.push(skillsOfType[0]);
      // Log conflicts
      for (let i = 1; i < skillsOfType.length; i++) {
        console.warn(`Conflict: Skipping ${skillsOfType[i].name} in favor of ${skillsOfType[0].name} (type: ${type})`);
      }
    } else {
      resolved.push(...skillsOfType);
    }
  }

  return resolved;
}
```

## Local LLM Hub Installation

### Prerequisites Check

```javascript
async function checkOllama() {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (response.ok) {
      const data = await response.json();
      return { available: true, models: data.models || [] };
    }
    return { available: false, error: "Ollama not responding" };
  } catch (err) {
    return { available: false, error: String(err.message) };
  }
}
```

### Hub Installation

```javascript
async function installHub(posRoot) {
  const hubSrc = join(process.cwd(), "hub");
  const hubDest = join(posRoot, "hub");

  if (!existsSync(hubSrc)) {
    return { status: "skipped", detail: "Hub source not found in repo" };
  }

  // Check Ollama
  const ollamaCheck = await checkOllama();
  if (!ollamaCheck.available) {
    return { status: "warning", detail: `Ollama not available: ${ollamaCheck.error}. Hub installed but requires Ollama.` };
  }

  // Copy hub files
  mkdirSync(hubDest, { recursive: true });
  cpSync(hubSrc, hubDest, { recursive: true, force: true });

  // Install dependencies
  const hubPackageJson = join(hubDest, "package.json");
  if (existsSync(hubPackageJson)) {
    await exec("npm install", { cwd: hubDest });
  }

  return { status: "installed", detail: `Hub installed at ${hubDest}. Start with: node ${join(hubDest, "server.mjs")}` };
}
```

## Migration from Legacy

### Legacy Detection

```javascript
function detectLegacy(home) {
  const legacyPaths = {
    outcomeOs: join(home, ".agents", "outcome-os"),
    promptOs: join(home, ".agents", "prompt-os"),
    cursorRules: join(home, ".cursor", "rules", "00-outcome-os.mdc"),
  };

  const detected = {};
  for (const [name, path] of Object.entries(legacyPaths)) {
    detected[name] = existsSync(path);
  }

  return detected;
}
```

### Migration Process

```javascript
async function migrateLegacy(home, posRoot, routerPath) {
  const legacy = detectLegacy(home);
  const migrated = [];

  // Migrate outcome-os if present
  if (legacy.outcomeOs) {
    const legacyRoot = join(home, ".agents", "outcome-os");

    // Migrate contracts
    const contractsSrc = join(legacyRoot, "contracts");
    const contractsDest = join(posRoot, "contracts");
    if (existsSync(contractsSrc)) {
      mkdirSync(contractsDest, { recursive: true });
      cpSync(contractsSrc, contractsDest, { recursive: true, force: true });
      migrated.push("contracts");
    }

    // Migrate evolve
    const evolveSrc = join(legacyRoot, "evolve");
    const evolveDest = join(posRoot, "evolve");
    if (existsSync(evolveSrc)) {
      mkdirSync(evolveDest, { recursive: true });
      cpSync(evolveSrc, evolveDest, { recursive: true, force: true });
      migrated.push("evolve");
    }

    // Migrate audit
    const auditSrc = join(legacyRoot, "audit");
    const auditDest = join(posRoot, "audit");
    if (existsSync(auditSrc)) {
      mkdirSync(auditDest, { recursive: true });
      cpSync(auditSrc, auditDest, { recursive: true, force: true });
      migrated.push("audit");
    }

    // Write migration marker
    const marker = join(legacyRoot, "MIGRATED-TO-PROMPT-OS.txt");
    writeFileSync(
      marker,
      `Migrated to ${posRoot} on ${new Date().toISOString()}\n` +
        `Router: ${routerPath}\n` +
        `Migrated: ${migrated.join(", ")}\n`,
      "utf8",
    );
  }

  return migrated;
}
```

## Validation Procedures

### Doctor Command

**File:** `bin/pos.mjs`

```javascript
#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();
const posRoot = join(home, ".agents", "prompt-os");
const routerPath = join(home, ".agents", "router", "PROMPT-ROUTER.md");

const checks = [
  {
    name: "Router file",
    check: () => existsSync(routerPath),
    path: routerPath,
  },
  {
    name: "Constitution",
    check: () => existsSync(join(posRoot, "CONSTITUTION.md")),
    path: join(posRoot, "CONSTITUTION.md"),
  },
  {
    name: "Contracts directory",
    check: () => existsSync(join(posRoot, "contracts")),
    path: join(posRoot, "contracts"),
  },
  {
    name: "Scripts directory",
    check: () => existsSync(join(posRoot, "kernel", "scripts")),
    path: join(posRoot, "kernel", "scripts"),
  },
  {
    name: "Skills directory",
    check: () => existsSync(join(posRoot, "skills")),
    path: join(posRoot, "skills"),
  },
  {
    name: "Wiring manifest",
    check: () => existsSync(join(posRoot, "WIRING.json")),
    path: join(posRoot, "WIRING.json"),
  },
];

console.log("Prompt OS Health Check\n");

let allPassed = true;
for (const check of checks) {
  const passed = check.check();
  const status = passed ? "✓" : "✗";
  console.log(`${status} ${check.name}: ${passed ? "OK" : "MISSING"}`);
  if (!passed) {
    console.log(`  Expected: ${check.path}`);
    allPassed = false;
  }
}

// Check wiring
if (existsSync(join(posRoot, "WIRING.json"))) {
  console.log("\nWired tools:");
  const wiring = JSON.parse(readFileSync(join(posRoot, "WIRING.json"), "utf8"));
  for (const tool of wiring.tools || []) {
    const status = tool.status === "wired" ? "✓" : "!";
    console.log(`${status} ${tool.tool}: ${tool.status} — ${tool.detail}`);
  }
}

// Check hub if installed
if (existsSync(join(posRoot, "hub"))) {
  console.log("\nLocal LLM Hub:");
  try {
    const response = await fetch("http://localhost:8555/health");
    if (response.ok) {
      console.log("✓ Hub running at http://localhost:8555");
    } else {
      console.log("! Hub not responding");
    }
  } catch {
    console.log("! Hub not running");
  }
}

process.exit(allPassed ? 0 : 1);
```

## Error Handling and Rollback

### Backup System

```javascript
function createBackup(home) {
  const timestamp = Date.now();
  const backupRoot = join(home, ".agents", `.backup-${timestamp}`);
  mkdirSync(backupRoot, { recursive: true });

  const pathsToBackup = [
    join(home, ".agents", "prompt-os"),
    join(home, ".agents", "router"),
    join(home, ".cursor", "rules", "00-prompt-os.mdc"),
    join(home, ".claude", "CLAUDE.md"),
  ];

  for (const path of pathsToBackup) {
    if (existsSync(path)) {
      const rel = path.replace(home + (isWin ? "\\" : "/"), "").replace(/\\/g, "/");
      const dest = join(backupRoot, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(path, dest, { recursive: true, force: true });
    }
  }

  return backupRoot;
}
```

### Rollback Function

```javascript
function rollback(home, backupRoot) {
  if (!existsSync(backupRoot)) {
    console.error("Backup not found, cannot rollback");
    return false;
  }

  // Restore from backup
  cpSync(backupRoot, join(home, ".agents"), { recursive: true, force: true });

  // Restore tool-specific files
  const rulesBackup = join(backupRoot, ".cursor", "rules", "00-prompt-os.mdc");
  if (existsSync(rulesBackup)) {
    cpSync(rulesBackup, join(home, ".cursor", "rules", "00-prompt-os.mdc"), { force: true });
  }

  console.log(`Rolled back from ${backupRoot}`);
  return true;
}
```

## Installation Flow

### Main Installation Function

```javascript
async function install({ force = false, withHub = false, dryRun = false }) {
  console.log("Prompt OS installer v2.0.0");

  const home = homedir();
  const agentsRoot = join(home, ".agents");
  const posRoot = join(agentsRoot, "prompt-os");
  const routerDir = join(agentsRoot, "router");
  const routerPath = join(routerDir, "PROMPT-ROUTER.md");

  // Check for existing install
  if (existsSync(join(posRoot, "INSTALL.json")) && !force) {
    const manifest = JSON.parse(readFileSync(join(posRoot, "INSTALL.json"), "utf8"));
    console.log(`Existing install from ${manifest.installedAt}. Use --force to replace.`);
    return;
  }

  if (dryRun) {
    console.log("[dry-run] Would install kernel and wire tools");
    return;
  }

  // Create backup if force
  if (force && existsSync(posRoot)) {
    const backupRoot = createBackup(home);
    console.log(`Backed up to ${backupRoot}`);
  }

  // Copy kernel
  console.log("Copying kernel...");
  copyKernel(posRoot, routerPath);

  // Migrate legacy
  console.log("Migrating legacy installations...");
  const migrated = await migrateLegacy(home, posRoot, routerPath);
  if (migrated.length > 0) {
    console.log(`Migrated: ${migrated.join(", ")}`);
  }

  // Install community skills
  console.log("Installing community skills...");
  const skillsDir = join(posRoot, "skills");
  const skillResults = await installSkills(skillsDir);
  for (const result of skillResults) {
    console.log(`  ${result.skill}: ${result.status}`);
  }

  // Install hub if requested
  if (withHub) {
    console.log("Installing local LLM hub...");
    const hubResult = await installHub(posRoot);
    console.log(`  Hub: ${hubResult.status} — ${hubResult.detail}`);
  }

  // Wire tools
  console.log("Wiring IDEs and CLIs...");
  const wired = await wireAll({ home, posRoot, routerPath });
  for (const w of wired) {
    console.log(`  ${w.tool}: ${w.status} — ${w.detail}`);
  }

  // Write manifest
  const manifest = {
    version: "2.0.0",
    installedAt: new Date().toISOString(),
    posRoot,
    router: routerPath,
    platform: platform(),
    wired,
    withHub,
  };
  writeFileSync(join(posRoot, "INSTALL.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log("\n✓ Prompt OS installed");
  console.log(`  Kernel:  ${posRoot}`);
  console.log(`  Router:  ${routerPath}`);
  console.log(`  Doctor:  node ${join(posRoot, "bin", "pos.mjs")} doctor`);
}
```

## Command-Line Interface

### Flag Parsing

```javascript
const argv = process.argv.slice(2);
const force = argv.includes("--force");
const withHub = argv.includes("--with-hub");
const dryRun = argv.includes("--dry-run");
const help = argv.includes("--help") || argv.includes("-h");

if (help) {
  console.log(`
Prompt OS Installer

Usage: node install.mjs [options]

Options:
  --force    Replace existing install (backs up to ~/.agents/.backup-*)
  --with-hub Install local LLM hub on port 8555 (Ollama required)
  --dry-run  Show plan without writing
  --help     Show this help message

Examples:
  node install.mjs
  node install.mjs --force
  node install.mjs --with-hub
  node install.mjs --dry-run
  `);
  process.exit(0);
}
```

## Post-Installation Verification

### Automated Tests

```javascript
async function runTests(posRoot) {
  const tests = [
    {
      name: "Router exists",
      test: () => existsSync(join(posRoot, "router", "PROMPT-ROUTER.md")),
    },
    {
      name: "Constitution valid",
      test: () => {
        const constitution = readFileSync(join(posRoot, "CONSTITUTION.md"), "utf8");
        return constitution.length <= 2000; // Reasonable size
      },
    },
    {
      name: "Scripts executable",
      test: async () => {
        const result = await exec("node kernel/scripts/evidence-check.mjs --help", { cwd: posRoot });
        return result.exitCode === 0;
      },
    },
  ];

  const results = [];
  for (const test of tests) {
    try {
      const passed = await test.test();
      results.push({ name: test.name, passed });
    } catch (err) {
      results.push({ name: test.name, passed: false, error: String(err.message) });
    }
  }

  return results;
}
```

## Summary

The installation system provides:

1. **Cross-platform support** via PowerShell, bash, and Node.js
2. **Auto-detection** of all major IDEs and CLIs
3. **Community skills integration** with conflict resolution
4. **Local LLM hub** setup with Ollama integration
5. **Legacy migration** from Outcome OS and old POS installs
6. **Validation** via doctor command and automated tests
7. **Backup and rollback** for safe upgrades
8. **Dry-run mode** for previewing changes

This ensures a seamless, safe installation experience across all platforms while integrating all the learnings from VibeSetup and the POS gists.
