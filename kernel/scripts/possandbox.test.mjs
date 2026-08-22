#!/usr/bin/env node
import { classifyPrompt, suggestSlices, runSandbox } from "./possandbox.mjs";
import { computeReward } from "./reward.mjs";
import { gradeSlice } from "./program.mjs";

let failed = 0;
const assert = (c, m) => { if (!c) { failed++; process.stderr.write("FAIL " + m + "\n"); } };

{
  const c = classifyPrompt("what is 2+2");
  assert(c.classification === "trivial", "short math is trivial");
}
{
  const c = classifyPrompt("Build a REST API for tasks with auth");
  assert(c.classification === "non_trivial", "build is non_trivial");
}
{
  const c = classifyPrompt("Create a baby name site browse 50000 names spend 8 hours research hundreds of agents incremental");
  assert(c.classification === "program", "long incremental is program");
  const slices = suggestSlices("baby names 50000 browse 8 hours", "program");
  assert(slices.length >= 3, "program gets slices");
}
{
  const r = computeReward({ humanUsable: true, humanVerifySteps: 3, commandReceipts: 2, barRaiser: true });
  assert(r.G > 0.4, "good slice scores high G");
}
{
  const slice = `# Slice: t
Status: proven
## Human-usable deliverable
research/report.md
## Human verify
- [ ] read report
## Command evidence
`;
  const ev = "Evaluator: ok\n## Command evidence\n$ npm test\nexit:0\n";
  const g = gradeSlice({ sliceText: slice, evidenceText: ev, claimDone: true });
  assert(g.code === 0, "slice proven passes");
}

{
  const r = await runSandbox("rename foo to bar", { gist: false });
  assert(r.trace.steps.length >= 2, "sandbox produces steps");
  assert(r.tracePath, "trace file written");
}

if (failed) process.exit(1);
process.stdout.write("possandbox tests ok\n");
