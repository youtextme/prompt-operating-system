# Capability: Status messaging v3.3

Status: proven  
Owner surface: Cursor | opencode | Devin | all POS-wired CLIs

## Job

Human never wonders what agents are doing, how many are running, or whether work is silently failing.

## North Star

- Metric: % of agent turns with valid status line (phase, agents, outcome, Trust, next)
- Target: 100% on wired hosts
- Window: every session after `node install.mjs --force`

## Key Results

1. Jillu banner replaced with cook + status + trust lines
2. Outcome Frame visible before product code on non-trivial work
3. Shared `status-law.mjs` wired to all adapters + inject gateway

## Workback slices

1. Router + STATUS-LAW.md + status-law module
2. Adapter rewire (Cursor, opencode, Devin, Claude, VS Code, OpenClaw, OpenHands, Continue, Windsurf)
3. Local install + tests + docs

## Evidence

- `npm test` green
- `node install.mjs --force` updates `~/.agents/prompt-os/` and `.cursor/rules/00-prompt-os.mdc`
