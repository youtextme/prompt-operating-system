# Unified Prompt OS Specification

## Document Purpose

This specification reconciles all learnings from:
- Existing prompt-operating-system GitHub repo
- VibeSetup community skills integration
- POS v2 guide (verification hierarchy, structured intake)
- Eight tenets (eBPF POS, VPR math, BarRaiserBoard)
- Outcome OS architecture (machine enforcement)
- Opencode capabilities (unified wiring, local LLM hub)

## System Architecture

### File Structure After Installation

```
~/.agents/
├── router/
│   └── PROMPT-ROUTER.md                    # Single source of truth for all agents
└── prompt-os/
    ├── CONSTITUTION.md                      # Core law (≤50 lines)
    ├── kernel/
    │   ├── router/PROMPT-ROUTER.md          # Router law (source for install)
    │   ├── roles/
    │   │   ├── researcher.md                # Disprove-the-brief specialist
    │   │   ├── experimenter.md              # PoC + metric instrumentation
    │   │   ├── builder.md                   # Contract implementation
    │   │   ├── evaluator.md                 # Fresh-context grader
    │   │   ├── architect.md                 # Contract & interface design
    │   │   ├── security-reviewer.md         # Threat analysis
    │   │   ├── code-reviewer.md             # Convention enforcement
    │   │   └── marketer.md                  # Positioning & docs
    │   ├── schemas/
    │   │   ├── intake.schema.json           # Structured intake validation
    │   │   ├── contract.schema.json         # Contract structure validation
    │   │   └── evidence.schema.json          # Evidence file validation
    │   └── scripts/
    │       ├── evidence-check.mjs            # Done gate (exit 0 = proven/killed)
    │       ├── watchdog.mjs                  # Stall/ack-loop detection (exit 10/11)
    │       ├── audit.mjs                     # JSONL lineage system
    │       ├── evolve.mjs                    # Promotion system
    │       ├── baseline.mjs                  # Competitor analysis
    │       ├── process-oracle.mjs            # Turn-level oracles
    │       ├── hub-router.mjs                # Multi-model gateway
    │       └── index-evolve.mjs              # Evolution indexing
    ├── skills/
    │   ├── community/                        # Community skills from VibeSetup
    │   │   ├── superpowers/                  # Shipping methodology
    │   │   ├── agent-skills/                 # Production engineering
    │   │   ├── grill-me/                     # Requirements clarification
    │   │   ├── anthropic-skills/             # Design & testing
    │   │   ├── ralph/                        # Outer loop engine
    │   │   ├── app-store-review/             # Store submission audit
    │   │   └── ccusage/                      # Cost tracking
    │   ├── builtin/                          # Core POS skills
    │   │   ├── outcome-os/                   # Contract-based building
    │   │   ├── recruit/                      # Staffing protocol
    │   │   ├── bar-raiser/                   # Quality gate
    │   │   ├── sdlc/                         # Full lifecycle
    │   │   ├── marketing/                    # Product marketing
    │   │   └── local-ollama-fallback/        # Local LLM fallback
    │   └── skill-loader.mjs                  # Skill loading & conflict resolution
    ├── hub/                                   # Local LLM hub (optional)
    │   ├── server.mjs                        # OpenAI-compatible gateway
    │   ├── config.json                       # Role-to-model mapping
    │   ├── models/                           # Model configurations
    │   └── tools/                            # Tool implementations
    ├── contracts/
    │   ├── active/                           # Current contracts
    │   └── completed/                         # Finished contracts
    ├── evolve/
    │   ├── log.md                            # Evolution log
    │   ├── INDEX.md                          # Evolution index
    │   └── PROMOTIONS.md                     # Promotion queue
    ├── benchmarks/                           # Golden failure set
    ├── audit/                                # JSONL audit trail
    ├── INSTALL.json                          # Installation manifest
    └── WIRING.json                           # IDE/CLI wiring state
```

## Core Components

### 1. Mathematical Models

#### Turn-Level Credit Assignment (VPR/EFCA)

```
G_t = α·O(τ) + β·F(s_t, a_t) + γ·H(s_{t-k:t})
```

Where:
- `G_t` — integrated return at turn t
- `O(τ)` — terminal outcome signal (tests pass, evidence-check exit 0)
- `F(s_t, a_t)` — immediate oracle feedback (lint exit code, schema validation, API probe)
- `H(s_{t-k:t})` — medium-term state history (watchdog patterns, audit trail)
- `α, β, γ` — weighting coefficients (configurable per task type)

**Implementation:** `process-oracle.mjs` computes F(s_t, a_t) for each turn and appends to audit trail.

#### Judge Bias Correction (BarRaiserBoard)

Latent correctness `Y ∈ {0,1}`; judge predictions `Z_j ∈ {0,1}` for j judges.

```
P(Y = 1 | Z_1, ..., Z_n) = σ(β_0 + Σ_j β_j·Z_j - θ_j)
```

Where:
- `θ_j` — agreeableness bias parameter for judge j (calibrated on golden set)
- `β_j` — judge weight (inverse of bias magnitude)
- `σ` — sigmoid function

**Minority veto rule:** If any judge flags invalid on kill/security/metric → outcome = `not yet`, regardless of majority.

**Implementation:** `evidence-check.mjs` runs cross-model panel; applies regression correction; enforces minority veto.

### 2. Verification Hierarchy

```
L1 Formal        — types, linters, JSON schema validators, proof checkers
L2 Programmatic  — tests, API probes, CLI exit codes, evidence-check scripts
L3 Adversarial   — fuzz, null payloads, boundary cases, a11y rule packs
L4 Multi-judge   — cross-model panel with minority veto
L5 Single judge  — LLM rubric (weakest acceptable gate for open-ended quality)
L6 Self-grade    — FORBIDDEN
```

**Enforcement:**
- `proven` requires L2 minimum
- User-facing or strategic outcomes require L3 + L4
- L5 alone never suffices
- evidence-check.mjs enforces hierarchy based on contract type

### 3. Terminal Outcomes DAG

**Schema:** `intake.schema.json` defines `terminal_outcomes[]` array:

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "slug": {"type": "string"},
      "job": {"type": "string"},
      "north_star_metric": {"type": "string"},
      "depends_on": {"type": "array", "items": {"type": "string"}},
      "independent": {"type": "boolean"}
    },
    "required": ["slug", "job", "north_star_metric"]
  }
}
```

**Execution:**
- Independent outcomes → parallel contract branches
- Dependent outcomes → sequential (parent must be `proven` before child starts)

### 4. Community Skills Integration

#### Skill Loading Strategy

**File:** `skills/skill-loader.mjs`

**Rules:**
1. Load on demand (not preloaded into every session)
2. Conflict resolution: only one methodology skill (Superpowers) allowed
3. Role-based loading: certain skills required by task type
4. Dependency management: skills declare dependencies
5. Version pinning: use specific commits/tags

**Integration Table:**

| Skill | Purpose | Loading Trigger | Conflicts With |
|-------|---------|-----------------|----------------|
| superpowers | Shipping methodology | Any build task | grill-me, other methodology skills |
| agent-skills | Production engineering | Security, CI, observability tasks | None |
| grill-me | Requirements clarification | New capability start | superpowers (methodology conflict) |
| anthropic-skills | Design & testing | UI builds, browser testing | None |
| ralph | Outer loop engine | Long-running tasks | None |
| app-store-review | Store submission audit | Store release tasks | None |
| ccusage | Cost tracking | Any task with LLM usage | None |

**Implementation:**
- Skills cloned to `skills/community/<name>/` during install
- skill-loader.mjs resolves conflicts on load
- Builtin skills take precedence over community skills for core functions

### 5. Multi-Model Capability Gateway

**File:** `hub/server.mjs`

**Role-to-Model Mapping:** `hub/config.json`

```json
{
  "port": 8555,
  "ollama": "http://localhost:11434",
  "roles": {
    "router": "llama3.2:3b",
    "planner": "qwen3:8b",
    "general": "qwen3:8b",
    "reasoner": "deepseek-r1:8b",
    "coder": "qwen2.5-coder:7b",
    "vision": "qwen2.5vl:7b",
    "fast": "llama3.2:3b"
  },
  "capabilities": {
    "tool_call": ["llama3.2:3b", "qwen3-coder-next:latest"],
    "vision": ["qwen2.5vl:7b"],
    "reasoning": ["deepseek-r1:8b", "qwen3:8b"],
    "coding": ["qwen2.5-coder:7b", "qwen3-coder-next:latest"]
  },
  "maxToolIterations": 6,
  "maxSubtasks": 4
}
```

**API Endpoints:**
- `POST /v1/chat/completions` — OpenAI-compatible with role routing
- `GET /v1/models` — List available models
- `GET /health` — Health check

**Routing Logic:**
1. Analyze request for capabilities (tools, vision, reasoning, coding)
2. Select model based on role and capability match
3. Forward to Ollama with transformed request
4. Return OpenAI-compatible response

### 6. Role Definitions

#### Researcher

**File:** `kernel/roles/researcher.md`

**Brief Template:**
```
Role: Researcher
Objective: Disprove the brief before any product code is written.
Question: [specific research question]
Sources allowed: [web, docs, repos, existing codebase]
Return format: [markdown report with citations]
Failure condition: [cannot find evidence or brief is disproven]
Deliverable: [path to research report file]
```

**Deliverable-on-disk protocol:**
1. Write `research-<slug>.md` first
2. Update incrementally
3. Acceptance = file complete on disk

#### Experimenter

**File:** `kernel/roles/experimenter.md`

**Brief Template:**
```
Role: Experimenter
Objective: Build cheapest PoC that could kill the idea.
Riskiest assumption: [specific assumption]
Metric to instrument: [single falsifiable metric]
Time budget: [minutes/hours]
Deliverable: [path to PoC + measurement results]
Failure condition: [metric shows assumption is false]
```

#### Builder

**File:** `kernel/roles/builder.md`

**Brief Template:**
```
Role: Builder
Contract: [path to contract.md]
Status: active
Mandatory skills: [list per task type]
Files to create: [specific list]
Tests to write/run: [specific commands]
No scope creep: stay within contract
Deliverable: [implementation + test receipts]
```

#### Evaluator

**File:** `kernel/roles/evaluator.md`

**Brief Template:**
```
Role: Evaluator
Contract: [path to contract.md] ONLY
Artifacts: [paths to built artifacts]
NEVER: builder transcript, reasoning, chat history
Rubric: [world-class quality bar per task type]
Deliverable: [path to evidence-<slug>.md]
Failure condition: [any claim without command receipt]
```

**Epistemic isolation:** Evaluator receives ONLY file paths, never builder context.

### 7. Process Oracles

**File:** `kernel/scripts/process-oracle.mjs`

**Oracle Types:**

| Oracle | Trigger | Command | Success Condition |
|--------|---------|---------|-------------------|
| Lint | After code edit | `npm run lint` / `ruff check` | Exit 0 |
| Typecheck | After code edit | `tsc --noEmit` / `mypy` | Exit 0 |
| Schema | After API claim | `curl + schema validate` | Schema valid |
| Test | After implementation | `npm test` / `pytest` | Exit 0 |
| API probe | After API change | `curl endpoint` | 200 + expected response |
| Migration | After DB change | `dry-run migration` | Exit 0 |
| A11y | After UI build | `playwright a11y` | No violations |
| Build | After package change | `npm run build` | Exit 0 |

**VPR Integration:**
Each oracle returns `F(s_t, a_t)` score:
- 1.0 = perfect success
- 0.5 = partial success (warnings)
- 0.0 = failure
- -1.0 = regression (worse than before)

### 8. A/B Testing Framework

**Schema:** `schemas/ab-test.schema.json`

```json
{
  "type": "object",
  "properties": {
    "hypothesis": {"type": "string"},
    "metric": {"type": "string"},
    "design_a": {"type": "object"},
    "design_b": {"type": "object"},
    "sample_size": {"type": "number"},
    "significance": {"type": "number"}
  },
  "required": ["hypothesis", "metric", "design_a", "design_b"]
}
```

**Implementation:** `scripts/ab-test.mjs`

**Process:**
1. Build both designs cheaply
2. Run identical measurement harness
3. Compare on North Star metric
4. Apply statistical significance test
5. Select winner or declare inconclusive

### 9. Baseline Table Generation

**File:** `scripts/baseline.mjs`

**Output Format:**

| Solution | Metric | Source | Notes |
|----------|--------|--------|-------|
| Do nothing | 0 users | N/A | Status quo |
| Competitor A | 10k users | public data | Verified 2024-08 |
| Competitor B | 5k users | public data | Verified 2024-08 |
| Our target | 100k users | user stated | To be validated |

**Automation:**
- Web search for competitor metrics
- GitHub stars/active users for open source
- App store rankings for mobile
- Manual entry for proprietary data

### 10. Design Token Enforcement

**File:** `schemas/design-tokens.schema.json`

**Required Fields:**
```json
{
  "colors": {
    "primary": {"hex": "#XXXXXX", "name": "subject-specific"},
    "secondary": {"hex": "#XXXXXX", "name": "subject-specific"},
    "accent": {"hex": "#XXXXXX", "name": "subject-specific"},
    "background": {"hex": "#XXXXXX", "name": "subject-specific"},
    "foreground": {"hex": "#XXXXXX", "name": "subject-specific"},
    "error": {"hex": "#XXXXXX", "name": "subject-specific"}
  },
  "typography": {
    "display": {"family": "not same as body", "size": "XXpx"},
    "body": {"family": "not same as display", "size": "XXpx"}
  },
  "layout": {
    "wireframe": "ASCII or diagram",
    "signature": "single distinctive element"
  }
}
```

**AI-Slop Checklist:**
- [ ] No purple/indigo defaults
- [ ] No gradient-everything
- [ ] No rounded-2xl-everything
- [ ] No stock card grids
- [ ] No oversized uniform padding
- [ ] No fake testimonials
- [ ] No lorem placeholder copy

**Enforcement:** evidence-check.mjs requires design tokens for UI contracts.

### 11. Audit Lineage System

**File:** `scripts/audit.mjs`

**Format:** JSONL (append-only)

```jsonl
{"timestamp":"2024-08-22T18:00:00Z","actor":"builder","action":"code_edit","detail":{"file":"src/main.ts","lines":"10-20","change":"added function"}}
{"timestamp":"2024-08-22T18:01:00Z","actor":"builder","action":"command","detail":{"command":"npm test","exit":0}}
{"timestamp":"2024-08-22T18:02:00Z","actor":"evaluator","action":"grade","detail":{"contract":"contracts/active/example.md","status":"proven"}}
```

**Triple-Correlation:**
- Process lineage (which agent, when)
- Temporal events (timestamp sequence)
- Content matching (file changes, command outputs)

### 12. Evolution Promotion System

**File:** `scripts/evolve.mjs`

**Promotion Rules:**
1. Pattern must survive ≥3 outcomes
2. Each outcome must be `proven` with evidence
3. Pattern must not increase failure rate
4. Constitution must stay ≤50 lines

**Process:**
1. Append to `evolve/log.md` after each outcome
2. Run `index-evolve.mjs` to count pattern survivals
3. When count ≥3, add to `evolve/PROMOTIONS.md`
4. Manual review before constitution promotion
5. Promote to CONSTITUTION.md only if ≤50 lines total

**Ralph Loop Cap:**
- Maximum 12 iterations per capability
- If still red after 12, stop and read failures
- Never uncapped (money fire risk)

### 13. Intake Schema Validation

**File:** `schemas/intake.schema.json`

```json
{
  "type": "object",
  "properties": {
    "job": {"type": "string"},
    "north_star_metric": {"type": "string", "pattern": "\\d+.*|.*\\d+.*"},
    "assumptions": {"type": "array", "items": {"type": "string"}},
    "kill_criteria": {"type": "array", "items": {"type": "string"}},
    "verification_plan": {"type": "array", "items": {"type": "string"}},
    "terminal_outcomes": {"$ref": "#/definitions/terminalOutcomes"}
  },
  "required": ["job", "north_star_metric"],
  "definitions": {
    "terminalOutcomes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "slug": {"type": "string"},
          "job": {"type": "string"},
          "north_star_metric": {"type": "string"},
          "depends_on": {"type": "array", "items": {"type": "string"}},
          "independent": {"type": "boolean"}
        },
        "required": ["slug", "job", "north_star_metric"]
      }
    }
  }
}
```

**Validation:** Router Step 1 validates non-trivial intake against this schema before proceeding.

## Installation System

### Cross-Platform Support

**Windows:** PowerShell script (`install.ps1`)
**macOS/Linux:** Bash script (`install.sh`)
**Universal:** Node.js installer (`install.mjs`)

### Auto-Detection Logic

**Tools Detected:**
- Cursor (`.cursor/`)
- VS Code (`.config/Code/User/` or `AppData/Roaming/Code/User/`)
- opencode (`.config/opencode/` or `AppData/Roaming/opencode/`)
- Claude Code (`.claude/`)
- OpenClaw (`.openclaw/`)
- Windsurf (`.codeium/windsurf/`)
- Continue (`.continue/`)
- Devin (`.devin/`)

**Detection per platform:**
```javascript
const paths = {
  cursor: join(home, ".cursor"),
  vscode: join(home, isWin ? "AppData/Roaming/Code/User" : ".config/Code/User"),
  opencode: join(home, isWin ? "AppData/Roaming/opencode" : ".config/opencode"),
  opencodeAlt: join(home, ".config", "opencode"),
  claude: join(home, ".claude"),
  openclaw: join(home, ".openclaw"),
  windsurf: join(home, ".codeium", "windsurf"),
  continue: join(home, ".continue"),
  devin: join(home, ".devin"),
};
```

### Community Skills Installation

**Process:**
1. Clone each skill to `skills/community/<name>/`
2. Pin to specific commit/tag
3. Create skill manifest
4. Resolve conflicts during load

**Skills:**
```bash
git clone --depth 1 https://github.com/obra/superpowers.git skills/community/superpowers
git clone --depth 1 https://github.com/addyosmani/agent-skills.git skills/community/agent-skills
git clone --depth 1 https://github.com/mattpocock/skills.git skills/community/grill-me
git clone --depth 1 https://github.com/anthropics/skills.git skills/community/anthropic-skills
git clone --depth 1 https://github.com/snarktank/ralph.git skills/community/ralph
git clone --depth 1 https://github.com/safaiyeh/app-store-review-skill.git skills/community/app-store-review
git clone --depth 1 https://github.com/ccusage/ccusage.git skills/community/ccusage
```

### Local LLM Hub Installation

**Flag:** `--with-hub`

**Process:**
1. Copy `hub/` directory to `~/.agents/prompt-os/hub/`
2. Install Node dependencies
3. Check for Ollama at `http://localhost:11434`
4. Verify model availability
5. Start server: `node ~/.agents/prompt-os/hub/server.mjs`

### Migration from Legacy

**Legacy Detection:**
- `~/.agents/outcome-os/` → migrate contracts, evolve, audit, benchmarks
- Existing POS rules → replace with unified router
- Old wiring → detect and update

**Migration Process:**
1. Backup existing to `~/.agents/.backup-{timestamp}/`
2. Copy contracts to new structure
3. Update router pointer
4. Rewire IDEs/CLIs
5. Write migration marker

### Validation

**Doctor Command:**
```bash
node ~/.agents/prompt-os/bin/pos.mjs doctor
```

**Checks:**
- Router file exists and is readable
- Constitution file exists
- All required directories present
- Wiring manifest valid
- Skills loaded without conflicts
- Hub health (if installed)
- Git spine accessible

## Failure Modes & Fixes

| Failure | Fix |
|---------|-----|
| Empty subagent response | Deliverable-on-disk protocol; write evidence file first |
| Cross-contract evidence | Stem-priority; no shared fallback |
| Generic UI shipped | Mandatory design-token + AI-slop gate |
| LLM agreeableness | Minority veto panel |
| Infinite loops | Watchdog exit 10/11; Ralph cap 12 |
| Skill conflicts | Conflict resolution in skill-loader.mjs |
| Hub model missing | Fallback to alternative model or error |
| Git spine failure | Error before contract start |
| Schema validation fail | Block contract creation |

## OS Health Dashboard

**Monthly Metrics:**
- Placeholder-metric rate
- False-proven rate
- Evaluator–oracle disagreement
- Stall rate
- Promotion regression rate
- Skill conflict rate
- Hub success rate

**Tracking:** `scripts/health-dashboard.mjs` generates monthly report.

## Optional: eBPF GoSolo Layer

**Platform:** Linux only, requires root

**Implementation:** `pos-ebpf` package (separate install)

**Functionality:**
- TLS payload interception
- execve/fork system call hooks
- Automatic routing of nested agent LLM calls
- No per-tool wiring needed

**Documentation:** `docs/EBPF.md`

## Implementation Phases

### Phase 1: Core Kernel
- [ ] CONSTITUTION.md
- [ ] PROMPT-ROUTER.md
- [ ] Role definitions
- [ ] Core scripts (evidence-check, watchdog, audit)
- [ ] Schema validation

### Phase 2: Community Skills
- [ ] Skill loader
- [ ] Community skill integration
- [ ] Conflict resolution
- [ ] Skill manifests

### Phase 3: Verification Hierarchy
- [ ] Process oracles
- [ ] Multi-judge panel
- [ ] Bias correction
- [ ] A/B testing framework

### Phase 4: Installation System
- [ ] Cross-platform installers
- [ ] Auto-detection
- [ ] Wiring adapters
- [ ] Migration logic
- [ ] Validation tools

### Phase 5: Local LLM Hub
- [ ] Multi-model gateway
- [ ] Role-based routing
- [ ] OpenAI compatibility
- [ ] Tool calling support

### Phase 6: Evolution System
- [ ] Audit lineage
- [ ] Evolution log
- [ ] Promotion system
- [ ] Health dashboard

### Phase 7: Documentation
- [ ] README
- [ ] Architecture docs
- [ ] Tenets docs
- [ ] Installation guide
- [ ] GitHub Pages site

## Success Criteria

**Installation:**
- One-command install on Windows, macOS, Linux
- Auto-detects and wires all installed IDEs/CLIs
- Validates installation with doctor command
- Migrates legacy installations

**Verification:**
- evidence-check.mjs enforces verification hierarchy
- Multi-judge panel with minority veto
- Process oracles provide turn-level feedback
- A/B testing for design decisions

**Community:**
- All VibeSetup skills integrated
- Conflict resolution prevents methodology conflicts
- Skills load on demand
- Version pinning ensures stability

**Evolution:**
- Audit lineage tracks all changes
- Promotion system enforces 3-outcome rule
- Constitution stays ≤50 lines
- Health dashboard tracks metrics

**Universality:**
- Works with any IDE/CLI/agent
- Single router file drives all tools
- Optional eBPF layer for kernel-level routing
- Local LLM hub for compute routing
