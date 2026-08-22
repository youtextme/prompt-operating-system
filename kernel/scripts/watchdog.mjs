#!/usr/bin/env node
/** Prompt OS watchdog — stall (10) / ack-loop (11) */
import { existsSync, readFileSync } from "node:fs";

const ACK_RE =
  /^(understood|okay|ok|ack|acknowledged|got it|i can assist|how can i assist)[.!,\s]*$/i;

export function analyze(lines, window = 3) {
  const substantive = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  const last = substantive.slice(-window);
  let stall = false;
  if (last.length >= window) stall = last.every((l) => l === last[0]);
  const tailWindow = substantive.slice(-Math.max(window * 3, 6));
  const acks = tailWindow.filter((l) => ACK_RE.test(l)).length;
  return { stall, ackLoop: acks >= 3, inspected: tailWindow.length, sample: last[last.length - 1] || "" };
}

export function selfTest() {
  let failed = 0;
  const assert = (c, m) => { if (!c) { failed++; process.stderr.write("FAIL " + m + "\n"); } };
  assert(analyze(["a", "b", "c"]).stall === false, "varied");
  assert(analyze(["a", "a", "a"], 3).stall === true, "stall");
  assert(analyze(["Understood.", "OK", "Acknowledged.", "Understood!"], 2).ackLoop === true, "ack");
  return failed;
}

function main(argv) {
  if (argv.includes("--self-test")) {
    const f = selfTest();
    if (f) process.exit(1);
    process.stdout.write("watchdog ok\n");
    return;
  }
  const i = argv.indexOf("--file");
  const path = i >= 0 ? argv[i + 1] : null;
  if (!path || !existsSync(path)) {
    process.stderr.write("usage: watchdog.mjs --file <path> [--window n] | --self-test\n");
    process.exit(1);
  }
  const w = argv.indexOf("--window");
  const window = w >= 0 ? Number(argv[w + 1]) || 3 : 3;
  const result = analyze(readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean), window);
  process.stdout.write(JSON.stringify(result) + "\n");
  if (result.stall) process.exit(10);
  if (result.ackLoop) process.exit(11);
}

if (process.argv[1]?.toLowerCase().endsWith("watchdog.mjs")) main(process.argv.slice(2));
