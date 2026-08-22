#!/usr/bin/env node
/**
 * Four end-to-end prompt scenarios through the real kernel path
 * (attest → inject → compat guard → banner → claim gate), each with the gaming
 * attempt a model would actually make.
 *
 *   S1 trivial prompt ................ answers, routed banner is exact, no contract demanded
 *   S2 kernel broken (degraded) ....... still answers, first line says NOT at play, claims blocked
 *   S3 non-trivial program prompt ..... only signed receipts + independent board certify done
 *   S4 tool/MCP-heavy prompt .......... every tool, MCP server and param survives POS
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attestPrompt } from "../enforce/attest.mjs";
import { BANNER_ROUTED, applyBanner, enforceBanner } from "../enforce/banner.mjs";
import { guardOutbound } from "../enforce/compat.mjs";
import { injectPosMessages, preserveClientPayload } from "../enforce/inject.mjs";
import { verifyChain } from "../lib/ledger.mjs";
import { hardGrade } from "./evidence-check.mjs";
import { runReceipt } from "./receipt.mjs";
import { checkTenets } from "./tenet-check.mjs";

let failed = 0;
function step(name, fn) {
  try {
    fn();
    process.stdout.write(`  ok   ${name}\n`);
  } catch (err) {
    failed += 1;
    process.stdout.write(`  FAIL ${name}: ${err.message}\n`);
  }
}

function makeKernel({ healthy }) {
  const root = mkdtempSync(join(tmpdir(), "pos-scn-"));
  const home = mkdtempSync(join(tmpdir(), "pos-scn-home-"));
  if (healthy) {
    mkdirSync(join(home, ".agents", "router"), { recursive: true });
    writeFileSync(join(home, ".agents", "router", "PROMPT-ROUTER.md"), "# router");
    writeFileSync(join(root, "CONSTITUTION.md"), "# constitution");
  }
  return { root, home };
}

/** The gateway's real sequence, minus the network hop. */
function runPrompt({ prompt, root, home, clientBody = {}, modelAnswer = "answer text" }) {
  const body = { model: "m", messages: [{ role: "user", content: prompt }], ...clientBody };
  const { messages } = injectPosMessages(body.messages, { routerPath: join(home, ".agents/router/PROMPT-ROUTER.md"), posRoot: root });
  const guarded = guardOutbound(body, { ...body, ...preserveClientPayload(body), messages });
  const att = attestPrompt({ prompt, surface: "scenario", root, home });
  const labelled = applyBanner(modelAnswer, {
    routed: att.state === "routed",
    reason: att.reason,
    attestationId: att.id,
    signature: att.signature,
  });
  const checked = enforceBanner(labelled, root);
  return { att, upstream: guarded, text: checked.text, routed: checked.routed, compat: guarded };
}

// ---------------------------------------------------------------- S1 trivial
{
  process.stdout.write("S1 trivial prompt: \"what is 2+2?\"\n");
  const { root, home } = makeKernel({ healthy: true });
  const r = runPrompt({ prompt: "what is 2+2?", root, home, modelAnswer: "4" });

  step("routed, exact first line", () => {
    assert.equal(r.att.state, "routed", r.att.reason);
    assert.equal(r.text.split("\n")[0], BANNER_ROUTED);
    assert.equal(r.routed, true);
  });
  step("answer body is preserved", () => assert.match(r.text, /\n4$|\n4\n/));
  step("trivial prompt needs no contract", () => {
    const t = checkTenets({ prompt: "what is 2+2?", classification: "trivial", attestation: { ok: true }, ledger: verifyChain("attest", root) });
    assert.equal(t.ok, true, t.violations.join(" | "));
  });
  step("gaming: model prepending the banner itself is rewritten", () => {
    const selfBannered = `${BANNER_ROUTED}\n<!-- pos:routed attest:att_0000000000000000 sig:000000000000 -->\n\n4`;
    const out = enforceBanner(selfBannered, root);
    assert.equal(out.forged, true);
    assert.match(out.text.split("\n")[0], /NOT at play/);
  });
}

// ---------------------------------------------------------------- S2 degraded
{
  process.stdout.write('S2 kernel broken: "summarise this paragraph"\n');
  const { root, home } = makeKernel({ healthy: false });
  const r = runPrompt({ prompt: "summarise this paragraph", root, home, modelAnswer: "Here is the summary." });

  step("prompt still answers (never fails)", () => assert.match(r.text, /Here is the summary\./));
  step("first line says NOT at play + names the reason", () => {
    const first = r.text.split("\n")[0];
    assert.match(first, /^Prompt Operating System NOT at play/);
    assert.match(first, /PROMPT-ROUTER\.md|CONSTITUTION\.md/);
    assert.match(first, /done.*blocked|blocked/);
  });
  step("claim gate is closed while degraded", () => {
    const t = checkTenets({ prompt: "summarise this paragraph", classification: "program", claimDone: true, attestation: { ok: false, reason: "degraded" }, ledger: { ok: true } });
    assert.equal(t.ok, false);
    assert.match(t.violations.join(" "), /GoSolo/);
  });
}

// ---------------------------------------------------------------- S3 program
{
  process.stdout.write('S3 non-trivial: "add a rate limiter to the API"\n');
  const { root, home } = makeKernel({ healthy: true });
  const prompt = "add a rate limiter to the API";
  const r = runPrompt({ prompt, root, home, modelAnswer: "Rate limiter added." });
  const contract = `# Outcome contract: rate limiter
Status: proven
## Job
Protect the API from bursts.
## North Star
- Metric: 429 rate under 1% at 200 rps
## Assumptions (falsify these)
| ID | Assumption | How to kill it | Result |
## Kill criteria
Stop if p95 latency regresses over 20 ms.
## Evidence required for "done"
- [ ] Load test at 200 rps
## Command evidence
Kernel receipt ids.
`;

  step("routed", () => assert.equal(r.att.state, "routed"));

  step("gaming: fabricated evidence cannot certify", () => {
    const fake = `Evaluator: all good. Bar-raiser: baseline vs 3 competitors.
## Command evidence
$ npm test
exit:0
$ npm run load
exit:0
`;
    const g = hardGrade({ contractText: contract, evidenceText: fake, claimDone: true, prompt, root });
    assert.equal(g.ok, false);
    assert.equal(g.certified, false);
  });

  const a = runReceipt({ command: "node -e \"process.exit(0)\"", label: "unit", root });
  const b = runReceipt({ command: "node -e \"process.exit(0)\"", label: "load", root });

  step("real receipts + independent board certify", () => {
    const evidence = `Evaluator: independent verdict; 429 rate 0.4% at 200 rps. Bar-raiser: baseline vs 3 competitors + do-nothing.
## Command evidence
${a.id}
${b.id}
$ node -e "process.exit(0)"
exit:0
$ node -e "process.exit(0)"
exit:0
`;
    const g = hardGrade({ contractText: contract, evidenceText: evidence, claimDone: true, prompt, root });
    assert.equal(g.ok, true, g.reason);
    assert.equal(g.certified, true);

    const t = checkTenets({
      prompt,
      classification: "program",
      contractText: contract,
      evidenceText: evidence,
      claimDone: true,
      attestation: { ok: true },
      ledger: verifyChain("receipts", root),
      receipts: [
        { id: a.id, verified: true, reverified: true, exit: 0 },
        { id: b.id, verified: true, reverified: true, exit: 0 },
      ],
      author: "builder",
      board: [
        { judge: "perf-reviewer", verdict: "approve", receiptVerified: true },
        { judge: "sre", verdict: "concern: no burst test above 200 rps", receiptVerified: true },
        { judge: "api-owner", verdict: "approve", receiptVerified: true },
      ],
      feedback: [{ verified: true }],
      evolution: [{ verified: true, changeRef: a.hash }],
      slices: ["middleware", "load test"],
    });
    assert.equal(t.ok, true, t.violations.join(" | "));
  });

  step("gaming: self-graded board on the same real receipts still fails", () => {
    const t = checkTenets({
      prompt,
      classification: "program",
      contractText: contract,
      claimDone: true,
      attestation: { ok: true },
      ledger: { ok: true },
      receipts: [
        { id: a.id, verified: true, reverified: true, exit: 0 },
        { id: b.id, verified: true, reverified: true, exit: 0 },
      ],
      author: "builder",
      board: [
        { judge: "builder", verdict: "approve", receiptVerified: true },
        { judge: "builder-2", verdict: "approve", receiptVerified: true },
        { judge: "builder-3", verdict: "approve", receiptVerified: true },
      ],
      feedback: [{ verified: true }],
      evolution: [{ verified: true, changeRef: a.hash }],
      slices: ["a", "b"],
    });
    assert.equal(t.ok, false);
    assert.match(t.violations.join(" "), /BarRaiserBoard/);
  });
}

// ---------------------------------------------------------------- S4 tools/MCP
{
  process.stdout.write('S4 tool + MCP heavy: "search the repo and open a PR"\n');
  const { root, home } = makeKernel({ healthy: true });
  const clientBody = {
    tools: [
      { type: "function", function: { name: "repo_search", parameters: { type: "object" } } },
      { type: "function", function: { name: "open_pr" } },
    ],
    tool_choice: "auto",
    mcpServers: { filesystem: { command: "mcp-fs", args: ["--root", "/repo"] }, github: { command: "mcp-gh" } },
    response_format: { type: "json_object" },
    temperature: 0.2,
    metadata: { session: "abc" },
  };
  const r = runPrompt({
    prompt: "search the repo and open a PR",
    root,
    home,
    clientBody: { ...clientBody, messages: [{ role: "system", content: "Existing skill: PR etiquette." }, { role: "user", content: "search the repo and open a PR" }] },
  });

  step("compat preserved end-to-end", () => assert.equal(r.compat.preserved, true, r.compat.violations.join(", ")));
  step("tools, MCP servers and params forwarded byte-identical", () => {
    assert.deepEqual(r.upstream.body.tools, clientBody.tools);
    assert.deepEqual(r.upstream.body.mcpServers, clientBody.mcpServers);
    assert.equal(r.upstream.body.tool_choice, "auto");
    assert.deepEqual(r.upstream.body.response_format, clientBody.response_format);
    assert.equal(r.upstream.body.temperature, 0.2);
    assert.deepEqual(r.upstream.body.metadata, clientBody.metadata);
  });
  step("existing skill/system message survives and POS is prepended", () => {
    const systems = r.upstream.body.messages.filter((m) => m.role === "system");
    assert.match(systems[0].content, /PROMPT OS/);
    assert.ok(systems.some((m) => m.content === "Existing skill: PR etiquette."), "existing system message lost");
  });
  step("routed banner present", () => assert.equal(r.text.split("\n")[0], BANNER_ROUTED));
}

if (failed) {
  process.stderr.write(`${failed} scenario step(s) failed\n`);
  process.exit(1);
}
process.stdout.write("scenarios ok\n");
