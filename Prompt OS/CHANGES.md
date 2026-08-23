# Prompt Operating System — CHANGES

## v3.3.1 — Devin Cloud wiring (2026-08-23)

### Problem
Devin Cloud reads **repo `.devin/`**, not `~/.devin/PROMPT-OS.md` on your PC. Without committed `.devin/`, Devin kept stale Jillu v3.2 rules from old Knowledge or cached sessions.

### Fix
- Committed `.devin/` (global_rules, knowledge/prompt-os.md, wiki.json, playbooks)
- `wireDevinRepo()` refreshes repo `.devin/` on every `install.mjs --force`
- Migrates legacy Jillu/BANNER LAW text in existing `.devin/global_rules.md`
- `templates/devin/` for wiring other repos

### Devin users — action required
1. Pull `main` (includes `.devin/`)
2. **Start a new Devin session** on the repo (old sessions cache stale rules)
3. In Devin dashboard → **remove** any Knowledge entry that still mentions Jillu or v3.2 BANNER LAW


### Problem
- Jillu banner felt childish and wasted tokens without telling humans **what** was happening
- No visibility into agent count, phase, or outcomes in flight
- Work jumped to implementation without visible requirement decomposition
- Users couldn't tell if autonomous runs were healthy or silently stuck

### Solution
1. **Cook line** — `Wokay! Lets cook! <work> — reporting back.` (replaces Jillu banner)
2. **Status line** — every turn: phase, agents, outcome, slice, Trust (GREEN/YELLOW/RED), next
3. **Session line** — first response: autonomous check-ins; ping at outcome gates only
4. **Outcome Frame** — blocking gate: Job, North Star, Key Results, Workback, agents before product code
5. **Shared module** — `kernel/lib/status-law.mjs` wired to all adapters + gateway inject

### Files touched
- `kernel/router/PROMPT-ROUTER.md` — Step -1 rewrite, Step 1.5 Outcome Frame
- `kernel/router/STATUS-LAW.md` — human-readable spec
- `kernel/lib/status-law.mjs` — canonical adapter/inject strings
- All `adapters/*.mjs`, `kernel/enforce/inject.mjs`
- `kernel/templates/CONTRACT.md`, `kernel/CONSTITUTION.md`, `kernel/roles/researcher.md`
- `docs/capabilities/status-messaging-v3.3.md`

### Upgrade
```bash
node install.mjs --force
```

### Behavior change examples

**Before (v3.2):**
```
🌳 Jillu! Answer the question bruh — do a stretch or something, I got this from here!
(Prompt OS active ✅ you can relax and come back later — I've got this)
I'll fix the auth bug now...
💪 Stand up and stretch.
```

**After (v3.3):**
```
Wokay! Lets cook! outcome frame for auth fix — reporting back.
POS:on | phase:decompose | agents:0 | outcome:login works | slice:— | Trust:GREEN | next:publish frame
Session: autonomous run — check-ins each turn; ping you at outcome gates only.

## Outcome Frame
- **Job:** Users sign in reliably
- **North Star:** login success rate → 99% in 7d
...
💪 Stand up and stretch.
```
