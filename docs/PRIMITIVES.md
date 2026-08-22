# Prompt OS Primitives (shipped)

| Primitive | Script | Purpose |
|-----------|--------|---------|
| **Router law** | `kernel/router/PROMPT-ROUTER.md` | How every prompt is processed |
| **Constitution** | `kernel/CONSTITUTION.md` | ≤50 line law |
| **Evidence gate** | `evidence-check.mjs [--done] [--slice]` | Contract/slice proven/killed |
| **Watchdog** | `watchdog.mjs` | Stall (10) / ack-loop (11) |
| **Audit** | `audit.mjs` | JSONL lineage |
| **Evolve index** | `index-evolve.mjs` | Log → INDEX.md |
| **Environment** | `detect-environment.mjs` | Model + hardware + tools |
| **Variables** | `variables.mjs` | Mutable registry + variance |
| **Reward G** | `reward.mjs` | Adoptability + thoroughness objective |
| **Process oracle** | `process-oracle.mjs` | Turn-level VPR credit |
| **Program/slice** | `program.mjs` | NoOneBigShotOutcome decomposition |
| **Sandbox** | `possandbox.mjs` | Prompt trace + gist |
| **Kit** | `kit/install-kit.mjs` | VibeSetup skill pins (`--with-kit`) |
| **Hub** | `hub/server.mjs` | Local OpenAI gateway (`--with-hub`) |
| **IDE adapters** | `adapters/` | Cursor, opencode, Claude, etc. |

## Objective function (reward)

```
G = w_a·adoptability + w_t·thoroughness + w_o·oracle + w_h·history − penalty
```

- **Adoptability** — human-usable artifact + verify checklist + metric alignment
- **Thoroughness** — sources, bar-raiser, program progress
- **Oracle** — command receipts, lint/schema passes
- Agents should maximize **G**, not chat length.

## Variable awareness

Variables in `state/variables.json` affect routing (compute tier, time budget, parallelism, etc.). `possandbox` shows **variance branches** when variables change.

## /possandbox

```bash
pos sandbox "your prompt here" --gist
```

Or in Cursor: **`/possandbox <prompt>`** (loads `skills/possandbox/SKILL.md`).
