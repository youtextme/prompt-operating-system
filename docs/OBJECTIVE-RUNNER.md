# Prompt Operating System — a design for objective runners

An **objective runner** is the thin operating system that sits between a prompt and a large language model. Its job is to convert a natural-language ask into an artifact that can be checked by something other than the model that produced it. This paper explains why that shape is needed, the seven layers of thought it implements, how each layer is realized in code without depending on any single library, and how a team can build one from scratch. Every claim below is either a design choice, a public reference, or an experimental hypothesis. Nothing in this paper depends on any private repository. Public implementations are cited so a reader can compare the design to actual working code.

**Implementation in this repo:** `kernel/layers/` · CLI: `pos layers` · Tests: `kernel/layers/layers.test.mjs`

---

## 1. Why an objective runner is required

Modern LLMs are very capable at token completion but weak at three things that matter for real work: they do not know what "done" means for the user, they are willing to fabricate sources, and they cannot reliably verify their own output. Simple "prompt and reply" flows inherit these weaknesses. Recent work on self-correction found that LLMs often fail to fix their own reasoning errors without external feedback (see Huang et al. 2023). LLM-as-judge scoring shows position and verbosity bias when the same model both writes and grades (see Zheng et al. 2023). Truthfulness itself degrades when generation is unbounded — recent work on hallucination detection uses semantic entropy across sampled generations to flag statements the model is not confident in (see Farquhar et al. 2024, Nature).

The consequence is that a runner cannot be a wrapper that "asks the model harder." It has to be an operating system that:

1. **Freezes the objective** before generation so success is checkable
2. **Gathers context** from real sources instead of the model's memory
3. **Separates the writer from the grader** so passing the bar is not a self-report
4. **Records enough state** that failure produces a next action instead of a dead end

Sources for these design commitments include [arxiv.org/abs/2310.01798](https://arxiv.org/abs/2310.01798) and [arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685).

### References for this section

- Huang et al. 2023, *Large Language Models Cannot Self-Correct Reasoning Yet* — [arxiv.org/abs/2310.01798](https://arxiv.org/abs/2310.01798)
- Zheng et al. 2023, *Judging LLM-as-a-Judge* — [arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685)
- Farquhar et al. 2024, *Detecting hallucinations in large language models using semantic entropy* — [nature.com/articles/s41586-024-07421-0](https://www.nature.com/articles/s41586-024-07421-0)

---

## 2. The seven layers of thought

The design has seven layers. Each layer is stated as a concept, then as a set of checkable predicates, then as an implementation approach that does not depend on any particular framework. Public research and open-source projects that share the same idea are linked under each layer.

| Layer | Name | Code |
|------:|------|------|
| 1 | Need | `kernel/layers/need.mjs` |
| 2 | Context (Awareness) | `kernel/layers/context.mjs` |
| 3 | Hypothesis | `kernel/layers/hypothesis.mjs` |
| 4 | Truth-seeking | `kernel/layers/truth.mjs` |
| 5 | Critique | `kernel/layers/critique.mjs` |
| 6 | New information | `kernel/layers/retrieve.mjs` |
| 7 | Autonomy (MAPE-K) | `kernel/layers/autonomy.mjs` |

### Layer 1 — Need

*Source: [github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy)*

**Concept.** Before any generation happens, the runner writes down what "met" looks like. This has three parts: the **success signal** (what the artifact must contain or achieve), the **kill criterion** (what would prove the objective is unreachable), and the **boundary** (time, cost, or tool budget beyond which the runner stops and reports). Without this, "the model tried its best" becomes the definition of done, which is exactly the failure mode Huang et al. documented in self-correction.

**Predicates.** The objective file exists on disk before workers spawn. It contains at least one measurable success statement and at least one kill statement. It contains a boolean definition-of-done that can be evaluated by a program without the model. Source for the compile-not-prompt idea: [arxiv.org/abs/2310.03714](https://arxiv.org/abs/2310.03714).

**Implementation.** Compile the natural-language ask into a small typed document (`objective.json` + `objective.md`). Frameworks like DSPy treat this as "programming, not prompting" — the objective is a signature with typed inputs and outputs, not a paragraph. If DSPy is not used, plain JSON/YAML or Markdown with a rigid header works. The rule is that the objective must be parseable by a checker without invoking the model.

```bash
pos layers need "Ship a sourced brief on LLM self-correction limits"
# → ~/.agents/prompt-os/runs/<slug>/objective.json
```

**References.** Khattab et al. 2024, DSPy — [arxiv.org/abs/2310.03714](https://arxiv.org/abs/2310.03714) · [github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy)

---

### Layer 2 — Context (Awareness)

*Source: [ieeexplore.ieee.org/document/1160055](https://ieeexplore.ieee.org/document/1160055)*

**Concept.** Before generation, the runner takes an inventory of what is reachable: which model is bound to the run, which tools have credentials, what the wall-clock and token budgets are, and what constitutional rules apply. This snapshot is what the model will be allowed to use. Anything not in the snapshot is off-limits. This mirrors the MAPE-K autonomic loop from IBM's autonomic computing work — Monitor, Analyze, Plan, Execute, over a shared Knowledge base.

**Predicates.** A context brief lists every file, tool, or endpoint the model is permitted to read. Every entry has a source path or an endpoint and a timestamp. Anything the model tries to use that is not in the brief is refused by the tool layer, not by the model. Source for schema-typed tool exposure: [github.com/modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol).

**Implementation.** Two files: a machine-readable `context-manifest.json` of authorised tools and paths, and a human-readable `context-brief.md` that the worker reads first. The Model Context Protocol is the emerging open standard for exposing tools and resources to LLMs with typed schemas; the runner uses it or a similar registry as the source of truth for "what is reachable." Grounding-focused retrieval literature is the theoretical basis for why context must be sourced rather than remembered ([arxiv.org/abs/2005.11401](https://arxiv.org/abs/2005.11401)).

```bash
pos layers context ~/.agents/prompt-os/runs/<slug>
```

**References.** Kephart & Chess 2003, *The Vision of Autonomic Computing* · Lewis et al. 2020, RAG · Model Context Protocol

---

### Layer 3 — Hypothesis

*Source: [arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)*

**Concept.** For any non-trivial objective, the runner writes at least one falsifiable hypothesis about how the work will succeed, and the observable test that would refute it. This makes the run a scientific step rather than a guess. Popper's demarcation criterion is the philosophical basis; in agent design it appears operationally as ReAct's reason–act–observe cycle where each act is a testable prediction.

**Predicates.** Each phase declares a hypothesis with a stated observation that would falsify it. The observation is recorded to disk when the phase ends, whether the hypothesis held or not. Refuted hypotheses are logged as data, not silently dropped.

**Implementation.** A phase-level plan file (`phase-plan.json`) with three fields per phase — hypothesis, cheapest observable test, and the artifact that carries the observation. Refutations append to `refuted-hypotheses.jsonl`.

```bash
pos layers hypothesis declare <run-dir> --hypothesis "…" --test "…"
pos layers hypothesis observe <run-dir> P1 --refuted --note "row_count=0"
```

**References.** Yao et al. 2022, ReAct — [arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)

---

### Layer 4 — Truth-seeking

*Source: [arxiv.org/abs/2305.14251](https://arxiv.org/abs/2305.14251)*

**Concept.** Every numeric claim, URL, or factual assertion in the artifact must be traceable to a source, or explicitly labeled as unverified. This is not politeness — it is the mechanism that makes the artifact auditable by a third party. Relevant public research includes atomic-fact-level attribution (FActScore), chain-of-verification, and semantic entropy for detecting fabricated content.

**Predicates.** Every number or URL in the artifact has a source token within a small text window (a paragraph, or a bracketed citation). Uncertain claims are explicitly tagged with an unverified marker rather than presented as fact. Entropy across sampled generations of the same claim is bounded, or the claim is labeled.

**Implementation.** A grader (`truth.mjs`) scans the artifact with two families of regular expressions: one that finds numeric or URL claims, and one that finds source markers or unverified tags in the neighborhood. Claims without a nearby source or tag count as unsupported. For higher-stakes runs, the writer may generate the same claim *k* times at nonzero temperature; if the sampled variants disagree beyond a threshold the claim is downgraded to unverified. Conformal-prediction bounds can wrap this to give a formal false-discovery guarantee ([arxiv.org/abs/2107.07511](https://arxiv.org/abs/2107.07511)).

```bash
pos layers truth path/to/artifact.md --run <run-dir>
```

**References.** Min et al. 2023 FActScore · Dhuliawala et al. 2023 Chain-of-Verification · Wang et al. 2022 Self-Consistency · Farquhar et al. 2024 Semantic entropy · Angelopoulos & Bates 2021 Conformal Prediction

---

### Layer 5 — Critique

*Source: [arxiv.org/abs/2407.13692](https://arxiv.org/abs/2407.13692)*

**Concept.** The writer never grades itself. A weaker independent verifier examines the artifact against the predicates from Layers 1 and 4 and emits a boolean pass or fail. This is the operational form of the prover–verifier games proposal. Related work on process supervision shows that grading intermediate steps beats grading only the final answer ([arxiv.org/abs/2305.20050](https://arxiv.org/abs/2305.20050)). The LLM-as-judge caveat is that when the judge is the same class of model as the writer, position, verbosity, and family bias will corrupt the score ([arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685)).

**Predicates.** The critic runs as a separate process with no access to the writer's chain of thought. Its inputs are the artifact bytes and the objective file only. Its output is a machine-checked pass or fail, not a numeric score presented as approval.

**Implementation.** `critique.mjs` takes the run directory and returns exit **0** or exit **2**. It combines predicates into a boolean formula: no theater ∧ zero unsupported claims ∧ hypotheses logged ∧ context brief present. A numeric quality score can be reported alongside but **cannot flip the boolean**. Theater patterns — the writer declaring itself done, or repeating "please improve" as if that were an improvement — are matched by regex and fail closed.

```bash
pos layers critique <run-dir>
# exit 0 = pass; exit 2 = fail
```

**References.** Lightman et al. 2023, *Let's Verify Step by Step* · Kirchner et al. 2024, Prover–Verifier Games · Zheng et al. 2023, Judging LLM-as-a-Judge

---

### Layer 6 — New information

*Source: [arxiv.org/abs/2005.11401](https://arxiv.org/abs/2005.11401)*

**Concept.** Search and retrieval are expensive, and unbounded search is the fastest way to burn tokens without progress. The runner fires a search only when a bounded gap has been identified, and every retrieved artifact writes to disk so subsequent phases work from files rather than from memory of a scroll. This is the retrieval-augmented generation pattern applied at the task level rather than at the token level.

**Predicates.** Every search call names the gap it is filling and the source it is querying. Retrieved content lands on disk with a URL and timestamp before it is used in generation. A budget on retrievals per phase is enforced by the tool gateway, not by the model.

**Implementation.** `retrieve.mjs` takes `gap`, `source`, and budget parameters and writes the result to a phase-scoped folder under `retrieval/`. The next phase reads the file, not the network. Modern agent frameworks such as LangGraph, smolagents, and AutoGen all implement a variant of this pattern; the difference here is that the gap and budget are declared before the call, and the file trail is auditable.

```bash
pos layers retrieve <run-dir> --gap "baseline failure rate" --source arxiv --url https://arxiv.org/abs/2310.01798
```

**References.** Lewis et al. 2020 RAG · [LangGraph](https://github.com/langchain-ai/langgraph) · [smolagents](https://github.com/huggingface/smolagents) · [AutoGen](https://github.com/microsoft/autogen)

---

### Layer 7 — Autonomy

*Source: [ieeexplore.ieee.org/document/1160055](https://ieeexplore.ieee.org/document/1160055)*

**Concept.** Layers 1–6 are capabilities. Layer 7 is the loop that uses them. After every critique, the runner updates shared Knowledge and either stops (proven / killed / boundary) or writes a concrete `next-action` to disk. Failure never ends in silence. This is MAPE-K — Monitor, Analyze, Plan, Execute — applied to a single objective run.

**Predicates.** Every run has `autonomy-state.json`. Every non-terminal tick writes `next-action.json` with a kind and reason. The loop is bounded by Layer 1 boundary (`max_phases`, `wall_clock_minutes`, kill criteria). Terminal statuses are only `proven`, `killed`, or `blocked` (waiting on a human/writer gate).

**Implementation.** `autonomy.mjs` bootstraps Layers 1–3, optionally retrieves (Layer 6), writes or accepts an artifact, runs Critique (Layer 5), and either marks the run proven or plans a repair phase. The host model is the writer; the kernel remains the OS.

```bash
pos layers run "Demonstrate a checkable artifact for X"
# → run dir with objective, context, hypotheses, critique-report, next-action / result
```

**References.** Kephart & Chess 2003, *The Vision of Autonomic Computing* · Kirchner et al. 2024, Prover–Verifier Games (legibility under autonomous iteration)

---

## 3. How the layers compose

```
ask
 │
 ▼
┌─────────┐   ┌──────────┐   ┌────────────┐
│ 1 Need  │──▶│ 2 Context│──▶│ 3 Hypothesis│
└─────────┘   └──────────┘   └─────┬──────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │6 Retrieve│  │  writer  │  │4 Truth   │
              └──────────┘  └────┬─────┘  └────▲─────┘
                                 │             │
                                 ▼             │
                           ┌──────────┐        │
                           │5 Critique│────────┘
                           └────┬─────┘
                                │
                     pass ──────┤────── fail
                        ▼       │         ▼
                   proven    ┌──┴───┐  next-action
                             │7 MAPE│  (repair / stop)
                             └──────┘
```

The existing Prompt OS contract / `evidence-check` / evaluator path remains the **product-shipping** gate for software outcomes. The seven layers are the **objective-runner kernel** that freezes Need, grounds Context, and separates Critique for any checkable artifact — research briefs, matrices, plans, and code alike.

---

## 4. Build one from scratch

Minimum viable objective runner (no framework required):

1. Write `objective.json` with `success[]`, `kill[]`, `boundary`, `definition_of_done.checks[]` before any LLM call.
2. Write `context-manifest.json` listing allowed paths/tools with timestamps.
3. For each phase, write hypothesis + cheapest test; on end, write observation JSON (including refutations).
4. Scan the artifact for numbers/URLs; require nearby `[source]` / `[unverified]` / URL.
5. Run a separate process that exits 0/2; ban theater regexes; ignore any numeric "confidence" for the boolean.
6. Allow retrieval only with `--gap` + `--source`; enforce a counter; write files before generation reads them.
7. Loop with a state file and `next-action.json` until proven, killed, or boundary.

This repository's `kernel/layers/` is one such implementation. Swap the storage format (YAML, SQLite, git notes) freely — keep the predicates.

---

## 5. Relation to Prompt OS tenets

| Layer | Closest tenet / primitive |
|------:|---------------------------|
| 1 Need | TerminalOutcomes + contract + intake schema |
| 2 Context | detect-environment + gateway allowlist |
| 3 Hypothesis | Assumptions table + cheapest experiment |
| 4 Truth | cite-or-kill / WayofWorking |
| 5 Critique | evidence-check + Evaluator ≠ Builder |
| 6 Retrieve | RAG at task level; audit JSONL |
| 7 Autonomy | GoSolo + FeedbackLoop gates + Ralph cap |

See also [ARCHITECTURE.md](./ARCHITECTURE.md), [TENETS.md](./TENETS.md), [PRIMITIVES.md](./PRIMITIVES.md).
