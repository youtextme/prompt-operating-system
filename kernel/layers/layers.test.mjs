#!/usr/bin/env node
/**
 * Seven-layer objective runner tests — predicates from the design paper.
 */
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeNeed, validateNeed } from "./need.mjs";
import { writeContext, isAuthorized, loadContext } from "./context.mjs";
import { declarePhase, recordObservation, validateHypotheses } from "./hypothesis.mjs";
import { scanClaims, gradeTruth } from "./truth.mjs";
import { critique, critiqueRun } from "./critique.mjs";
import { retrieve, budgetLeft } from "./retrieve.mjs";
import { bootstrapRun, runAutonomy, tick } from "./autonomy.mjs";
import { findTheater } from "./common.mjs";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    process.stderr.write("FAIL " + msg + "\n");
  } else {
    process.stdout.write("ok   " + msg + "\n");
  }
}

const scratch = mkdtempSync(join(tmpdir(), "pos-layers-"));
process.env.PROMPT_OS_ROOT = scratch;

// --- Layer 1 Need ---
{
  const bad = writeNeed("short");
  assert(bad.code === 2, "L1 rejects short ask");
  const good = writeNeed("Ship a checkable research brief on LLM self-correction limits");
  assert(good.ok && existsSync(good.path), "L1 writes objective.json before workers");
  assert(validateNeed(good.objective).ok, "L1 validates success+kill+DoD");
  assert(good.objective.success.length >= 1 && good.objective.kill.length >= 1, "L1 has success and kill");
}

// --- Layer 2 Context ---
{
  const need = writeNeed("Build context brief for authorized tool inventory test");
  const ctx = writeContext(need.root);
  assert(ctx.ok && existsSync(ctx.manifestPath) && existsSync(ctx.briefPath), "L2 writes manifest + brief");
  assert(loadContext(need.root).ok, "L2 loadContext passes");
  assert(isAuthorized(need.root, need.path), "L2 authorizes objective path");
  assert(!isAuthorized(need.root, "/etc/passwd"), "L2 refuses path not in brief");
}

// --- Layer 3 Hypothesis ---
{
  const need = writeNeed("Test falsifiable hypothesis logging for phase P1");
  writeContext(need.root);
  const d = declarePhase(need.root, {
    hypothesis: "Querying the ledger returns at least one row",
    test: "row_count > 0",
  });
  assert(d.ok, "L3 declare phase");
  const obs = recordObservation(need.root, "P1", { held: false, note: "row_count=0" });
  assert(obs.ok && obs.observation.refuted, "L3 records refutation");
  assert(existsSync(join(need.root, "refuted-hypotheses.jsonl")), "L3 refuted log on disk");
  assert(validateHypotheses(need.root).ok, "L3 validate after observation");
}

// --- Layer 4 Truth ---
{
  const unsupported = scanClaims("Revenue grew 42% last quarter with no citation.");
  assert(!unsupported.ok && unsupported.unsupported.length >= 1, "L4 flags unsupported percent");

  const supported = scanClaims(
    "Revenue grew 42% last quarter (source: https://example.com/10k) [source].",
  );
  assert(supported.ok, "L4 accepts nearby source marker");

  const tagged = scanClaims("The exact figure is 42% [unverified].");
  assert(tagged.ok, "L4 accepts unverified tag");
}

// --- Layer 5 Critique ---
{
  assert(findTheater("I am done with this task").length > 0, "L5 theater detector hits self-done");
  const boot = bootstrapRun("Produce a sourced note on prover-verifier games");
  assert(boot.ok, "bootstrap for critique");
  // Write a clean artifact
  const art = join(boot.runDir, `artifacts/${boot.objective.slug}.md`);
  writeFileSync(
    art,
    [
      "# Note",
      "",
      "Prover-verifier games improve legibility (https://arxiv.org/abs/2407.13692) [source].",
      "",
      "## Steps",
      "",
      "1. Read objective — result: loaded",
      "2. Cite paper — result: linked",
      "",
    ].join("\n"),
    "utf8",
  );
  // Ensure P1 observation exists for hypothesis validate when status open — declare already open is ok
  const g = critiqueRun(boot.runDir);
  assert(g.ok && g.code === 0, "L5 critique passes clean artifact: " + g.reason);

  writeFileSync(art, "I tried my best and I am done. Growth was 99%.\n", "utf8");
  const bad = critiqueRun(boot.runDir);
  assert(!bad.ok && bad.code === 2, "L5 critique fails theater + unsupported");
}

// --- Layer 6 Retrieve ---
{
  const need = writeNeed("Bounded retrieval gap test for new information layer");
  writeContext(need.root);
  // Shrink budget
  const obj = JSON.parse(readFileSync(join(need.root, "objective.json"), "utf8"));
  obj.boundary.max_retrievals = 2;
  writeFileSync(join(need.root, "objective.json"), JSON.stringify(obj, null, 2));

  const r1 = retrieve(need.root, {
    gap: "baseline self-correction failure rate",
    source: "arxiv",
    url: "https://arxiv.org/abs/2310.01798",
    content: "Huang et al. 2023",
  });
  assert(r1.ok && existsSync(r1.path), "L6 writes retrieval to disk");
  assert(r1.record.gap && r1.record.retrieved_at, "L6 names gap + timestamp");

  const denied = retrieve(need.root, {
    gap: "secret file",
    source: "/etc/shadow",
  });
  assert(!denied.ok, "L6 gateway refuses unauthorized path");

  retrieve(need.root, { gap: "second gap item here", source: "web", content: "x" });
  const over = retrieve(need.root, { gap: "third gap should fail budget", source: "web" });
  assert(!over.ok && /budget/.test(over.reason), "L6 enforces retrieval budget");
}

// --- Layer 7 Autonomy ---
{
  const run = runAutonomy("Demonstrate MAPE-K autonomy loop for objective runner", {
    writeDemoArtifact: true,
  });
  assert(run.ok, "L7 runAutonomy returns ok");
  assert(existsSync(join(run.runDir, "objective.json")), "L7 has objective");
  assert(existsSync(join(run.runDir, "context-brief.md")), "L7 has context brief");
  assert(existsSync(join(run.runDir, "next-action.json")), "L7 writes next_action");
  assert(
    run.status === "proven" || run.status === "repairing" || run.status === "killed",
    "L7 terminates in proven|repairing|killed not silent hang: " + run.status,
  );
}

// cleanup
try {
  rmSync(scratch, { recursive: true, force: true });
} catch {
  /* ignore */
}

if (failed) {
  process.stderr.write(`\n${failed} assertion(s) failed\n`);
  process.exit(1);
}
process.stdout.write("\nall seven-layer tests passed\n");
process.exit(0);
