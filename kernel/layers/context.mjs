#!/usr/bin/env node
/**
 * Layer 2 — Context (Awareness)
 * Inventory of what is reachable before generation. Anything not in the
 * snapshot is refused by the tool layer, not by the model.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { osRoot, nowIso, writeJson, readJson, readText } from "./common.mjs";

export const LAYER = 2;
export const NAME = "context";

const LAYERS_DIR = dirname(fileURLToPath(import.meta.url));

function toolRegistry(root = osRoot()) {
  const home = homedir();
  const kernelLayers = LAYERS_DIR;
  const candidates = [
    { id: "evidence-check", kind: "script", path: join(root, "scripts", "evidence-check.mjs") },
    { id: "watchdog", kind: "script", path: join(root, "scripts", "watchdog.mjs") },
    { id: "audit", kind: "script", path: join(root, "scripts", "audit.mjs") },
    { id: "need", kind: "script", path: join(kernelLayers, "need.mjs") },
    { id: "retrieve", kind: "script", path: join(kernelLayers, "retrieve.mjs") },
    { id: "critique", kind: "script", path: join(kernelLayers, "critique.mjs") },
    { id: "truth", kind: "script", path: join(kernelLayers, "truth.mjs") },
    { id: "hypothesis", kind: "script", path: join(kernelLayers, "hypothesis.mjs") },
    { id: "autonomy", kind: "script", path: join(kernelLayers, "autonomy.mjs") },
    { id: "router", kind: "file", path: join(home, ".agents", "router", "PROMPT-ROUTER.md") },
    { id: "constitution", kind: "file", path: join(root, "CONSTITUTION.md") },
    // Logical endpoint — authorized when declared; health is checked elsewhere
    { id: "hub", kind: "endpoint", endpoint: "http://127.0.0.1:8555/v1", always: true },
  ];
  const ts = nowIso();
  return candidates
    .map((c) => {
      const authorized = c.always
        ? true
        : c.path
          ? existsSync(c.path)
          : Boolean(c.endpoint);
      return {
        id: c.id,
        kind: c.kind,
        path: c.path || null,
        endpoint: c.endpoint || null,
        timestamp: ts,
        authorized,
      };
    })
    .filter((e) => e.authorized);
}

function constitutionalRules(root = osRoot()) {
  const text = readText(join(root, "CONSTITUTION.md"));
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") || /^\d+\./.test(l))
    .slice(0, 12);
  return lines.length ? lines : ["Pause only at outcome gates", "Never self-grade", "Evidence before proven"];
}

/**
 * @param {string} runDir
 * @param {object} [opts]
 */
export function writeContext(runDir, opts = {}) {
  if (!runDir || !existsSync(join(runDir, "objective.json"))) {
    return { ok: false, code: 2, reason: "objective.json must exist before context (Layer 1 first)" };
  }
  const root = opts.osRoot || osRoot();
  const objective = readJson(join(runDir, "objective.json"));
  const tools = toolRegistry(root);
  const paths = [
    { path: join(runDir, "objective.json"), role: "objective", timestamp: nowIso() },
    { path: join(runDir, "objective.md"), role: "objective-human", timestamp: nowIso() },
  ];
  // Allow reading phase artifacts under this run only
  paths.push({ path: join(runDir, "phases"), role: "phase-dir", timestamp: nowIso() });
  paths.push({ path: join(runDir, "retrieval"), role: "retrieval-dir", timestamp: nowIso() });
  paths.push({ path: join(runDir, "artifacts"), role: "artifact-dir", timestamp: nowIso() });

  const model = opts.model || process.env.PROMPT_OS_MODEL || process.env.OLLAMA_MODEL || "unbound";
  const budgets = {
    wall_clock_minutes: objective.boundary?.wall_clock_minutes ?? 60,
    max_tokens: objective.boundary?.max_tokens ?? 200_000,
    max_retrievals: objective.boundary?.max_retrievals ?? 8,
    max_phases: objective.boundary?.max_phases ?? 6,
  };

  const manifest = {
    layer: LAYER,
    run: objective.slug,
    created_at: nowIso(),
    model,
    budgets,
    tools,
    paths,
    constitutional_rules: constitutionalRules(root),
  };

  mkdirSync(runDir, { recursive: true });
  const manifestPath = join(runDir, "context-manifest.json");
  writeJson(manifestPath, manifest);

  const brief = [
    `# Context brief — ${objective.slug}`,
    "",
    `Layer: 2 — Context (Awareness)`,
    `Created: ${manifest.created_at}`,
    `Model bound: ${model}`,
    "",
    "## Budgets",
    "",
    `- wall_clock_minutes: ${budgets.wall_clock_minutes}`,
    `- max_tokens: ${budgets.max_tokens}`,
    `- max_retrievals: ${budgets.max_retrievals}`,
    `- max_phases: ${budgets.max_phases}`,
    "",
    "## Authorized tools",
    "",
    ...tools.map((t) => `- ${t.id} (${t.kind}) — ${t.path || t.endpoint} @ ${t.timestamp}`),
    "",
    "## Authorized paths",
    "",
    ...paths.map((p) => `- ${p.role}: \`${p.path}\` @ ${p.timestamp}`),
    "",
    "## Constitutional rules in force",
    "",
    ...manifest.constitutional_rules.map((r) => `- ${r}`),
    "",
    "Anything not listed above is off-limits. The tool gateway refuses unauthorized reads.",
    "",
  ].join("\n");
  const briefPath = join(runDir, "context-brief.md");
  writeFileSync(briefPath, brief, "utf8");

  return { ok: true, code: 0, manifest, manifestPath, briefPath };
}

/** True iff pathOrId is authorized in the run's manifest. */
export function isAuthorized(runDir, pathOrId) {
  const mp = join(runDir, "context-manifest.json");
  if (!existsSync(mp)) return false;
  const m = readJson(mp);
  const needle = String(pathOrId);
  for (const t of m.tools || []) {
    if (t.id === needle || t.path === needle || t.endpoint === needle) return true;
  }
  for (const p of m.paths || []) {
    if (p.path === needle) return true;
    if (needle.startsWith(p.path + "/") || needle.startsWith(p.path + "\\")) return true;
  }
  return false;
}

export function loadContext(runDir) {
  const mp = join(runDir, "context-manifest.json");
  const bp = join(runDir, "context-brief.md");
  if (!existsSync(mp) || !existsSync(bp)) {
    return { ok: false, code: 2, reason: "context manifest/brief missing" };
  }
  const manifest = readJson(mp);
  if (!manifest.tools?.length) {
    return { ok: false, code: 2, reason: "no authorized tools in brief" };
  }
  for (const t of manifest.tools) {
    if (!t.timestamp || !(t.path || t.endpoint)) {
      return { ok: false, code: 2, reason: `tool ${t.id} missing path/endpoint/timestamp` };
    }
  }
  return { ok: true, code: 0, manifest, briefPath: bp };
}

function main(argv) {
  const runDir = argv.find((a) => !a.startsWith("--"));
  if (!runDir) {
    process.stderr.write("usage: context.mjs <run-dir>\n");
    process.exit(1);
  }
  const result = writeContext(runDir);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.code);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("context.mjs")) {
  main(process.argv.slice(2));
}
