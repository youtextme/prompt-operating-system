# Prompt OS — Reconciled Architecture

*Single document merging all POS gists + live enforcement learnings. Every mechanism maps to a file or exit code.*

**Seven-layer objective runner (v3.6):** see [OBJECTIVE-RUNNER.md](./OBJECTIVE-RUNNER.md) — Need → Context → Hypothesis → Truth → Critique → Retrieve → Autonomy (MAPE-K). Code: `kernel/layers/`.

## Sources reconciled

| Source | Contribution |
|--------|----------------|
| Objective-runner design paper | Seven layers; writer≠grader; checkable artifacts (`docs/OBJECTIVE-RUNNER.md`) |
| POS v2 guide | Verification hierarchy, structured intake, process oracles, evolution loop |
| Eight tenets (eBPF POS) | GoSolo, TerminalOutcomes DAG, VPR math, BarRaiserBoard regression |
| Outcome OS architecture | Machine enforcement, failure modes, mandatory artifacts, deliverable-on-disk |
| Opencode capabilities | Unified wiring, local LLM hub, request splitting, OpenAI-compatible gateway |

## System diagram

```
                    ┌─────────────────────────────────────┐
                    │  User prompt (any IDE / CLI / agent) │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────▼────────────────────────┐
              │  GoSolo: pos install wires tools (+ opt. eBPF)  │
              └───────────────────────┬────────────────────────┘
                                      │
              ┌───────────────────────▼────────────────────────┐
              │  PROMPT-ROUTER.md (kernel law)                  │
              │  Step 0–6: classify → contract → build → verify │
              └───────────────────────┬────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
  intake.schema.json           Role subagents              Local LLM Hub :8555
  TerminalOutcomes DAG         R/E/B/Eval                  (optional compute)
         │                            │
         └────────────┬───────────────┘
                      ▼
         ┌────────────────────────────┐
         │  Verification hierarchy     │
         │  L1 lint/schema             │
         │  L2 evidence-check.mjs      │
         │  L3 adversarial probes      │
         │  L4 BarRaiserBoard veto     │
         │  L5 evaluator rubric        │
         └────────────┬───────────────┘
                      ▼
         ┌────────────────────────────┐
         │  KeepItWarm: git + audit     │
         │  Evolve: log + benchmarks    │
         │  FeedbackLoop: ≤3 questions  │
         └────────────────────────────┘
```

## Prompt lifecycle (executable)

1. **Entry** — Tool loads `~/.agents/router/PROMPT-ROUTER.md` (injected by `pos install`).
2. **Classify** — Trivial → answer. Non-trivial → schema-validated intake.
3. **Contract** — `contracts/active/<slug>.md` on branch `contract/<slug>`.
4. **Bar-raiser** — Baseline table, PoC, A/B, kill criteria (pre-registered).
5. **Build** — Builder only; turn-level VPR oracles after risky steps.
6. **Evaluate** — Fresh Evaluator; epistemic isolation (no builder transcript).
7. **Gate** — `evidence-check.mjs --done` must exit 0.
8. **Panel** — BarRaiserBoard minority veto for strategic/user-facing `proven`.
9. **Evolve** — Append `evolve/log.md`; failures → `benchmarks/`.

## Machine enforcement (not honor system)

| Script | Exit | Signal |
|--------|------|--------|
| `evidence-check.mjs --done` | 0 | proven/killed with receipts |
| `evidence-check.mjs --done` | 2 | false done claim |
| `watchdog.mjs` | 10 | stall (identical outputs) |
| `watchdog.mjs` | 11 | ack-loop |
| `audit.mjs` | — | append-only JSONL lineage |

### evidence-check checks (order)

1. Required contract headings
2. Status proven|killed
3. Non-placeholder metric
4. Evaluator named in evidence
5. ≥2 `$ cmd` + `exit:` pairs
6. Bar-raiser keywords
7. Design-token gate for UI contracts
8. Stem-priority evidence (`evidence-<slug>.md` before generic)

## IDE / CLI wiring

`pos install` detects and configures:

| Tool | Mechanism |
|------|-----------|
| Cursor | `.cursor/rules/00-prompt-os.mdc` + agent roles |
| opencode | `instructions: [PROMPT-ROUTER.md]` |
| Claude Code | `~/.claude/CLAUDE.md` pointer |
| VS Code | `copilot-instructions.md` |
| OpenClaw | `workspace/AGENTS.md` snippet |
| Windsurf | `.codeium/windsurf/rules/00-prompt-os.md` |

State recorded in `~/.agents/prompt-os/WIRING.json`.

## Local LLM Hub (optional `--with-hub`)

OpenAI-compatible `http://localhost:8555`:

- `POST /v1/chat/completions` — role-based Ollama routing
- `GET /v1/models`, `GET /health`

Configure any client: `baseURL: http://localhost:8555/v1`

## Failure modes & fixes (proven in production)

| Failure | Fix |
|---------|-----|
| Empty subagent response | Deliverable-on-disk protocol; write evidence file first |
| Cross-contract evidence | Stem-priority; no shared fallback |
| Generic UI shipped | Mandatory design-token + AI-slop gate |
| LLM agreeableness | Minority veto panel |
| Infinite loops | watchdog exit 10/11; Ralph cap 12 |

## OS health dashboard (self-audit)

Track monthly: placeholder-metric rate, false-proven rate, evaluator–oracle disagreement, stall rate, promotion regression rate.

## Optional: eBPF GoSolo layer

Linux + root: TLS/execve hooks (AgentSight-style) route nested agent LLM calls through POS before cloud egress. Documented in `docs/EBPF.md`; not required for install.

## File layout after install

```
~/.agents/
├── router/PROMPT-ROUTER.md
└── prompt-os/
    ├── CONSTITUTION.md
    ├── schemas/intake.schema.json
    ├── roles/
    ├── scripts/
    ├── contracts/{active,completed}/
    ├── evolve/{log.md,INDEX.md,PROMOTIONS.md}
    ├── benchmarks/
    ├── audit/
    ├── INSTALL.json
    └── WIRING.json
```
