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
6. **Proves backward compatibility** — inventories your existing skills, MCP configs, IDE rules and
   legacy outcome-os data before wiring and diffs afterwards. User files must be byte-identical,
   JSON configs may only be *added to*. Result: `~/.agents/prompt-os/COMPAT.json`

### Verify

```bash
npm test                   # unit + 29 adversarial attacks + 4 end-to-end prompt scenarios
npm run test:adversarial    # every LLM gaming attempt must be caught
node bin/pos.mjs doctor
node bin/pos.mjs ledger     # audit chains are tamper-evident
```

### `/possandbox` — prompt validator

```bash
pos sandbox "your prompt here" --gist
```

Traces: `~/.agents/prompt-os/traces/`. Skill: `~/.cursor/skills/possandbox`. See [docs/PRIMITIVES.md](docs/PRIMITIVES.md).

---

## The first line tells you the truth

POS owns the first line of every routed response, and the model cannot author it:

```
Prompt Operating System at Play. We'll get you the outcomes you need.
```

If a prompt did **not** go through POS (or the kernel is broken), the prompt is still answered —
nothing fails — but it opens with:

```
Prompt Operating System NOT at play — <reason>. Answering anyway; done/proven claims stay blocked until POS is repaired.
```

The routed line is accepted only when it carries a kernel-signed attestation whose hash matches
the prompt that was actually submitted. A model that prints the banner itself gets rewritten to
the warning. See [ENFORCEMENT.md](docs/ENFORCEMENT.md).

## Nothing is proven by prose

| Claim | What POS demands |
|-------|------------------|
| "POS governed this" | signed attestation bound to the prompt hash |
| "tests pass" | receipts the **kernel** minted by running the command, re-executed at verify time |
| "reviewed and approved" | ≥3 independent judges, author excluded, verdicts citing verified receipts |
| "history is intact" | hash chain **and** signed head anchor (catches truncation) |
| "it's done" | status `proven`/`killed` + ≥2 green re-executed receipts + a numeric metric |

```bash
pos receipt run "npm test"   # kernel runs it, signs the real exit code
pos prove contract.md         # L3 gate; pasted logs are worthless here
pos tenet-check --done --contract c.md --evidence e.md --receipts '["rcpt_…"]'
```

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
# Hard done gate (attestation + re-executed receipts required)
node ~/.agents/prompt-os/scripts/evidence-check.mjs path/to/contract.md --done --hard

# Shape check only — reports certified:false, level:L2-syntactic
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
| Continue / Devin | detected + documented |

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

## License

MIT — see [LICENSE](LICENSE).
