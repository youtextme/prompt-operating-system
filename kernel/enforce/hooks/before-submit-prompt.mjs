#!/usr/bin/env node
/**
 * Cursor user hook — beforeSubmitPrompt
 *
 * Hard ring for Cursor: every user prompt is ATTESTED into the signed ledger
 * before it is submitted, so "did this prompt go through POS?" is later a
 * cryptographic question, not a matter of trust.
 *
 * It never denies. The previous version returned permission:"deny" when the
 * kernel was missing, which made a broken install break the user's prompt. Now a
 * broken kernel produces a `degraded` attestation plus a first-line warning in
 * the additional_context, and the prompt goes through.
 *
 * MCP servers, skills and tools are untouched — this hook only adds context.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();
const posRoot = process.env.PROMPT_OS_ROOT || join(home, ".agents", "prompt-os");
const routerPath = join(home, ".agents", "router", "PROMPT-ROUTER.md");
const enforcePath = join(posRoot, "ENFORCE.json");

async function loadAttest() {
  for (const candidate of [join(posRoot, "enforce", "attest.mjs"), new URL("../attest.mjs", import.meta.url).pathname]) {
    try {
      if (existsSync(candidate)) return (await import(candidate)).attestPrompt;
    } catch {
      /* try next */
    }
  }
  return null;
}

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

  const attestPrompt = await loadAttest();
  const att = attestPrompt
    ? attestPrompt({ prompt, surface: "cursor/beforeSubmitPrompt", client: "cursor", root: posRoot, home })
    : { id: "none", state: "degraded", reason: "attest module unavailable" };

  const routed = att.state === "routed";
  const context = routed
    ? [
        `[PROMPT OS routed — attestation ${att.id}]`,
        `Obey ${routerPath}. Skills/MCP/tools unchanged.`,
        "Do NOT write the POS first line yourself; the kernel attaches it and forges are rewritten.",
        `Claims of done/proven require: pos receipt run "<cmd>" then pos tenet-check --done (self-grading is rejected).`,
      ].join("\n")
    : [
        `[PROMPT OS DEGRADED — ${att.reason}]`,
        "Start your reply with: Prompt Operating System NOT at play — repair the kernel (pos install --force --enforce).",
        'Answer the prompt anyway, but do not claim "done"/"proven": the claim gates are closed while degraded.',
      ].join("\n");

  process.stdout.write(
    JSON.stringify({
      continue: true,
      additional_context: context,
      pos: { attestation: att.id, state: att.state, reason: att.reason, mode: enforce.mode },
    }),
  );
}

main().catch((err) => {
  // A hook failure must never eat the user's prompt.
  process.stdout.write(
    JSON.stringify({
      continue: true,
      additional_context: `[PROMPT OS DEGRADED — hook error: ${String(err?.message || err)}] Answer anyway; done/proven claims stay blocked.`,
    }),
  );
  process.exit(0);
});
