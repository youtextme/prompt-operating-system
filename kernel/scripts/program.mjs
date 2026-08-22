#!/usr/bin/env node
/**
 * Program + slice management (NoOneBigShotOutcome).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { programsDir, osRoot } from "../lib/paths.mjs";

export function programDir(slug, root = osRoot()) {
  return join(programsDir(root), slug);
}

export function parseProgram(text) {
  const status = (text.match(/^Status:\s*(draft|active|killed|proven)/im) || [])[1]?.toLowerCase() || "missing";
  const slices = [];
  const re = /^###\s+Slice\s+(\S+)[\s\S]*?Status:\s*(draft|active|proven|killed)/gim;
  let m;
  while ((m = re.exec(text))) {
    slices.push({ id: m[1], status: m[2].toLowerCase() });
  }
  return { status, slices };
}

export function parseSlice(text) {
  const status = (text.match(/^Status:\s*(draft|active|proven|killed)/im) || [])[1]?.toLowerCase() || "missing";
  const deliverable = (text.match(/## Human-usable deliverable\s*\n+([^\n#]+)/i) || [])[1]?.trim() || "";
  const verify = text.match(/## Human verify([\s\S]*?)(?=\n## |\s*$)/i);
  const verifySteps = verify ? (verify[1].match(/^\s*-\s+\[/gm) || []).length : 0;
  return { status, deliverable, verifySteps };
}

export function gradeSlice({ sliceText, evidenceText, claimDone }) {
  if (!sliceText) return { ok: false, code: 2, reason: "no slice" };
  const p = parseSlice(sliceText);
  if (!claimDone) return { ok: true, code: 0, reason: "slice in progress" };
  if (p.status === "killed") {
    const ok = /killed|falsified/i.test(evidenceText || "");
    return ok ? { ok: true, code: 0, reason: "slice killed" } : { ok: false, code: 2, reason: "kill undocumented" };
  }
  if (p.status !== "proven") return { ok: false, code: 2, reason: `slice status=${p.status}` };
  if (!p.deliverable || /TODO|TBD/i.test(p.deliverable)) {
    return { ok: false, code: 2, reason: "missing human-usable deliverable path" };
  }
  if (p.verifySteps < 1) return { ok: false, code: 2, reason: "human verify checklist required" };
  if (!/evaluator/i.test(evidenceText || "")) {
    return { ok: false, code: 2, reason: "evaluator required for slice" };
  }
  const ce = evidenceText?.match(/##\s*Command evidence/i);
  if (!ce) return { ok: false, code: 2, reason: "slice needs >=1 command receipt in evidence" };
  const cmds = (evidenceText.match(/^\s*\$\s+\S+/gm) || []).length;
  if (cmds < 1) return { ok: false, code: 2, reason: "need >=1 $ cmd receipt" };
  return { ok: true, code: 0, reason: "slice proven" };
}

export function programStatus(slug, root = osRoot()) {
  const dir = programDir(slug, root);
  const programFile = join(dir, "PROGRAM.md");
  if (!existsSync(programFile)) return null;
  const text = readFileSync(programFile, "utf8");
  const meta = parseProgram(text);
  const sliceDir = join(dir, "slices");
  const sliceFiles = existsSync(sliceDir) ? readdirSync(sliceDir).filter((f) => f.endsWith(".md")) : [];
  const slices = sliceFiles.map((f) => {
    const t = readFileSync(join(sliceDir, f), "utf8");
    return { file: f, ...parseSlice(t) };
  });
  const proven = slices.filter((s) => s.status === "proven").length;
  return {
    slug,
    programStatus: meta.status,
    slicesTotal: slices.length,
    slicesProven: proven,
    progress: slices.length ? proven / slices.length : 0,
    slices,
  };
}

export function initProgram(slug, job, northStar, root = osRoot()) {
  const dir = programDir(slug, root);
  mkdirSync(join(dir, "slices"), { recursive: true });
  const template = `# Program: ${slug}

Status: active

## Job

${job}

## North Star

${northStar}

## Slices

| ID | Job | Status |
|----|-----|--------|
`;
  writeFileSync(join(dir, "PROGRAM.md"), template, "utf8");
  return dir;
}

export function addSlice(slug, id, job, deliverable, verifySteps, root = osRoot()) {
  const dir = programDir(slug, root);
  mkdirSync(join(dir, "slices"), { recursive: true });
  const steps = verifySteps.map((s) => `- [ ] ${s}`).join("\n");
  const body = `# Slice: ${id}

Status: draft

## Job

${job}

## Human-usable deliverable

${deliverable}

## Human verify

${steps}

## Command evidence

Minimum one \`$ command\` + exit receipt when automated check exists.

## Reward targets

- Adoptability: human can use deliverable without reading chat
- Thoroughness: sources / baseline / PoC as applicable
`;
  const path = join(dir, "slices", `${id}.md`);
  writeFileSync(path, body, "utf8");
  return path;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "status" && rest[0]) {
    process.stdout.write(JSON.stringify(programStatus(rest[0]), null, 2) + "\n");
    return;
  }
  if (cmd === "init" && rest[0]) {
    initProgram(rest[0], rest[1] || "TBD", rest[2] || "- Metric: TBD");
    process.stdout.write("ok " + programDir(rest[0]) + "\n");
    return;
  }
  if (cmd === "add-slice" && rest[0] && rest[1]) {
    const path = addSlice(rest[0], rest[1], rest[2] || "", rest[3] || "TBD", (rest[4] || "").split("|").filter(Boolean));
    process.stdout.write(path + "\n");
    return;
  }
  process.stdout.write(`usage:
  program.mjs status <slug>
  program.mjs init <slug> "<job>" "<north star line>"
  program.mjs add-slice <slug> <id> "<job>" "<deliverable path>" "step1|step2"
`);
}

if (process.argv[1]?.includes("program.mjs")) main();

export { gradeSlice as gradeSliceExport };
