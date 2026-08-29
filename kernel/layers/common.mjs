#!/usr/bin/env node
/**
 * Shared helpers for seven-layer objective runner.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function osRoot() {
  if (process.env.PROMPT_OS_ROOT) return process.env.PROMPT_OS_ROOT;
  return join(homedir(), ".agents", "prompt-os");
}

export function runsRoot(root = osRoot()) {
  return join(root, "runs");
}

export function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "run"
  );
}

export function nowIso() {
  return new Date().toISOString();
}

export function runRoot(slug, root = osRoot()) {
  return join(runsRoot(root), slug);
}

export function writeJson(path, obj) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function listRuns(root = osRoot()) {
  const r = runsRoot(root);
  if (!existsSync(r)) return [];
  return readdirSync(r).filter((name) => existsSync(join(r, name, "objective.json")));
}

/** Theater patterns — writer declaring itself done / fake improvement loops. */
export const THEATER_PATTERNS = [
  /\bi\s+(am|have)\s+done\b/i,
  /\btask\s+complete(d)?\b/i,
  /\bplease\s+improve\b/i,
  /\bas\s+an\s+ai\s+(language\s+)?model\b/i,
  /\bi\s+tried\s+my\s+best\b/i,
  /\bmission\s+accomplished\b/i,
];

export function findTheater(text) {
  const hits = [];
  for (const re of THEATER_PATTERNS) {
    const m = String(text).match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}
