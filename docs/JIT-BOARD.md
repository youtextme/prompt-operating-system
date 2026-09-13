# Just-in-time Board of Directors

Prompt OS non-trivial runs staff six seats **as isolated subagents**. The main agent orchestrates only.

## Why

Single-context roleplay of Board / SME / Applied AI / CoS / CSAT / Meta **spoils** the main window and collapses graded evaluation. Isolation is mandatory when Task/subagents exist.

## Seats

See [`kernel/jit-board/ROSTER.json`](../kernel/jit-board/ROSTER.json) and role briefs under [`kernel/jit-board/roles/`](../kernel/jit-board/roles/).

Law: [`kernel/jit-board/SUBAGENT-LAW.md`](../kernel/jit-board/SUBAGENT-LAW.md).

## Entrypoint

- Skill: [`/letscook`](../skills/letscook/SKILL.md) (auto-applied on objectives)
- Router: Step 3.0 in [`PROMPT-ROUTER.md`](../kernel/router/PROMPT-ROUTER.md)
- Meta log: `node ~/.agents/prompt-os/scripts/meta-log.mjs start --ask "…"`

## Install

`node install.mjs` copies `kernel/jit-board/` → `~/.agents/prompt-os/jit-board/`, wires Cursor rule `01-jit-board.mdc`, and installs the `/letscook` skill with bundled references.

## Feasibility

No Task tool → `Trust:YELLOW` + sequenced role-pass files under the meta run. Never claim silent single-brain GREEN.
