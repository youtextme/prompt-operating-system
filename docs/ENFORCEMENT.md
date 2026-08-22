# Hard Enforcement — No Prompt Escape

POS v3 defines **hard enforcement** as the default install mode. Soft wiring-only mode remains available via `pos install --soft`.

## Expert synthesis (AI research + engineering)

Industry pattern for universal LLM governance (2025–2026):

| Pattern | Source | POS implementation |
|---------|--------|-------------------|
| Transparent OpenAI-compatible proxy | LiteLLM, Forge, Indus LLM Gateway | `enforce/gateway.mjs` on `:8555` |
| Prepend-only middleware pipeline | Nexus, Barbacane ai-prompt-guard | `enforce/inject.mjs` — never strip tools |
| Fail-closed strict gate | Barbacane CEL profiles | Gateway 503 if kernel missing in strict mode |
| IDE-native prompt hooks | Cursor `beforeSubmitPrompt` | `enforce/hooks/before-submit-prompt.mjs` |
| Exit-code proof gates | Outcome OS / POS evidence-check | Ring 4 — unchanged, backward compatible |

**Key insight from gateway research:** interception must happen at the **transport layer** (proxy) or **submit layer** (IDE hooks), not in repo `AGENTS.md` alone. Instructions are necessary but not sufficient.

## Four rings (defense in depth)

```
Ring 1 — Gateway (hard for configured clients)
  OPENAI_BASE_URL=http://127.0.0.1:8555/v1
  OLLAMA_HOST=127.0.0.1:8555
  → Every request prepend-only POS injection + audit log

Ring 2 — Cursor hook (hard for Cursor prompts)
  ~/.cursor/hooks.json → beforeSubmitPrompt
  → Audit + fail-closed if kernel missing in hard mode

Ring 3 — IDE wiring (backup)
  Global rules, OpenHands suffix, OpenClaw AGENTS.md

Ring 4 — Exit gate (hard for "proven")
  evidence-check.mjs exit 0 required
```

### What is truly impossible to bypass

| Path | Hard block? |
|------|-------------|
| opencode / Continue / Ollama CLI via gateway env | **Yes** — traffic hits gateway |
| Cursor user prompts | **Yes** — hook runs before submit (fail-closed) |
| Cursor cloud model API directly | **No** — requires corporate TLS proxy or eBPF (Linux) |
| Raw `curl` to OpenAI bypassing env | **No** — unless system proxy enforced |
| MCP tool calls | **Never blocked** — backward compatibility |

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
```

## Files

```
~/.agents/prompt-os/
├── ENFORCE.json           # mode: hard|soft, env vars, ring docs
├── enforce/
│   ├── gateway.mjs        # OpenAI + Ollama proxy
│   ├── inject.mjs         # Prepend-only injection
│   └── hooks/before-submit-prompt.mjs
~/.cursor/hooks.json       # beforeSubmitPrompt (merged, not replaced)
```

## Optional: Linux eBPF (Ring 0)

See `docs/EBPF.md` — TLS/execve hooks for unmanaged CLI agents. Not required on Windows; complements gateway.
