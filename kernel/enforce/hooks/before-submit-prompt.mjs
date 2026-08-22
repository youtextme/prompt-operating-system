#!/usr/bin/env node
/**
 * Cursor user hook — beforeSubmitPrompt
 * Hard ring for Cursor: every user prompt is logged + tagged with POS law.
 * Does NOT block MCP, skills, or tools — prepend-only / audit-only.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();
const posRoot = process.env.PROMPT_OS_ROOT || join(home, ".agents", "prompt-os");
const routerPath = join(home, ".agents", "router", "PROMPT-ROUTER.md");
const enforcePath = join(posRoot, "ENFORCE.json");

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");

  const prompt = input.prompt || input.text || input.content || "";
  let enforce = { mode: "soft" };
  if (existsSync(enforcePath)) {
    try {
      enforce = JSON.parse(readFileSync(enforcePath, "utf8"));
    } catch {
      /* keep soft */
    }
  }

  const auditDir = join(posRoot, "audit");
  mkdirSync(auditDir, { recursive: true });
  const d = new Date();
  const auditFile = join(
    auditDir,
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}.jsonl`,
  );
  appendFileSync(
    auditFile,
    JSON.stringify({
      ts: d.toISOString(),
      actor: "cursor-hook",
      action: "beforeSubmitPrompt",
      detail: JSON.stringify({ promptLen: prompt.length, mode: enforce.mode }),
    }) + "\n",
  );

  if (enforce.mode === "hard" && !existsSync(routerPath)) {
    process.stdout.write(
      JSON.stringify({
        permission: "deny",
        user_message: "Prompt OS kernel missing. Run: pos install --force --enforce",
      }),
    );
    process.exit(2);
  }

  process.stdout.write(
    JSON.stringify({
      continue: true,
      additional_context: `[PROMPT OS active] Obey ${routerPath}. Skills/MCP/tools unchanged.`,
    }),
  );
}

main().catch(() => {
  const hard =
    existsSync(enforcePath) &&
    readFileSync(enforcePath, "utf8").includes('"mode": "hard"');
  process.exit(hard ? 2 : 0);
});
