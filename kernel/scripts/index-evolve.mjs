#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { osRoot } from "./evidence-check.mjs";

const logPath = () => join(osRoot(), "evolve", "log.md");
const indexPath = () => join(osRoot(), "evolve", "INDEX.md");

export function parseEntries(text) {
  const entries = [];
  const re = /^##\s*(\d{4}-\d{2}-\d{2})\s*[-—]?\s*(.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const next = text.indexOf("\n## ", start);
    const body = text.slice(start, next === -1 ? undefined : next);
    const outcomeMatch = body.match(/Outcome:\s*([^.\n]+)\.?/i) || body.match(/\b(proven|slipped|killed|patched)\b/i);
    const firstBullet = (body.match(/^\s*-\s+(.+)$/m) || [])[1] || "";
    entries.push({ date: m[1], slug: m[2].trim(), outcome: outcomeMatch ? outcomeMatch[1].trim().toLowerCase() : "unclassified", note: firstBullet.trim().slice(0, 140) });
  }
  return entries;
}

export function renderIndex(entries) {
  const rows = entries.map((e) => `| ${e.date} | ${e.slug} | ${e.outcome} | ${e.note} |`).join("\n");
  return `# Evolution index\n\nAuto-generated — do not edit by hand.\n\n| Date | Slug | Outcome | Note |\n|------|------|---------|------|\n${rows}\n`;
}

function main() {
  if (!existsSync(logPath())) { process.stderr.write("no log.md\n"); process.exit(1); }
  const entries = parseEntries(readFileSync(logPath(), "utf8"));
  writeFileSync(indexPath(), renderIndex(entries), "utf8");
  process.stdout.write(JSON.stringify({ indexed: entries.length }) + "\n");
}

if (process.argv[1]?.toLowerCase().endsWith("index-evolve.mjs")) main();
