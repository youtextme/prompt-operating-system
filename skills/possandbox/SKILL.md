---
name: possandbox
description: >-
  POS Sandbox prompt validator. Use when the user runs /possandbox or asks how
  a prompt will be processed by Prompt OS. Traces router steps, variables,
  variance, reward preview, and optional gist export.
---

# possandbox — Prompt OS validator

When the user invokes **`/possandbox <prompt>`** (or asks how POS will process a prompt):

## Do this

1. Run the sandbox (repo or installed kernel):

```bash
node ~/.agents/prompt-os/scripts/possandbox.mjs "<prompt>" --gist
```

If developing from clone:

```bash
node kernel/scripts/possandbox.mjs "<prompt>" --gist
```

2. Read the markdown trace output. Explain to the user in plain language:
   - Classification (trivial / non_trivial / **program**)
   - Each router step with **reasoning** and **guardrails**
   - **Variables** that can change the route (model tier, RAM, time budget, parallelism)
   - **Variance branches** (what changes if compute or budget differs)
   - **Proposed slices** for multi-hour prompts (NoOneBigShotOutcome)
   - **Reward preview G** — what gets rewarded (adoptability + thoroughness + oracles)

3. If `--gist` succeeded, give the user the **Gist URL** for objective sharing.

4. Optionally run environment + reward:

```bash
node ~/.agents/prompt-os/scripts/detect-environment.mjs
node ~/.agents/prompt-os/scripts/variables.mjs list
```

## Rules

- This is **simulation/dry-run** — sandbox does not build product code.
- Never claim the prompt is `proven`; only show how POS **would** process it.
- For stock/100X prompts: highlight kill-criteria guard (research pack, not prediction).
- Traces persist at `~/.agents/prompt-os/traces/<id>.md`.

## Example user message

`/possandbox Create a baby name site where people browse 50,000 names — 8 hours research, many agents, incremental ship`

Expected: classification=**program**, 4+ slices, variance on agent_parallelism, reward breakdown, gist link.
