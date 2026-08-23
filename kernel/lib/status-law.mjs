/**
 * Prompt OS v3.3 — shared status + outcome-frame law for all IDE/CLI adapters.
 * Canonical source. Router detail: kernel/router/STATUS-LAW.md
 */

export const STATUS_LAW_VERSION = "3.3.2";

/** One-line compact law for injection preambles and YAML customInstructions. */
export const STATUS_LAW_COMPACT = [
  "STATUS LAW (mandatory every response):",
  "Line 1 — POS loaded + no skip promptOS: `Wokay! Lets cook! <≤12-word work> — reporting back.`",
  "Line 1 — bypass/failure: `Solo mode — Prompt OS off. Direct answer.`",
  "Line 2 — `POS:on|off | phase:<classify|decompose|research|experiment|build|verify|done> | agents:<N> [<roles>] | outcome:<≤8 words> | slice:<i/n|—> | Trust:<GREEN|YELLOW|RED> | next:<≤10 words>`",
  "First session only, line 3: `Session: autonomous run — check-ins each turn; ping you at outcome gates only.`",
  "Last line: one 💪 micro-break via `node ~/.agents/prompt-os/nudges/next.mjs` (no in-session repeats).",
  "OUTCOME FRAME (non-trivial, before product code): show Job, North Star, Key Results (2–4), Workback slices, planned agents, cheapest kill experiment; commit contract path same turn.",
  "Trust: GREEN=on track, YELLOW=gate/uncertainty, RED=stuck or kill hit — never silent failure.",
].join(" ");

/** Multi-line block for Cursor/Windsurf rules and Devin knowledge files. */
export function statusLawBlock(routerPath) {
  return `Read and obey \`${routerPath}\` before substantive work. Improvements happen in the router only.

STATUS LAW (mandatory every response):
1. **Cook line** — first output line, no preamble:
   - POS active: \`Wokay! Lets cook! <≤12-word work you are doing> — reporting back.\`
   - Solo/bypass: \`Solo mode — Prompt OS off. Direct answer.\`
2. **Status line** — second line, always:
   \`POS:on|off | phase:… | agents:N [roles] | outcome:… | slice:i/n|— | Trust:GREEN|YELLOW|RED | next:…\`
3. **Session line** — first response only: \`Session: autonomous run — check-ins each turn; ping you at outcome gates only.\`
4. **Micro-break** — last line: one 💪 nudge from \`~/.agents/prompt-os/nudges/HEALTH-NUDGES.md\` via \`node ~/.agents/prompt-os/nudges/next.mjs\`

OUTCOME FRAME LAW: Non-trivial work MUST show Job, North Star, Key Results, Workback slices, and planned agents BEFORE any product code. Commit the contract path in the same turn. Do not jump to implementation without this frame visible to the human.

Trust signals: GREEN = progressing; YELLOW = need steer at gate or investigating; RED = stuck — say what failed and how the human can help.`;
}

/** Short suffix for OpenHands / gateway injection. */
export function statusLawSuffix(routerPath, posRoot) {
  return `\n\n[PROMPT OS] Read ${routerPath} and ${posRoot}/CONSTITUTION.md\n${STATUS_LAW_COMPACT}`;
}

/** Ollama / hub system prompt body. */
export function ollamaSystemPrompt(routerPath, posRoot, hubScript) {
  return `You operate under Prompt OS. Read ${routerPath} for processing law.
Constitution: ${posRoot}/CONSTITUTION.md
${STATUS_LAW_COMPACT}
For POS-routed inference use: node ${hubScript} on port 8555 (prepends this context).
Raw ollama serve (11434) does NOT auto-load POS — use OpenHands/Cursor/opencode or the hub.`;
}

/** Devin knowledge file body. */
export function devinKnowledge(routerPath, posRoot) {
  return `# Devin — Prompt OS ${STATUS_LAW_VERSION}

Load before sessions:

1. \`${routerPath}\`
2. \`${posRoot}/CONSTITUTION.md\`

**Deprecated:** Jillu banner / BANNER LAW — never use. Use STATUS LAW below.

Non-trivial → outcome contract + evaluator. Builder ≠ Evaluator.

${statusLawBlock(routerPath)}
`;
}

/** Claude Code CLAUDE.md body. */
export function claudeMd(routerPath, posRoot) {
  return `# Claude Code — Prompt OS

Before any substantive action, read:

1. \`${routerPath}\` — prompt processing law (single source of truth)
2. \`${posRoot}/CONSTITUTION.md\` — outcome constitution (≤50 lines)

Non-trivial work requires an outcome contract and independent evaluator. Builder ≠ Evaluator.

${statusLawBlock(routerPath)}
`;
}

/** OpenClaw AGENTS.md snippet. */
export function openClawSnippet(routerPath, posRoot, evidenceScript) {
  return `
## Prompt OS (installed)

Read \`${routerPath}\` before substantive work.
Constitution: \`${posRoot}/CONSTITUTION.md\`
Evidence gate: \`node ${evidenceScript}\`

${statusLawBlock(routerPath)}
`;
}

/** VS Code / Windsurf / generic markdown rule. */
export function markdownRule(routerPath) {
  return `# Prompt OS\n\n${statusLawBlock(routerPath)}\n`;
}

/** Continue customInstructions one-liner. */
export function continueCustomInstructions(routerPath) {
  return `Read ${routerPath}. ${STATUS_LAW_COMPACT}`;
}
