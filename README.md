# Prompt Operating System v2

**One install. Every IDE and CLI. Objective contracts. Machine-enforced evidence.**

Prompt OS is a universal kernel that routes **every** AI prompt through falsifiable outcome contracts, programmatic verification, and bounded self-evolution — not chat loops.

📖 **[Live docs](https://youtextme.github.io/prompt-operating-system/)** · [Architecture](docs/ARCHITECTURE.md) · [Tenets](docs/TENETS.md)

---

## What's New in v2

Prompt OS v2 reconciles all learnings from:
- **VibeSetup** — Community skills integration (Superpowers, Grill Me, Anthropic Skills, Ralph, etc.)
- **POS v2 guide** — Verification hierarchy, structured intake, process oracles
- **Eight tenets** — Mathematical models (VPR, bias correction), BarRaiserBoard
- **Outcome OS** — Machine enforcement, failure modes, mandatory artifacts
- **Opencode capabilities** — Unified wiring, local LLM hub, multi-model gateway

**Key additions:**
- ✅ Community skills from VibeSetup fully integrated
- ✅ Mathematical model implementations (VPR credit assignment, bias correction)
- ✅ Multi-model capability gateway with role-based routing
- ✅ Complete role definitions with detailed briefs
- ✅ Process oracle implementations for turn-level feedback
- ✅ A/B testing framework for design decisions
- ✅ Baseline table generation for competitor analysis
- ✅ Design token enforcement and AI-slop detection
- ✅ Complete audit lineage with JSONL triple-correlation
- ✅ Evolution promotion system with 3-outcome survival rule

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
| `--with-hub` | Install local LLM hub on port 8555 (Ollama required) |
| `--dry-run` | Show plan without writing |

### What install does

1. Copies kernel to `~/.agents/prompt-os/`
2. Sets router law at `~/.agents/router/PROMPT-ROUTER.md`
3. **Migrates** legacy `~/.agents/outcome-os/` if present
4. **Detects and wires** installed tools: Cursor, VS Code, opencode, Claude Code, OpenClaw, Windsurf, Continue, Devin
5. **Installs community skills** from VibeSetup: Superpowers, Grill Me, Anthropic Skills, Ralph, etc.
6. Replaces prior POS wiring (legacy Outcome OS rules → Prompt OS)

### Verify

```bash
node ~/.agents/prompt-os/bin/pos.mjs doctor
# or after clone:
npm test
node bin/pos.mjs doctor
```

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
node ~/.agents/prompt-os/scripts/audit.mjs append --actor builder --action "tests" --detail '{"command":"npm test","exit":0}'
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
| Windsurf | `.codeium/windsurf/rules/00-prompt-os.md` |
| Continue | `config.json` system message |
| Devin | `.devin/rules/00-prompt-os.mdc` + superpowers plugin |

Wiring state: `~/.agents/prompt-os/WIRING.json`

---

## Community Skills

Prompt OS v2 integrates all community skills from [VibeSetup](https://youtextme.github.io/vibeSetup/):

| Skill | Purpose | Loading Trigger |
|-------|---------|-----------------|
| **Superpowers** | Shipping methodology | Any build task |
| **Agent Skills** | Production engineering | Security, CI, observability |
| **Grill Me** | Requirements clarification | New capability start |
| **Anthropic Skills** | Design & testing | UI builds, browser testing |
| **Ralph** | Outer loop engine | Long-running tasks |
| **App Store Review** | Store submission audit | Store release tasks |
| **ccusage** | Cost tracking | Any task with LLM usage |

**Conflict resolution:** Only one methodology skill (Superpowers) allowed. Other skills load on demand by task type.

---

## Optional: Local LLM Hub

```bash
node install.mjs --with-hub
node ~/.agents/prompt-os/hub/server.mjs
```

Point any OpenAI client at `http://localhost:8555/v1`.

**Multi-model capability gateway:**
- Vision → `qwen2.5vl:7b`
- Reasoning → `deepseek-r1:8b`
- Coding → `qwen2.5-coder:7b`
- Tools → `llama3.2:3b`
- General → `qwen3:8b`

Role-based routing optimizes for the right model for each task type.

---

## Optional: eBPF kernel interception (Linux)

For universal CLI/IDE capture without per-tool wiring, see [docs/EBPF.md](docs/EBPF.md) (AgentSight-style; requires root).

---

## Mathematical Models

### Turn-Level Credit Assignment (VPR/EFCA)

```
G_t = α·O(τ) + β·F(s_t, a_t) + γ·H(s_{t-k:t})
```

Where:
- `G_t` — integrated return at turn t
- `O(τ)` — terminal outcome signal
- `F(s_t, a_t)` — immediate oracle feedback (lint, schema, API probe)
- `H` — medium-term state history

**Implementation:** `process-oracle.mjs` computes F(s_t, a_t) for each turn.

### Judge Bias Correction (BarRaiserBoard)

```
P(Y = 1 | Z_1, ..., Z_n) = σ(β_0 + Σ_j β_j·Z_j - θ_j)
```

Where:
- `θ_j` — agreeableness bias parameter for judge j
- `β_j` — judge weight (inverse of bias magnitude)
- Minority veto rule enforced

**Implementation:** `evidence-check.mjs` runs cross-model panel with bias correction.

---

## File structure after install

```
~/.agents/
├── router/PROMPT-ROUTER.md
└── prompt-os/
    ├── CONSTITUTION.md
    ├── kernel/
    │   ├── router/PROMPT-ROUTER.md
    │   ├── roles/
    │   ├── schemas/
    │   └── scripts/
    ├── skills/
    │   ├── community/ (VibeSetup skills)
    │   └── builtin/ (core POS skills)
    ├── hub/ (optional local LLM hub)
    ├── contracts/{active,completed}/
    ├── evolve/{log.md,INDEX.md,PROMOTIONS.md}
    ├── benchmarks/
    ├── audit/
    ├── INSTALL.json
    └── WIRING.json
```

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Doctor check
node bin/pos.mjs doctor

# Build hub (if with-hub)
cd hub && npm install
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgments

Reconciles and builds upon:
- [VibeSetup](https://youtextme.github.io/vibeSetup/) — Community skills integration
- [POS v2 guide](https://gist.github.com/youtextme/24a0db556fc8b6605a8ef2071cf75c8a) — Verification hierarchy
- [Eight tenets](https://gist.github.com/youtextme/47b74f63abe496b973f2ca57b9caa7ca) — Mathematical models
- [Outcome OS](https://gist.github.com/youtextme/e2af8d371c1b801838d5ac2cab9795da) — Machine enforcement
- [Opencode capabilities](https://gist.github.com/youtextme/79aa4e970c422d086a33a95c48f6bcd7) — Unified wiring

Community skills sources:
- [Superpowers](https://github.com/obra/superpowers) — Shipping methodology
- [Agent Skills](https://github.com/addyosmani/agent-skills) — Production engineering
- [Grill Me](https://github.com/mattpocock/skills) — Requirements clarification
- [Anthropic Skills](https://github.com/anthropics/skills) — Design & testing
- [Ralph](https://github.com/snarktank/ralph) — Outer loop engine
- [App Store Review](https://github.com/safaiyeh/app-store-review-skill) — Store audit
- [ccusage](https://github.com/ccusage/ccusage) — Cost tracking
