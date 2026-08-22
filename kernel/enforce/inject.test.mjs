import test from "node:test";
import assert from "node:assert/strict";
import { injectPosMessages, preserveClientPayload } from "../enforce/inject.mjs";

test("injectPosMessages prepends without removing existing system", () => {
  const existing = [
    { role: "system", content: "You are a helpful assistant with MCP tools." },
    { role: "user", content: "hello" },
  ];
  const { messages, injected } = injectPosMessages(existing, {
    routerPath: "/router.md",
    posRoot: "/pos",
  });
  assert.equal(injected, true);
  assert.equal(messages.length, 3);
  assert.match(messages[0].content, /PROMPT OS/);
  assert.equal(messages[1].content, existing[0].content);
});

test("injectPosMessages is idempotent when POS already present", () => {
  const existing = [{ role: "system", content: "[PROMPT OS] already" }, { role: "user", content: "x" }];
  const { injected } = injectPosMessages(existing, { routerPath: "/r", posRoot: "/p" });
  assert.equal(injected, false);
});

test("preserveClientPayload keeps tools and MCP fields", () => {
  const body = {
    messages: [],
    tools: [{ type: "function", function: { name: "search" } }],
    tool_choice: "auto",
    model: "gpt-4",
  };
  const kept = preserveClientPayload(body);
  assert.deepEqual(kept.tools, body.tools);
  assert.equal(kept.tool_choice, "auto");
  assert.equal(kept.model, "gpt-4");
});
