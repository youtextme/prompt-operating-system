import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_LAW_COMPACT,
  STATUS_LAW_VERSION,
  statusLawBlock,
  continueCustomInstructions,
} from "../lib/status-law.mjs";

test("STATUS_LAW_VERSION is semver", () => {
  assert.match(STATUS_LAW_VERSION, /^\d+\.\d+\.\d+$/);
});

test("STATUS_LAW_COMPACT replaces Jillu with cook line", () => {
  assert.match(STATUS_LAW_COMPACT, /Wokay! Lets cook!/);
  assert.doesNotMatch(STATUS_LAW_COMPACT, /Jillu/);
  assert.match(STATUS_LAW_COMPACT, /Trust:<GREEN\|YELLOW\|RED>/);
  assert.match(STATUS_LAW_COMPACT, /OUTCOME FRAME/);
});

test("statusLawBlock includes outcome frame gate", () => {
  const block = statusLawBlock("/router.md");
  assert.match(block, /OUTCOME FRAME LAW/);
  assert.match(block, /Solo mode — Prompt OS off/);
});

test("continueCustomInstructions references router", () => {
  const s = continueCustomInstructions("/home/.agents/router/PROMPT-ROUTER.md");
  assert.match(s, /PROMPT-ROUTER/);
  assert.match(s, /Wokay! Lets cook!/);
});
