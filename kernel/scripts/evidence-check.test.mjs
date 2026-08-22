#!/usr/bin/env node
import {
  grade,
  parseContract,
  extractCommandEvidence,
  countCommandPairs,
  isUIContract,
  hasBarRaiserEvidence,
  hasDesignEvidence,
} from "./evidence-check.mjs";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    process.stderr.write("FAIL " + msg + "\n");
  }
}

const commandEvidence = `## Command evidence
$ node scripts/evidence-check.mjs contract.md --done
exit:0
$ npm test
exit:0
`;

const barRaiserNote = `Bar-raiser: baseline table with 3 competitors + "do nothing" verified; PoC commit abc123; kill-criteria K1 measured (not fired).`;
const designNote = `Design tokens: palette #1A1A2E #16213E #0F3460 #E94560 #FFFFFF; display Inter Tight 700, body Inter 400, mono JetBrains Mono; wireframe [hero|grid|detail]; signature: chapter-marker compass.`;

const skeleton = `# Outcome contract: demo
Status: active
## Job
Teach kids sudoku.
## North Star
- Metric: median unseen-puzzle solve time under 8 minutes by day 15
## Assumptions (falsify these)
| ID | Assumption | How to kill it | Result |
## Kill criteria
Stop if transfer eval is flat after 5 sessions.
## Evidence required for "done"
- [ ] Metric moved
## Command evidence
Minimum two pasted receipts: exact \`$ command\` lines each followed by its exit code.
`;

{
  const p = parseContract(skeleton);
  assert(p.missing.length === 0, "skeleton has required headings");
  assert(p.status === "active", "parses status");
  assert(!p.hasPlaceholderMetric, "metric is real");
}

{
  const r = grade({ claimDone: true });
  assert(r.code === 2, "done without contract fails");
}

{
  const r = grade({ contractText: skeleton, claimDone: false });
  assert(r.code === 0, "in-progress contract ok");
}

{
  const r = grade({ contractText: skeleton, claimDone: true });
  assert(r.code === 2 && /proven/.test(r.reason), "active cannot claim done");
}

{
  const proven = skeleton.replace("Status: active", "Status: proven");
  const r = grade({
    contractText: proven,
    evidenceText: `Evaluator: target met.\n${commandEvidence}\n${barRaiserNote}`,
    claimDone: true,
  });
  assert(r.code === 0, "proven + evaluator + command evidence + bar-raiser passes");
}

{
  const proven = skeleton.replace("Status: active", "Status: proven");
  const r = grade({
    contractText: proven,
    evidenceText: `Evaluator: target met.\n${commandEvidence}`,
    claimDone: true,
  });
  assert(r.code === 2 && /bar-raiser/i.test(r.reason), "proven without bar-raiser evidence rejected");
}

{
  const uiSkeleton = skeleton.replace(
    "Teach kids sudoku.",
    "Build a UI page that teaches kids sudoku with a responsive design.",
  );
  const proven = uiSkeleton.replace("Status: active", "Status: proven");
  let r = grade({
    contractText: proven,
    evidenceText: `Evaluator: target met.\n${commandEvidence}\n${barRaiserNote}`,
    claimDone: true,
  });
  assert(r.code === 2 && /design-token|AI-slop/i.test(r.reason), "UI proven without design-token evidence rejected");

  r = grade({
    contractText: proven,
    evidenceText: `Evaluator: target met.\n${commandEvidence}\n${barRaiserNote}\n${designNote} AI-slop checklist: no purple-default, no gradient-everything, no rounded-2xl spam.`,
    claimDone: true,
  });
  assert(r.code === 0, "UI proven with design-token + slop evidence passes");
}

{
  assert(isUIContract("Build a component page with frontend design") === true, "isUIContract detects UI keywords");
  assert(isUIContract("Build designs to products marketing pipeline") === false, "isUIContract ignores bare design");
  assert(isUIContract("Teach kids sudoku via batch job") === false, "isUIContract ignores non-UI");
  assert(hasBarRaiserEvidence(barRaiserNote) === true, "hasBarRaiserEvidence detects baseline");
  assert(hasBarRaiserEvidence("looks good") === false, "hasBarRaiserEvidence rejects generic");
  assert(hasDesignEvidence(designNote) === true, "hasDesignEvidence detects palette");
  assert(hasDesignEvidence("nice colors") === false, "hasDesignEvidence rejects vague");
}

{
  const proven = skeleton.replace("Status: active", "Status: proven");
  const r = grade({
    contractText: proven,
    evidenceText:
      "Evaluator: target not met; Builder self-grade rejected.",
    claimDone: true,
  });
  assert(
    r.code === 2 && /Command evidence/.test(r.reason),
    "proven without command evidence block rejected",
  );
}

{
  const proven = skeleton.replace("Status: active", "Status: proven");
  const thin = "## Command evidence\n$ npm test\nexit:0\n";
  const r = grade({
    contractText: proven,
    evidenceText: `Evaluator: ok.\n${thin}`,
    claimDone: true,
  });
  assert(
    r.code === 2 && />=2/.test(r.reason),
    "proven with a single receipt rejected",
  );
}

{
  const ce = extractCommandEvidence(`intro\n${commandEvidence}## Next\nx`);
  assert(ce !== null && !/## Next/.test(ce), "extract stops at next heading");
  const counts = countCommandPairs(commandEvidence);
  assert(counts.commands === 2 && counts.exits === 2, "counts pairs");
}

{
  const noSection = skeleton.replace("## Command evidence\nMinimum two pasted receipts: exact `$ command` lines each followed by its exit code.\n", "");
  const proven = noSection.replace("Status: active", "Status: proven");
  const r = grade({
    contractText: proven,
    evidenceText: `Evaluator: ok.\n${commandEvidence}`,
    claimDone: true,
  });
  assert(
    r.code === 2 && /declare/.test(r.reason),
    "proven contract without declared command-evidence section rejected",
  );
}

// helper coverage already asserted above (isUIContract / has*Evidence)

// siblingEvidence resolution is exercised indirectly via CLI; unit-level guard:
// stem-named evidence must outrank a generic shared evidence.md (contamination guard)
{
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "evc-"));
  const contractA = path.join(tmp, "alpha.md");
  const stemEvidence = path.join(tmp, "evidence-alpha.md");
  const genericEvidence = path.join(tmp, "evidence.md");
  const provenWithCE = skeleton.replace("Status: active", "Status: proven");
  fs.writeFileSync(contractA, provenWithCE);
  fs.writeFileSync(stemEvidence, `Evaluator: alpha verdict.\n${commandEvidence}\n${barRaiserNote}`);
  fs.writeFileSync(genericEvidence, "Evaluator: unrelated contract's evidence.");
  const script = new URL("./evidence-check.mjs", import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, "$1");
  let out;
  try {
    execFileSync(process.execPath, [script, contractA, "--done"], { encoding: "utf8" });
    out = 0;
  } catch (e) {
    out = e.status;
  }
  assert(out === 0, "stem-named evidence outranks generic evidence.md");
}

{
  const proven = skeleton.replace("Status: active", "Status: proven");
  const r = grade({
    contractText: proven,
    evidenceText: "I the builder confirm it looks good.",
    claimDone: true,
  });
  assert(r.code === 2, "builder self-grade rejected");
}

{
  const killed = skeleton.replace("Status: active", "Status: killed");
  const r = grade({
    contractText: killed,
    evidenceText: "Evaluator: kill-criterion K1 hit; 15-day claim falsified.",
    claimDone: true,
  });
  assert(r.code === 0, "honest kill is done");
}

{
  const bad = skeleton.replace(
    "- Metric: median unseen-puzzle solve time under 8 minutes by day 15",
    "- Metric: TODO"
  );
  const r = grade({ contractText: bad, claimDone: false });
  assert(r.code === 2, "placeholder metric fails");
}

if (failed) {
  process.stderr.write(failed + " failed\n");
  process.exit(1);
}
process.stdout.write("ok\n");
