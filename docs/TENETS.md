# The Eight Immutable Tenets of Prompt OS

These tenets reconcile the POS kernel spec with research-backed verification (2025–2026). Every install enforces them via router law + executable scripts.

| # | Tenet | What it means | Enforcement |
|---|--------|---------------|-------------|
| 1 | **GoSolo** | Autonomous by default; no manual SDK invocation | `pos install` wires Cursor, opencode, Claude, VS Code, OpenClaw, Windsurf; optional eBPF layer (Linux) |
| 2 | **KeepItWarm** | Transparent lineage — autonomy ≠ opacity | Git spine + `audit.mjs` JSONL + contract branches |
| 3 | **TerminalOutcomes** | One prompt → DAG of falsifiable terminal contracts | `intake.schema.json` → `terminal_outcomes[]`; sequential or parallel branches |
| 4 | **WayofWorking** | Disprove the brief; reject legacy paradigms | Researcher role; cite-or-kill before product code |
| 5 | **BarRaiserBoard** | Independent MECE verification; minority veto | Multi-judge panel; any invalid on kill/security/metric → not yet |
| 6 | **FeedbackLoop** | Human engaged at highest-leverage moments only | ≤3 structured questions at outcome gates; not permission theater |
| 7 | **FormulasAndBooleans** | Success = exit codes and formulas, not vibes | `evidence-check.mjs`, `watchdog.mjs`, VPR turn-level oracles |
| 8 | **Evolve&Improve** | Bounded recursive self-improvement | Golden failure benchmark + A/B patch promotion + 3-outcome constitution rule |

## Verification hierarchy (cross-cutting)

```
L1 Formal → L2 Programmatic → L3 Adversarial → L4 Multi-judge → L5 Single judge → L6 Self-grade FORBIDDEN
```

## Mathematical models (objective truth)

**Turn-level credit (VPR / EFCA):**

```
G_t = α·O(τ) + β·F(s_t, a_t) + γ·H(s_{t-k:t})
```

- `O(τ)` — terminal outcome (tests, evidence-check exit 0)
- `F(s_t, a_t)` — immediate oracle (lint, schema validate, curl probe)
- `H` — medium-term state history (watchdog, audit trail)

**Judge bias correction (BarRaiserBoard):**

Latent correctness `Y ∈ {0,1}`; minority veto overrides agreeable majority. Regression calibration on golden failure set reduces false-proven rate.

## Research references

- [Verifiable Process Rewards](https://arxiv.org/html/2605.10325)
- [Recursive Self-Improvement survey](https://www.alphaxiv.org/abs/2607.07663)
- [Beyond Consensus / agreeableness bias](https://doi.org/10.48550/arxiv.2510.11822)
- [AgentSight / eBPF observability](https://arxiv.org/abs/agentsight) (optional GoSolo layer)
