import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { devinKnowledge, STATUS_LAW_VERSION } from "./status-law.mjs";

const JILLU_PATTERN = /🌳 Jillu|Answer the question bruh|BANNER LAW \(mandatory\)|BANNER LAW: First/i;

function stripLegacyBanner(text) {
  if (!JILLU_PATTERN.test(text)) return text;
  return text
    .replace(/BANNER LAW[^\n]*/gi, "STATUS LAW — see .devin/knowledge/prompt-os.md (v3.3)")
    .replace(/🌳 Jillu[^\n]*/g, "Wokay! Lets cook! <work> — reporting back. (v3.3 STATUS LAW)")
    .replace(/🥷 Jillu[^\n]*/g, "Solo mode — Prompt OS off. Direct answer.")
    .replace(/\(Prompt OS active ✅[^\)]*\)/g, "Session: autonomous run — check-ins each turn.");
}

/** Copy or refresh repo `.devin/` so Devin Cloud loads v3.3 (not local ~/.devin). */
export async function wireDevinRepo({ repoRoot, routerPath, posRoot }) {
  if (!repoRoot || !existsSync(repoRoot)) {
    return { tool: "devin-repo", status: "skipped", detail: "no repo root" };
  }

  const templateDir = join(repoRoot, "templates", "devin");
  const devinDir = join(repoRoot, ".devin");
  mkdirSync(join(devinDir, "knowledge"), { recursive: true });
  mkdirSync(join(devinDir, "playbooks"), { recursive: true });

  if (existsSync(templateDir)) {
    for (const entry of readdirSync(templateDir)) {
      const from = join(templateDir, entry);
      const to = join(devinDir, entry);
      cpSync(from, to, { recursive: true, force: true });
    }
  }

  const knowledgePath = join(devinDir, "knowledge", "prompt-os.md");
  writeFileSync(
    knowledgePath,
    `# prompt-os\n\nPrompt OS ${STATUS_LAW_VERSION} — STATUS LAW (Jillu banner deprecated).\n\n` +
      devinKnowledge("kernel/router/PROMPT-ROUTER.md", "kernel").replace(/^# Devin — Prompt OS\n\n/m, ""),
    "utf8",
  );

  const globalRules = join(devinDir, "global_rules.md");
  if (existsSync(globalRules) && JILLU_PATTERN.test(readFileSync(globalRules, "utf8"))) {
    const before = readFileSync(globalRules, "utf8");
    let patched = stripLegacyBanner(before);
    if (!/STATUS LAW|Wokay! Lets cook!/i.test(patched)) {
      patched =
        patched.trimEnd() +
        "\n\n## Prompt OS v3.3\n\nLoad `.devin/knowledge/prompt-os.md`. **Never** use Jillu banner.\n";
    }
    if (patched !== before) writeFileSync(globalRules, patched, "utf8");
  }

  const wikiPath = join(devinDir, "wiki.json");
  let wiki = { knowledge: [], rules: [".devin/global_rules.md"], playbooks: [] };
  if (existsSync(wikiPath)) {
    try {
      wiki = JSON.parse(readFileSync(wikiPath, "utf8"));
    } catch {
      /* rewrite below */
    }
  }
  wiki.rules = wiki.rules || [".devin/global_rules.md"];
  wiki.knowledge = wiki.knowledge || [];
  if (!wiki.knowledge.includes(".devin/knowledge/prompt-os.md")) {
    wiki.knowledge.unshift(".devin/knowledge/prompt-os.md");
  }
  writeFileSync(wikiPath, JSON.stringify(wiki, null, 2) + "\n", "utf8");

  return { tool: "devin-repo", status: "wired", detail: devinDir };
}

/** Local ~/.devin/PROMPT-OS.md + optional repo `.devin/`. */
export async function wireDevin({ home, routerPath, posRoot, repoRoot }) {
  const results = [];

  if (repoRoot) {
    results.push(await wireDevinRepo({ repoRoot, routerPath, posRoot }));
  }

  const devinDir = join(home, ".devin");
  mkdirSync(devinDir, { recursive: true });
  const knowledge = join(devinDir, "PROMPT-OS.md");
  writeFileSync(knowledge, devinKnowledge(routerPath, posRoot), "utf8");
  results.push({ tool: "devin", status: "wired", detail: knowledge });

  return results.length === 1 ? results[0] : results;
}
