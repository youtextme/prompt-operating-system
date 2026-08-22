# Hard Enforcement — No Prompt Escape

POS v3 defines **hard enforcement** as the default install mode. Soft wiring-only mode remains available via `pos install --soft`.

## Expert synthesis (AI research + engineering)

Industry pattern for universal LLM governance (2025–2026):

| Pattern | Source | POS implementation |
|---------|--------|-------------------|
| Transparent OpenAI-compatible proxy | LiteLLM, Forge, Indus LLM Gateway | `enforce/gateway.mjs` on `:8555` |
| Prepend-only middleware pipeline | Nexus, Barbacane ai-prompt-guard | `enforce/inject.mjs` — never strip tools |
| Fail-open-but-loud gate | Barbacane CEL profiles (inverted) | Prompts always answer; a degraded first line names the breakage and the claim gate stays shut |
| Signed attestation of interception | Sigstore / in-toto attestations | `enforce/attest.mjs` — prompt-hash-bound, HMAC-signed, hash-chained |
| Executable proof instead of pasted logs | SLSA provenance, `nix build` receipts | `scripts/receipt.mjs` — kernel runs the command, signs the exit code, re-runs on verify |
| Tamper-evident append-only log | Certificate Transparency (signed tree head) | `lib/ledger.mjs` — hash chain **plus** signed head anchor |
| IDE-native prompt hooks | Cursor `beforeSubmitPrompt` | `enforce/hooks/before-submit-prompt.mjs` |
| Exit-code proof gates | Outcome OS / POS evidence-check | Ring 4 — unchanged, backward compatible |

**Key insight from gateway research:** interception must happen at the **transport layer** (proxy) or **submit layer** (IDE hooks), not in repo `AGENTS.md` alone. Instructions are necessary but not sufficient.

## The first line is a kernel fact, not a model claim

Every response carries a truthful status line the model cannot author:

| Situation | First line |
|-----------|-----------|
| Prompt went through POS and the kernel is healthy | `Prompt Operating System at Play. We'll get you the outcomes you need.` |
| POS was bypassed, or the kernel is incomplete/unreadable | `Prompt Operating System NOT at play — <reason>` … and the prompt is still answered |

The routed line is only accepted when the accompanying marker
(`<!-- pos:routed attest:<id> sig:<prefix> -->`) resolves to a **signed attestation whose
`promptHash` equals the SHA-256 of the prompt actually submitted**. `enforce/banner.mjs`
strips any banner or marker found in model output *before* the kernel applies its own,
so a model that prints the routed line itself is rewritten to the degraded warning.

Degraded never means "failed": the prompt is answered normally, but `done` / `proven`
claims stay blocked until the kernel is repaired.

## Four rings (defense in depth)

```
Ring 1 — Gateway (hard for configured clients)
  OPENAI_BASE_URL=http://127.0.0.1:8555/v1
  OLLAMA_HOST=127.0.0.1:8555
  → Every request prepend-only POS injection + audit log

Ring 2 — Cursor hook (hard for Cursor prompts)
  ~/.cursor/hooks.json → beforeSubmitPrompt
  → Always continues; mints a routed OR degraded attestation

Ring 3 — IDE wiring (backup)
  Global rules, OpenHands suffix, OpenClaw AGENTS.md

Ring 4 — Exit gate (hard for "proven")
  pos prove → routed attestation + ≥2 re-executed green receipts

Ring 5 — Truth of status (hard, always)
  banner.mjs owns the first line; forged routed banners are rewritten
```

### What is truly impossible to bypass

| Path | Hard block? |
|------|-------------|
| opencode / Continue / Ollama CLI via gateway env | **Yes** — traffic hits gateway |
| Cursor user prompts | **Yes** — hook runs before submit, always continues, always attests |
| Cursor cloud model API directly | **No** — requires corporate TLS proxy or eBPF (Linux) |
| Raw `curl` to OpenAI bypassing env | **No** — unless system proxy enforced |
| MCP tool calls | **Never blocked** — backward compatibility |

Unattested paths are not silently trusted: without a routed attestation bound to the prompt,
`pos prove` and `pos tenet-check` fail closed, so bypassing POS costs you the ability to claim
anything is done.

Honest limit: **100% universal** interception on Windows without a system network policy requires routing all LLM egress through `:8555`. POS sets user env vars and documents the requirement; Cursor cloud remains Ring 2 + 3.

## Backward compatibility (mandatory)

POS hard mode **must not break** existing assets:

| Asset | Guarantee |
|-------|-----------|
| **Skills** (`~/.cursor/skills`, `~/.agents/skills`) | Never deleted; possandbox is additive only |
| **MCP** (`~/.cursor/mcp.json`) | Untouched; gateway passes `tools[]` unchanged |
| **Existing system messages** | Prepend-only via `inject.mjs` |
| **Legacy outcome-os** | Migrated to `~/.agents/prompt-os/` — paths preserved |
| **OpenHands skills** | `load_user_skills` stays true |
| **Contracts / audit / evolve** | Same directories, same scripts |
| **Client request fields** | `tools`, `tool_choice`, `functions`, `function_call`, `response_format`, `mcp`/`mcpServers`, `stream`, model + generation params forwarded byte-identical |

This is checked, not promised:

- `enforce/compat.mjs` `guardOutbound(before, after)` snapshots the client payload, and if POS's
  proposed upstream body drops or mutates any preserved field the **original client body is
  forwarded instead** and the violation is recorded.
- `install.mjs` inventories every existing skill, MCP config, IDE rule and legacy outcome-os file
  before wiring and diffs it afterwards. User-owned non-config files must be byte-identical;
  JSON configs may only be *augmented* (pre-existing keys and MCP servers must survive with the
  same values). The result is written to `~/.agents/prompt-os/COMPAT.json`.

## Hard tenets: what each one now requires

`scripts/tenet-check.mjs` is a deterministic gate — no tenet is satisfiable by prose.

| Tenet | Hard requirement |
|-------|------------------|
| GoSolo | valid routed attestation bound to this prompt; escalations must show an attempt |
| KeepItWarm | every audit chain verifies: signatures, `prev` links **and** signed head anchor |
| TerminalOutcomes | `done` only from `proven` or `killed` — never "in progress" |
| WayofWorking | contract carries the required sections for non-trivial work |
| BarRaiserBoard | ≥3 distinct judges, author excluded, verdicts cite receipts, unanimous-approve without a dissent or resolution is rejected |
| FeedbackLoop | signed, verified feedback entries |
| FormulasAndBooleans | metric parses to comparator + number; ≥2 receipts that verify **and** re-execute green |
| Evolve&Improve | verified lesson linked to a real change reference |
| NoOneBigShotOutcome | non-trivial work split into ≥2 slices |

Self-grading is rejected outright (L6 is forbidden in the verification hierarchy).

## Commands

```bash
# Default install enables hard mode
node install.mjs --force

# Soft mode (v2 behavior)
node install.mjs --soft

pos enforce on          # Enable hard mode + hooks + env
pos enforce off         # Revert to soft
pos enforce status      # ENFORCE.json
pos enforce doctor --strict   # Exit 1 if any ring broken
pos gateway             # Start gateway on :8555

# Hard proof path
pos receipt run "npm test"     # kernel executes it and signs the real exit code
pos receipt reverify rcpt_…    # runs it again; a stale green receipt fails here
pos attest prompt "<text>"     # record that a prompt went through POS
pos prove <contract.md>        # L3 gate: attestation + ≥2 re-executed green receipts
pos tenet-check --done --contract c.md --evidence e.md --receipts '["rcpt_…"]'
pos ledger                     # tamper-evidence check of every audit chain
```

## Tests

```bash
npm test                  # unit + adversarial + scenarios
npm run test:adversarial   # 29 gaming attacks, each must be caught
npm run test:scenarios     # 4 end-to-end prompts (trivial, degraded, program, tool/MCP-heavy)
```

`kernel/scripts/adversarial.test.mjs` is the honest part of this document: each test is an attack
an LLM would actually try (forged banner, fabricated `$ cmd` / `exit:0` blocks, invented receipt
ids, edited receipts, deleted/reordered/truncated ledger lines, forged head anchor, self-graded
board, rubber-stamp board, keyword-stuffed metric, stripped tools/MCP, stale receipt, one-big-shot
done). A green suite means a mechanism caught it.

## Files

```
~/.agents/prompt-os/
├── ENFORCE.json           # mode: hard|soft, env vars, ring docs
├── keys/pos.key           # HMAC signing key, 0600
├── ledger/                # *.jsonl chains + *.head.json signed anchors
├── COMPAT.json            # last install's backward-compatibility diff
├── lib/
│   ├── canon.mjs          # canonical JSON + SHA-256
│   ├── keys.mjs           # key custody, HMAC sign/verify
│   └── ledger.mjs         # append-only chain + signed head anchor
├── enforce/
│   ├── gateway.mjs        # OpenAI + Ollama proxy
│   ├── inject.mjs         # Prepend-only injection (signed stamp = idempotent)
│   ├── attest.mjs         # prompt-bound routing attestations
│   ├── banner.mjs         # truthful first line, anti-forgery
│   ├── compat.mjs         # prepend-only guard + install inventory diff
│   └── hooks/before-submit-prompt.mjs
├── scripts/
│   ├── receipt.mjs        # signed, re-executable command receipts
│   ├── tenet-check.mjs    # deterministic tenet gate
│   └── ledger-verify.mjs  # tamper-evidence check
~/.cursor/hooks.json       # beforeSubmitPrompt (merged, not replaced)
```

## Optional: Linux eBPF (Ring 0)

See `docs/EBPF.md` — TLS/execve hooks for unmanaged CLI agents. Not required on Windows; complements gateway.

## Threat model — what is still soft

- **Key custody.** The HMAC key is readable by any process running as the same user, so an agent
  with shell access could mint its own signatures. This is why proof does not stop at signatures:
  receipts are **re-executed** at verify time, so a forged green receipt still has to survive the
  command actually running. Point `POS_KEY_FILE` at a privilege-separated location (or a KMS) to
  close this properly.
- **Direct API egress.** A client that ignores `OPENAI_BASE_URL` / `OLLAMA_HOST` is outside
  transport enforcement. It cannot fake routed status (no attestation → degraded banner → claim
  gate shut), but network policy is what makes interception total.
- **L2 shape checks remain regex-based.** `pos evidence-check` reports `certified: false,
  level: "L2-syntactic"`. Only `--hard` / `pos prove` certifies.
