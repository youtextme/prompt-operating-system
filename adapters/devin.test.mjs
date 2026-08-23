import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { wireDevinRepo } from "./devin.mjs";

test("wireDevinRepo writes v3.3 knowledge without Jillu", async () => {
  const repo = mkdtempSync(join(tmpdir(), "pos-devin-"));
  mkdirSync(join(repo, "kernel", "router"), { recursive: true });
  writeFileSync(join(repo, "kernel", "router", "PROMPT-ROUTER.md"), "# router\n", "utf8");

  // Legacy global rules with Jillu
  mkdirSync(join(repo, ".devin"), { recursive: true });
  writeFileSync(
    join(repo, ".devin", "global_rules.md"),
    "BANNER LAW: Jillu! Answer the question bruh\n",
    "utf8",
  );
  writeFileSync(join(repo, ".devin", "wiki.json"), '{"knowledge":[],"rules":[]}\n', "utf8");

  const result = await wireDevinRepo({
    repoRoot: repo,
    routerPath: "/router.md",
    posRoot: "/pos",
  });

  assert.equal(result.status, "wired");
  const knowledge = readFileSync(join(repo, ".devin", "knowledge", "prompt-os.md"), "utf8");
  assert.match(knowledge, /Wokay! Lets cook!/);
  assert.doesNotMatch(knowledge, /Jillu! Answer the question bruh/);

  const rules = readFileSync(join(repo, ".devin", "global_rules.md"), "utf8");
  assert.doesNotMatch(rules, /Answer the question bruh/);

  const wiki = JSON.parse(readFileSync(join(repo, ".devin", "wiki.json"), "utf8"));
  assert.ok(wiki.knowledge.includes(".devin/knowledge/prompt-os.md"));
});

test("wireDevinRepo skips when no repo root", async () => {
  const result = await wireDevinRepo({ repoRoot: null, routerPath: "/r", posRoot: "/p" });
  assert.equal(result.status, "skipped");
});
