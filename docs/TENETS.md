# The Nine Immutable Tenets of Prompt OS

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
| 9 | **NoOneBigShotOutcome** | Deliver outcome in human-verifiable slices; every slice is usable on its own | Program contract + `slices/` queue; `evidence-check --slice`; program stays `active` until all slices proven or killed |

## Hard enforcement — the mechanism per tenet

The table above says *what* each tenet means. This one says what the kernel actually **refuses**.
Every row is a deterministic check in `kernel/scripts/tenet-check.mjs`, and every row has a
matching attack in `kernel/scripts/adversarial.test.mjs`.

| # | Tenet | Hard check | What it stops |
|---|-------|-----------|---------------|
| 1 | GoSolo | routed attestation whose `promptHash` matches this prompt | claiming POS governance while bypassing it; printing the banner by hand |
| 2 | KeepItWarm | ledger signature + `prev` chain + **signed head anchor** | editing, deleting, reordering or truncating audit history |
| 3 | TerminalOutcomes | `done` only when status is `proven` or `killed` | "done (in progress)" |
| 4 | WayofWorking | required contract sections present for non-trivial work | skipping the brief, kill criteria and falsifiable assumptions |
| 5 | BarRaiserBoard | ≥3 distinct judges, author excluded, verdicts cite verified receipts, unanimous approve needs a dissent or a resolved dissent | self-grading, sock-puppet judges, rubber-stamp boards |
| 6 | FeedbackLoop | signed, verified feedback entries | inventing "the user approved this" |
| 7 | FormulasAndBooleans | metric must parse to comparator + number; ≥2 receipts that verify **and** re-execute green | vibes metrics, keyword stuffing, pasted `$ npm test` / `exit:0` |
| 8 | Evolve&Improve | verified lesson linked to a real change ref | "we learned a lot" with nothing changed |
| 9 | NoOneBigShotOutcome | ≥2 slices for non-trivial work | one monolithic ship |

Two properties make these hard rather than well-intentioned:

- **Nothing textual certifies.** `pos evidence-check` is explicitly labelled
  `level: "L2-syntactic", certified: false`. Only `pos prove` / `--hard` certifies, and it needs a
  routed attestation plus kernel-minted receipts.
- **Receipts are re-executed, not read.** `pos receipt reverify` runs the recorded command again in
  the recorded working directory and compares the live exit code with the signed one, so a receipt
  that was green yesterday (or was forged with a stolen key) fails the moment reality disagrees.

### NoOneBigShotOutcome (tenet 9) — definition

Large objectives (multi-hour research, many agents, company-scale product) **must not** wait for one final “big bang” ship.

- A **program** (e.g. “baby names browse engine”) decomposes into an ordered **slice queue**.
- Each **slice** ships a **human-usable artifact** (URL, doc, chart, prototype screen, dataset) plus a **human-verifiable checklist** (what to click/read/run).
- A slice is `proven` when that checklist passes and receipts exist — the program may remain `active`.
- Needle-moving work continues slice-by-slice (research tranche → competitive matrix → flow wireframe → MVP route → …).
- “100 agents for 8 hours” is orchestration over slices, not one monolithic contract.

**Not allowed:** marking the whole program `proven` because “we worked hard” or “tests pass on a stub” while the human cannot use intermediate value.

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
