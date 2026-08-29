#!/usr/bin/env node
/**
 * Seven-layer objective runner — public API + CLI.
 *
 *   pos layers run "<ask>"
 *   pos layers need|context|hypothesis|truth|critique|retrieve|autonomy ...
 */
import { writeNeed, loadNeed, validateNeed, compileNeed } from "./need.mjs";
import { writeContext, loadContext, isAuthorized } from "./context.mjs";
import { declarePhase, recordObservation, validateHypotheses } from "./hypothesis.mjs";
import { scanClaims, gradeTruth } from "./truth.mjs";
import { critique, critiqueRun } from "./critique.mjs";
import { retrieve, budgetLeft } from "./retrieve.mjs";
import { bootstrapRun, tick, runAutonomy } from "./autonomy.mjs";
import { runRoot, osRoot, listRuns } from "./common.mjs";

export const LAYERS = [
  { n: 1, id: "need", title: "Need", module: "need.mjs" },
  { n: 2, id: "context", title: "Context (Awareness)", module: "context.mjs" },
  { n: 3, id: "hypothesis", title: "Hypothesis", module: "hypothesis.mjs" },
  { n: 4, id: "truth", title: "Truth-seeking", module: "truth.mjs" },
  { n: 5, id: "critique", title: "Critique", module: "critique.mjs" },
  { n: 6, id: "retrieve", title: "New information", module: "retrieve.mjs" },
  { n: 7, id: "autonomy", title: "Autonomy (MAPE-K)", module: "autonomy.mjs" },
];

export {
  writeNeed,
  loadNeed,
  validateNeed,
  compileNeed,
  writeContext,
  loadContext,
  isAuthorized,
  declarePhase,
  recordObservation,
  validateHypotheses,
  scanClaims,
  gradeTruth,
  critique,
  critiqueRun,
  retrieve,
  budgetLeft,
  bootstrapRun,
  tick,
  runAutonomy,
  runRoot,
  osRoot,
  listRuns,
};

function usage() {
  return `Prompt OS — seven-layer objective runner

  pos layers                      # list layers
  pos layers run "<ask>"          # MAPE-K autonomy loop (demo artifact)
  pos layers need "<ask>"         # Layer 1 — compile objective
  pos layers context <run-dir>    # Layer 2 — context manifest + brief
  pos layers hypothesis ...       # Layer 3 — declare|observe|validate
  pos layers truth <artifact>     # Layer 4 — claim attribution scan
  pos layers critique <run-dir>   # Layer 5 — independent pass/fail
  pos layers retrieve <run-dir> --gap G --source S
  pos layers autonomy run "<ask>" # Layer 7 — same as layers run
`;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "list" || cmd === "help" || cmd === "-h") {
    process.stdout.write(
      LAYERS.map((l) => `L${l.n} ${l.id.padEnd(12)} ${l.title}`).join("\n") + "\n\n" + usage(),
    );
    process.exit(0);
  }

  if (cmd === "run") {
    const ask = rest.filter((a) => !a.startsWith("--")).join(" ").trim();
    if (!ask) {
      process.stderr.write('usage: pos layers run "<ask>"\n');
      process.exit(1);
    }
    const result = runAutonomy(ask, { writeDemoArtifact: true });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(result.ok ? 0 : 2);
  }

  if (cmd === "need") {
    const ask = rest.filter((a) => !a.startsWith("--")).join(" ").trim();
    const result = writeNeed(ask);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(result.code);
  }

  if (cmd === "context") {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [new URL("./context.mjs", import.meta.url).pathname, ...rest], {
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  if (cmd === "hypothesis") {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [new URL("./hypothesis.mjs", import.meta.url).pathname, ...rest], {
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  if (cmd === "truth") {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [new URL("./truth.mjs", import.meta.url).pathname, ...rest], {
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  if (cmd === "critique") {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [new URL("./critique.mjs", import.meta.url).pathname, ...rest], {
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  if (cmd === "retrieve") {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [new URL("./retrieve.mjs", import.meta.url).pathname, ...rest], {
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  if (cmd === "autonomy") {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [new URL("./autonomy.mjs", import.meta.url).pathname, ...rest], {
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  process.stderr.write(usage());
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith("layers/index.mjs") ||
    process.argv[1].endsWith("layers\\index.mjs"));
if (isMain) main(process.argv.slice(2));
