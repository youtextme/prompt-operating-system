#!/usr/bin/env node
/** Run N sandbox prompts and write demo report + audit entries */
import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runSandbox, classifyPrompt } from "./possandbox.mjs";
import { record } from "./audit.mjs";
import { tracesDir, osRoot } from "../lib/paths.mjs";

const PROMPTS = [
  { id: "p1-trivial", text: "What is the capital of France?" },
  { id: "p2-rename", text: "Rename the function getData to fetchData in utils.js" },
  { id: "p3-small-build", text: "Add a health check endpoint GET /api/health that returns JSON status ok" },
  { id: "p4-research", text: "Research top 3 baby name sites and compare how they handle browsing large catalogs" },
  { id: "p5-program", text: "Build a simple todo app with local storage — about 3 hours, ship in usable slices" },
];

async function main() {
  const results = [];
  for (const p of PROMPTS) {
    record("demo-run", "sandbox", JSON.stringify({ id: p.id, prompt: p.text.slice(0, 120) }));
    const r = await runSandbox(p.text, { gist: false });
    const c = classifyPrompt(p.text);
    results.push({
      id: p.id,
      prompt: p.text,
      classification: c.classification,
      confidence: c.confidence,
      steps: r.trace.steps.length,
      slices: r.trace.slices.length,
      rewardG: r.trace.rewardPreview.G,
      tracePath: r.tracePath,
      gistUrl: r.gistUrl,
    });
  }

  const report = [
    "# POS Demo Run — 5 prompts",
    "",
    `At: ${new Date().toISOString()}`,
    `Kernel: ${osRoot()}`,
    "",
    "| # | Prompt | Class | Steps | Slices | Reward G | Trace |",
    "|---|--------|-------|-------|--------|----------|-------|",
  ];
  for (const r of results) {
    report.push(
      `| ${r.id} | ${r.prompt.slice(0, 50)}… | **${r.classification}** | ${r.steps} | ${r.slices} | ${r.rewardG.toFixed(2)} | \`${r.tracePath.replace(/\\/g, "/")}\` |`,
    );
  }
  report.push("", "## Memory written", "");
  report.push("- `~/.agents/prompt-os/traces/*.md` + `.json` — full step traces");
  report.push("- `~/.agents/prompt-os/state/variables.json` — last-run variables");
  report.push("- `~/.agents/prompt-os/audit/*.jsonl` — audit append-only log");
  report.push("- `~/.agents/router/PROMPT-ROUTER.md` — kernel law (agents load this)");
  report.push("", "## Wiring (live agents)", "");
  report.push("See `WIRING.json` — Cursor, opencode, Claude, OpenClaw, OpenHands, Devin, Ollama hint");

  const out = join(tracesDir(), "demo-run-report.md");
  mkdirSync(tracesDir(), { recursive: true });
  writeFileSync(out, report.join("\n") + "\n", "utf8");
  writeFileSync(join(tracesDir(), "demo-run-report.json"), JSON.stringify(results, null, 2) + "\n", "utf8");

  process.stdout.write(report.join("\n") + "\n");
  process.stdout.write("\nReport: " + out + "\n");
}

main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
