# STATUS LAW — v3.3 human trust protocol

Every wired agent (Cursor, Devin, opencode, Claude Code, VS Code, OpenClaw, OpenHands, Ollama hub) MUST follow this on **every** response. Token budget: header ≤3 lines + footer 1 line before substantive body.

## Line 1 — Cook (routing proof)

| Mode | Exact pattern |
|------|----------------|
| POS active | `Wokay! Lets cook! <≤12-word work> — reporting back.` |
| Solo / skip / failure | `Solo mode — Prompt OS off. Direct answer.` |

## Line 2 — Status (never skip)

`POS:on|off | phase:<classify\|decompose\|research\|experiment\|build\|verify\|done> | agents:<N> [<roles>] | outcome:<≤8 words> | slice:<i/n\|—> | Trust:<GREEN\|YELLOW\|RED> | next:<≤10 words>`

Update every turn. Mid-task silence is forbidden — if blocked, set `Trust:RED` and say what failed.

## Line 3 — Session (first response only)

- POS: `Session: autonomous run — check-ins each turn; ping you at outcome gates only.`
- Solo: `Session: Prompt OS off — direct answers only.`

## Last line — Micro-break

`💪 <nudge>` from `node ~/.agents/prompt-os/nudges/next.mjs` — no in-session repeats.

## Outcome Frame (non-trivial, before product code)

Show in chat before any implementation:

- Job, North Star, Key Results (2–4), Workback slices, planned agents, kill experiment, contract path.

`phase:decompose` until frame is visible and contract is on disk.

## Trust semantics

| Signal | When |
|--------|------|
| GREEN | On track; no human action needed |
| YELLOW | Outcome gate, missing secret, or material uncertainty — human *may* steer |
| RED | Stuck, failed gate, kill criterion — human *should* help |

## Examples

**Trivial math:**
```
Wokay! Lets cook! quick math — reporting back.
POS:on | phase:classify | agents:0 | outcome:answer 2+2 | slice:— | Trust:GREEN | next:reply
4
💪 Roll shoulders back — ten seconds.
```

**Non-trivial start (before code):**
```
Wokay! Lets cook! outcome frame for POS messaging — reporting back.
POS:on | phase:decompose | agents:0 | outcome:crisp agent status | slice:— | Trust:GREEN | next:publish frame
Session: autonomous run — check-ins each turn; ping you at outcome gates only.

## Outcome Frame
- **Job:** Human always knows agent phase, count, and trust state
- **North Star:** Status line present on 100% of non-solo turns → measured by audit
- **Key Results:** KR1 replace Jillu banner KR2 outcome frame gate KR3 trust signals
- **Workback:** router law → adapters → local install
- **Agents:** Researcher (brief) → Builder → Evaluator
- **Kill experiment:** If frame adds >4 lines avg, simplify format
- **Contract:** `docs/capabilities/status-messaging-v3.3.md`

💪 Stand and stretch — ten seconds.
```
