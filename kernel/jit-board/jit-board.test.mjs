import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const jit = join(root, "kernel", "jit-board");
const skill = join(root, "skills", "letscook", "SKILL.md");

assert.ok(existsSync(join(jit, "SUBAGENT-LAW.md")), "SUBAGENT-LAW.md missing");
assert.ok(existsSync(join(jit, "ROSTER.json")), "ROSTER.json missing");

const roster = JSON.parse(readFileSync(join(jit, "ROSTER.json"), "utf8"));
assert.equal(roster.roles.length, 6, "expected 6 JIT seats");
assert.ok(
  roster.subagentsRequired === true || roster.laws?.includes("subagents-own-context"),
  "subagents isolation must be required",
);

const rolesDir = join(jit, "roles");
const roleFiles = readdirSync(rolesDir).filter((f) => f.endsWith(".md"));
assert.equal(roleFiles.length, 6, `expected 6 role briefs, got ${roleFiles.length}`);

const skillBody = readFileSync(skill, "utf8");
assert.match(skillBody, /JIT Board/i);
assert.match(skillBody, /SUBAGENT-LAW/);
assert.match(skillBody, /orchestration only/i);

const router = readFileSync(join(root, "kernel", "router", "PROMPT-ROUTER.md"), "utf8");
assert.match(router, /Step 3\.0 — JIT Board/);

const meta = join(root, "kernel", "scripts", "meta-log.mjs");
assert.ok(existsSync(meta), "meta-log.mjs missing");

console.log("jit-board.test.mjs: ok");
