# Prompt Operating System

**One install. Every IDE and CLI. Objective contracts. Machine-enforced evidence.**

Prompt OS is a universal kernel that routes **every** AI prompt through falsifiable outcome contracts, programmatic verification, and bounded self-evolution — not chat loops.

📖 **[Live docs](https://youtextme.github.io/prompt-operating-system/)** · Architecture · [Tenets](docs/TENETS.md)

---

## Install (one command)

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/youtextme/prompt-operating-system/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/youtextme/prompt-operating-system/main/install.ps1 | iex
```

**From clone:**

```bash
git clone https://github.com/youtextme/prompt-operating-system.git
cd prompt-operating-system
node install.mjs
```

### Options

| Flag | Effect |
|------|--------|
| `--force` | Replace existing install (backs up to `~/.agents/.backup-*`) |
| `--soft` | Wiring-only mode (no hard gateway/hooks) |
| `--with-hub` | Install local LLM hub on port 8555 (default with hard install) |
| `--with-kit` | Pin VibeSetup skill repos (Superpowers, grill-me, Ralph, etc.) |
| `--dry-run` | Show plan without writing |

**v3 default:** hard enforcement — gateway on `:8555`, Cursor `beforeSubmitPrompt` hook, user env vars. See [ENFORCEMENT.md](docs/ENFORCEMENT.md).

### What install does

1. Copies kernel to `~/.agents/prompt-os/`
2. Sets router law at `~/.agents/router/PROMPT-ROUTER.md`
3. **Migrates** legacy `~/.agents/outcome-os/` if present
4. **Detects and wires** installed tools: Cursor, VS Code, opencode, Claude Code, OpenClaw, Windsurf, Continue, Devin
5. Replaces prior POS wiring (legacy Outcome OS rules → Prompt OS)

### Cursor Cloud

Cloud agents do not inherit your PC `~/.agents/prompt-os`. This repo ships:

- `.cursor/environment.json` → `bash scripts/cloud-install.sh` (runs `node install.mjs --force` from the checkout)
- `bash scripts/cloud-start.sh` starts the gateway on `:8555` each boot

Create/select a Cloud Agent environment for this repository and enable builds after the install script succeeds.

### Verify


```bash
npm test
node bin/pos.mjs doctor
```

### `/possandbox` — prompt validator

```bash
pos sandbox "your prompt here" --gist
```

Traces: `~/.agents/prompt-os/traces/`. Skill: `~/.cursor/skills/possandbox`. See [docs/PRIMITIVES.md](docs/PRIMITIVES.md).

---

## What you get

### Eight tenets (all enforced)

1. **GoSolo** — autonomous routing into POS without manual SDK calls  
2. **KeepItWarm** — git spine + audit JSONL lineage  
3. **TerminalOutcomes** — DAG of falsifiable contracts per prompt  
4. **WayofWorking** — disprove-the-brief before building  
5. **BarRaiserBoard** — multi-judge verification with minority veto  
6. **FeedbackLoop** — ≤3 high-leverage human questions at outcome gates  
7. **FormulasAndBooleans** — `evidence-check.mjs` exit codes, not "looks good"  
8. **Evolve&Improve** — golden failure benchmarks + bounded promotion  

See [docs/TENETS.md](docs/TENETS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Verification hierarchy

```
L1 Formal → L2 Programmatic → L3 Adversarial → L4 Multi-judge → L5 Single judge → L6 Self-grade FORBIDDEN
```

### Core commands

```bash
# Done gate (exit 0 = proven/killed with evidence)
node ~/.agents/prompt-os/scripts/evidence-check.mjs path/to/contract.md --done

# Loop detector (10=stall, 11=ack-loop)
node ~/.agents/prompt-os/scripts/watchdog.mjs --file transcript.log

# Audit trail
node ~/.agents/prompt-os/scripts/audit.mjs append --actor builder --action "tests" --detail "npm test exit:0"
```

---

## Supported tools

| Tool | Wired by install |
|------|------------------|
| Cursor | `.cursor/rules/00-prompt-os.mdc` |
| opencode | `instructions: [PROMPT-ROUTER.md]` |
| Claude Code | `~/.claude/CLAUDE.md` |
| VS Code Copilot | `copilot-instructions.md` |
| OpenClaw | `workspace/AGENTS.md` |
| Windsurf | rules file |
| Continue / Devin | Devin: repo `.devin/` + `~/.devin/PROMPT-OS.md` |

Wiring state: `~/.agents/prompt-os/WIRING.json`

---

## Optional: Local LLM Hub

```bash
node install.mjs --with-hub
node ~/.agents/prompt-os/hub/server.mjs
```

Point any OpenAI client at `http://localhost:8555/v1`.

---

## Optional: eBPF kernel interception (Linux)

For universal CLI/IDE capture without per-tool wiring, see [docs/EBPF.md](docs/EBPF.md) (AgentSight-style; requires root).

---

## Reconcile / upgrade from gists

This repo supersedes and merges:

- [POS v2 guide](https://gist.github.com/youtextme/24a0db556fc8b6605a8ef2071cf75c8a)
- [Eight tenets / eBPF POS](https://gist.github.com/youtextme/47b74f63abe496b973f2ca57b9caa7ca)
- [Outcome OS architecture](https://gist.github.com/youtextme/e2af8d371c1b801838d5ac2cab9795da)
- [Unified IDE wiring + LLM hub](https://gist.github.com/youtextme/79aa4e970c422d086a33a95c48f6bcd7)

---

## v3.3 — Cook line + status + trust (replaces Jillu banner)

Every wired agent response uses **≤4 header/footer lines** — crisp, token-light, human-trustable. See [`kernel/router/STATUS-LAW.md`](kernel/router/STATUS-LAW.md).

1. **Cook line** — line 1:
   `Wokay! Lets cook! <work> — reporting back.`
   (or `Solo mode — Prompt OS off. Direct answer.` when bypass/failure)
2. **Status line** — line 2, every turn:
   `POS:on | phase:decompose | agents:1 [Researcher] | outcome:… | slice:1/3 | Trust:GREEN | next:…`
3. **Session line** — first response only:
   `Session: autonomous run — check-ins each turn; ping you at outcome gates only.`
4. **Outcome Frame** — non-trivial work shows Job, North Star, Key Results, Workback, agents **before product code**
5. **Micro-break** — last line: one `💪` nudge via:

```bash
node ~/.agents/prompt-os/nudges/next.mjs
```

Trust: **GREEN** on track · **YELLOW** gate/uncertainty · **RED** stuck — never silent failure.

---

## v3.2 — Jillu banner (superseded by v3.3)

<details>
<summary>Legacy v3.2 Jillu banner (removed in v3.3)</summary>

Every response previously used Jillu banner + handshake + 500-nudge health law.
</details>

---

## License

MIT — see [LICENSE](LICENSE).
