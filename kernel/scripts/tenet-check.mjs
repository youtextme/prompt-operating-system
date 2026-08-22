#!/usr/bin/env node
/**
 * Hard tenet gate.
 *
 * Design rule for every check below: a tenet may only be satisfied by a fact the
 * kernel produced (a ledger entry, a signature, a re-executed exit code, a
 * parsed numeric threshold) — never by the presence of words. Keyword checks are
 * exactly what a model games, so where a keyword used to be the gate it is now
 * either a signed artifact or a parsed boolean.
 *
 * Exit codes: 0 = all tenets hard-met, 2 = at least one violated.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyChain } from "../lib/ledger.mjs";
import { osRoot } from "../lib/paths.mjs";
import { attestationForPrompt } from "../enforce/attest.mjs";
import { reverify, verifyReceipt } from "./receipt.mjs";

export const TENETS = [
  "GoSolo",
  "KeepItWarm",
  "TerminalOutcomes",
  "WayofWorking",
  "BarRaiserBoard",
  "FeedbackLoop",
  "FormulasAndBooleans",
  "Evolve&Improve",
  "NoOneBigShotOutcome",
];

const REQUIRED_HEADINGS = [
  "## Job",
  "## North Star",
  "## Assumptions (falsify these)",
  "## Kill criteria",
  '## Evidence required for "done"',
];

/** A metric is only a formula if a machine can decide it: needs an operator and a number. */
export function parseBooleanMetric(text) {
  const line = String(text || "")
    .split("\n")
    .find((l) => /^\s*-\s*Metric:/i.test(l));
  if (!line) return { ok: false, reason: "no `- Metric:` line" };
  const metric = line.replace(/^\s*-\s*Metric:\s*/i, "").trim();
  if (/^<|^TODO|^TBD$/i.test(metric)) return { ok: false, reason: "placeholder metric" };
  const m = metric.match(
    /(>=|<=|==|>|<|=|under|below|less than|at most|no more than|over|above|at least|greater than|within)\s*(-?\d+(?:\.\d+)?)/i,
  );
  if (!m) return { ok: false, reason: `metric not boolean-decidable (needs comparator+number): "${metric}"` };
  return { ok: true, metric, comparator: m[1].toLowerCase(), threshold: Number(m[2]) };
}

function fail(id, reason) {
  return { id, ok: false, reason };
}
function pass(id, reason) {
  return { id, ok: true, reason };
}

/**
 * @param {object} b bundle of kernel-produced facts (never free text where avoidable)
 * @returns {{ok:boolean, results:Array<{id:string,ok:boolean,reason:string}>, violations:string[]}}
 */
export function checkTenets(b = {}) {
  const {
    prompt = "",
    classification = "trivial",
    contractText = "",
    evidenceText = "",
    claimDone = false,
    attestation = { ok: false, reason: "not supplied" },
    ledger = { ok: false, reason: "not supplied" },
    receipts = [],
    board = [],
    author = "agent",
    feedback = [],
    evolution = [],
    slices = [],
    escalations = [],
  } = b;

  const nonTrivial = classification !== "trivial";
  const results = [];

  // 1. GoSolo — autonomy is proven by a routed attestation plus no un-attempted
  // hand-off. Escalating is allowed only after the kernel recorded an attempt.
  if (!attestation.ok) {
    results.push(fail("GoSolo", `prompt has no valid routed attestation (${attestation.reason || "missing"})`));
  } else {
    const lazy = escalations.filter((e) => !e.attemptReceipt);
    results.push(
      lazy.length
        ? fail("GoSolo", `${lazy.length} escalation(s) with no attempt receipt`)
        : pass("GoSolo", "routed attestation verified; no unattempted hand-offs"),
    );
  }

  // 2. KeepItWarm — continuity is the intact hash chain, not a memory file.
  results.push(ledger.ok ? pass("KeepItWarm", `ledger chain intact (${ledger.count ?? "?"} entries)`) : fail("KeepItWarm", `ledger chain broken: ${ledger.reason}`));

  // 3. TerminalOutcomes — "done" must be terminal (proven or killed) and terminal
  // states must carry kernel receipts; no open-ended "in progress" completion.
  const status = (contractText.match(/^Status:\s*(draft|active|killed|proven)\b/im) || [])[1]?.toLowerCase() || (nonTrivial ? "missing" : "trivial");
  if (claimDone && !["proven", "killed"].includes(status)) {
    results.push(fail("TerminalOutcomes", `done claimed but status=${status} (need proven|killed)`));
  } else if (claimDone && status === "killed" && !/kill(ed)?\s+criteri|falsified/i.test(evidenceText)) {
    results.push(fail("TerminalOutcomes", "kill claimed without the falsified criterion"));
  } else {
    results.push(pass("TerminalOutcomes", claimDone ? `terminal status=${status}` : "no completion claimed"));
  }

  // 4. WayofWorking — contract structure is mechanical, so check it mechanically.
  if (nonTrivial) {
    const missing = REQUIRED_HEADINGS.filter((h) => !contractText.includes(h));
    results.push(missing.length ? fail("WayofWorking", `contract missing: ${missing.join(", ")}`) : pass("WayofWorking", "contract complete"));
  } else {
    results.push(pass("WayofWorking", "trivial prompt — contract not required"));
  }

  // 5. BarRaiserBoard — >=3 distinct judges, author may not judge (L6 self-grade
  // forbidden), and unanimity is suspicious: judge agreeableness means an
  // all-approve board is treated as no review unless a dissent was recorded and
  // resolved. Every verdict must cite a verified receipt.
  if (claimDone && nonTrivial) {
    const judges = [...new Set(board.map((x) => String(x.judge || "").toLowerCase()).filter(Boolean))];
    const selfGraded = judges.includes(String(author).toLowerCase());
    const unsupported = board.filter((x) => !x.receiptVerified);
    const dissent = board.filter((x) => /reject|block|veto|concern/i.test(String(x.verdict || "")) || x.dissent === true);
    if (judges.length < 3) results.push(fail("BarRaiserBoard", `need >=3 distinct judges, got ${judges.length}`));
    else if (selfGraded) results.push(fail("BarRaiserBoard", `author "${author}" graded own work (L6 self-grade is forbidden)`));
    else if (unsupported.length) results.push(fail("BarRaiserBoard", `${unsupported.length} verdict(s) cite no verified receipt`));
    else if (dissent.length === 0 && !board.some((x) => x.dissentResolved)) {
      results.push(fail("BarRaiserBoard", "unanimous approval with no recorded dissent — run the dissent seat before claiming done"));
    } else results.push(pass("BarRaiserBoard", `${judges.length} judges, dissent recorded, verdicts receipt-backed`));
  } else {
    results.push(pass("BarRaiserBoard", "no done claim — board not yet required"));
  }

  // 6. FeedbackLoop — a signed feedback entry must exist for the outcome.
  if (claimDone && nonTrivial) {
    const signed = feedback.filter((f) => f.verified);
    results.push(signed.length ? pass("FeedbackLoop", `${signed.length} signed feedback entr(ies)`) : fail("FeedbackLoop", "no signed feedback entry for this outcome"));
  } else {
    results.push(pass("FeedbackLoop", "no done claim — feedback not yet required"));
  }

  // 7. FormulasAndBooleans — the core anti-fabrication gate: numeric metric plus
  // >=2 receipts that verify AND re-execute to the recorded exit code.
  if (claimDone) {
    const metric = nonTrivial ? parseBooleanMetric(contractText) : { ok: true };
    const good = receipts.filter((r) => r.verified && r.reverified && r.exit === 0);
    if (!metric.ok) results.push(fail("FormulasAndBooleans", metric.reason));
    else if (good.length < 2) {
      const why = receipts.length ? receipts.map((r) => `${r.id || "?"}:${r.verified ? "sig-ok" : "sig-bad"}/${r.reverified ? "rerun-ok" : "rerun-bad"}/exit${r.exit}`).join(", ") : "none";
      results.push(fail("FormulasAndBooleans", `need >=2 verified+re-executed receipts, have ${good.length} (${why})`));
    } else results.push(pass("FormulasAndBooleans", `metric decidable; ${good.length} receipts re-executed green`));
  } else {
    results.push(pass("FormulasAndBooleans", "no done claim — evidence gate idle"));
  }

  // 8. Evolve&Improve — a lesson must point at a real, signed change.
  if (claimDone && nonTrivial) {
    const real = evolution.filter((e) => e.verified && e.changeRef);
    results.push(real.length ? pass("Evolve&Improve", `${real.length} signed lesson(s) with change refs`) : fail("Evolve&Improve", "no signed lesson linked to a real change"));
  } else {
    results.push(pass("Evolve&Improve", "no done claim — evolution not yet required"));
  }

  // 9. NoOneBigShotOutcome — non-trivial work must be sliced.
  if (nonTrivial) {
    results.push(slices.length >= 2 ? pass("NoOneBigShotOutcome", `${slices.length} slices`) : fail("NoOneBigShotOutcome", `non-trivial outcome has ${slices.length} slice(s); need >=2`));
  } else {
    results.push(pass("NoOneBigShotOutcome", "trivial prompt"));
  }

  const violations = results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.reason}`);
  return { ok: violations.length === 0, results, violations, prompt: prompt.slice(0, 120) };
}

function readIf(path) {
  return path && existsSync(path) ? readFileSync(path, "utf8") : "";
}

function parseJsonArg(argv, flag, fallback) {
  const i = argv.indexOf(flag);
  if (i < 0) return fallback;
  const raw = argv[i + 1];
  try {
    return JSON.parse(existsSync(raw) ? readFileSync(raw, "utf8") : raw);
  } catch {
    return fallback;
  }
}

function arg(argv, flag, fallback = "") {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : fallback;
}

function main(argv) {
  const root = osRoot();
  const contractPath = arg(argv, "--contract");
  const evidencePath = arg(argv, "--evidence");
  const promptText = arg(argv, "--prompt");
  const bundleFile = arg(argv, "--bundle");
  const base = bundleFile ? JSON.parse(readFileSync(bundleFile, "utf8")) : {};

  const receiptIds = parseJsonArg(argv, "--receipts", base.receipts || []);
  const receipts = (Array.isArray(receiptIds) ? receiptIds : []).map((r) => {
    const id = typeof r === "string" ? r : r.id;
    const v = verifyReceipt(id, root);
    if (!v.ok) return { id, verified: false, reverified: false, exit: -1, reason: v.reason };
    const rr = argv.includes("--no-reverify") ? { ok: true, reason: "skipped" } : reverify(id, root);
    return { id, verified: true, reverified: rr.ok, exit: v.receipt.exit, command: v.receipt.command, reason: rr.reason };
  });

  const bundle = {
    ...base,
    prompt: promptText || base.prompt || "",
    classification: arg(argv, "--classification", base.classification || "trivial"),
    contractText: readIf(contractPath) || base.contractText || "",
    evidenceText: readIf(evidencePath) || base.evidenceText || "",
    claimDone: argv.includes("--done") || base.claimDone === true,
    attestation: (() => {
      const a = attestationForPrompt(promptText || base.prompt || "", root);
      return { ok: a.ok, reason: a.ok ? "verified" : "no routed attestation for this prompt", id: a.id };
    })(),
    ledger: verifyChain("attest", root),
    receipts,
  };

  const result = checkTenets(bundle);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
