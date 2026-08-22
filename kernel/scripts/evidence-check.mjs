#!/usr/bin/env node
/**
 * Prompt OS evidence gate (FormulasAndBooleans tenet).
 * Exit 0 if proven/killed with evidence. Exit 2 if done claimed without proof.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gradeSlice } from "./program.mjs";

const REQUIRED_HEADINGS = [
  "## Job",
  "## North Star",
  "## Assumptions (falsify these)",
  "## Kill criteria",
  "## Evidence required for \"done\"",
];

export function osRoot() {
  if (process.env.PROMPT_OS_ROOT) return process.env.PROMPT_OS_ROOT;
  const pos = join(homedir(), ".agents", "prompt-os");
  const legacy = join(homedir(), ".agents", "outcome-os");
  if (existsSync(pos)) return pos;
  if (existsSync(legacy)) return legacy;
  return pos;
}

export function parseContract(text) {
  const missing = REQUIRED_HEADINGS.filter((h) => !text.includes(h));
  const statusMatch = text.match(/^Status:\s*(draft|active|killed|proven)\b/im);
  const status = statusMatch ? statusMatch[1].toLowerCase() : "missing";
  const metricLine = text.split("\n").find((l) => /^\s*-\s*Metric:/i.test(l));
  const metric = metricLine ? metricLine.replace(/^\s*-\s*Metric:\s*/i, "").trim() : "";
  const hasPlaceholderMetric =
    !metric || /^<|^TODO|^TBD|^metric:?$/i.test(metric) || metric.length < 8;
  return { missing, status, metric, hasPlaceholderMetric };
}

export function extractCommandEvidence(evidenceText) {
  if (!evidenceText) return null;
  const m = String(evidenceText).match(/##\s*Command evidence([\s\S]*?)(?=\n##\s|\s*$)/i);
  return m ? m[1] : null;
}

export function countCommandPairs(section) {
  if (!section) return { commands: 0, exits: 0 };
  const commands = (section.match(/^\s*\$\s+\S.+$/gm) || []).length;
  const exits = (section.match(/exit:\s*\d+/gi) || []).length;
  return { commands, exits };
}

export function isUIContract(contractText) {
  if (!contractText) return false;
  return /\b(UI|component|page|frontend|screenshot|responsive|a11y|wireframe|palette)\b/i.test(
    contractText,
  );
}

export function hasBarRaiserEvidence(evidenceText) {
  if (!evidenceText) return false;
  return /bar-raiser|baseline|competitor|PoC|kill-criteri/i.test(evidenceText);
}

export function hasDesignEvidence(evidenceText) {
  if (!evidenceText) return false;
  return /design token|AI-?slop|palette|hex\s*#|wireframe|signature element/i.test(evidenceText);
}

export function grade({ contractText, evidenceText, claimDone }) {
  const parsed = parseContract(contractText || "");
  if (!contractText) {
    return { ok: !claimDone, code: claimDone ? 2 : 0, reason: claimDone ? "no contract" : "trivial" };
  }
  if (parsed.missing.length) {
    return { ok: false, code: 2, reason: `missing: ${parsed.missing.join(", ")}` };
  }
  if (parsed.hasPlaceholderMetric) {
    return { ok: false, code: 2, reason: "placeholder metric" };
  }
  if (!claimDone) return { ok: true, code: 0, reason: "in progress" };
  if (parsed.status === "killed") {
    const ok = Boolean(evidenceText) && /killed|kill-criterion|falsified/i.test(evidenceText);
    return ok ? { ok: true, code: 0, reason: "killed" } : { ok: false, code: 2, reason: "kill undocumented" };
  }
  if (parsed.status !== "proven") {
    return { ok: false, code: 2, reason: `claimed done but status=${parsed.status} (need proven or killed)` };
  }
  if (!evidenceText || evidenceText.trim().length < 40) {
    return { ok: false, code: 2, reason: "missing evidence" };
  }
  if (!/evaluator/i.test(evidenceText)) {
    return { ok: false, code: 2, reason: "evaluator required" };
  }
  if (!contractText.includes("## Command evidence")) {
    return { ok: false, code: 2, reason: "contract must declare ## Command evidence" };
  }
  const ce = extractCommandEvidence(evidenceText);
  if (!ce) return { ok: false, code: 2, reason: "missing ## Command evidence block" };
  const { commands, exits } = countCommandPairs(ce);
  if (commands < 2 || exits < 2) {
    return { ok: false, code: 2, reason: `need >=2 cmd+exit pairs (commands=${commands}, exits=${exits})` };
  }
  if (!hasBarRaiserEvidence(evidenceText)) {
    return { ok: false, code: 2, reason: "bar-raiser evidence required" };
  }
  if (isUIContract(contractText) && !hasDesignEvidence(evidenceText)) {
    return { ok: false, code: 2, reason: "UI design-token evidence required" };
  }
  return { ok: true, code: 0, reason: "proven" };
}

export function findActiveContracts(root = osRoot()) {
  const dir = join(root, "contracts", "active");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => join(dir, f));
}

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function siblingEvidence(contractPath) {
  const dir = resolve(contractPath, "..");
  const stem = contractPath.replace(/^.*[/\\]/, "").replace(/\.md$/i, "");
  for (const c of [join(dir, `evidence-${stem}.md`), join(dir, "evidence.md")]) {
    if (existsSync(c)) return read(c);
  }
  return "";
}

function main(argv) {
  const claimDone = argv.includes("--done");
  const sliceMode = argv.includes("--slice");
  const pathArg = argv.find((a) => !a.startsWith("-"));
  const contractPath = pathArg ? resolve(pathArg) : findActiveContracts()[0] || "";
  const contractText = contractPath ? read(contractPath) : "";
  const evidenceText = contractPath ? siblingEvidence(contractPath) : "";

  if (sliceMode) {
    const result = gradeSlice({ sliceText: contractText, evidenceText, claimDone });
    process.stdout.write(JSON.stringify({ ...result, slicePath: contractPath || null, root: osRoot() }) + "\n");
    process.exit(result.code);
  }

  const result = grade({
    contractText,
    evidenceText,
    claimDone,
  });
  process.stdout.write(JSON.stringify({ ...result, contractPath: contractPath || null, root: osRoot() }) + "\n");
  process.exit(result.code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(String(err?.stack || err) + "\n");
    process.exit(1);
  }
}
