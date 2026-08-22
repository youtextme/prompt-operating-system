#!/usr/bin/env node
/**
 * Prompt OS Audit System
 *
 * Maintains a JSONL audit trail of all agent actions.
 * Format: {"timestamp":"ISO","actor":"name","action":"type","detail":{...}}
 */
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const AUDIT_DIR = join(process.env.HOME || process.env.USERPROFILE, ".agents", "prompt-os", "audit");
const AUDIT_FILE = join(AUDIT_DIR, "audit.jsonl");

function ensureAuditDir() {
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

function appendAudit(actor, action, detail) {
  ensureAuditDir();

  const entry = {
    timestamp: new Date().toISOString(),
    actor,
    action,
    detail,
  };

  appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n", "utf8");
  console.log(`Audit: ${actor} ${action}`);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === "append") {
  const actorArg = args.indexOf("--actor");
  const actionArg = args.indexOf("--action");
  const detailArg = args.indexOf("--detail");

  const actor = actorArg !== -1 ? args[actorArg + 1] : "unknown";
  const action = actionArg !== -1 ? args[actionArg + 1] : "unknown";
  const detail = detailArg !== -1 ? args[detailArg + 1] : "{}";

  try {
    const detailObj = JSON.parse(detail);
    appendAudit(actor, action, detailObj);
  } catch (err) {
    console.error("Invalid JSON in detail:", err.message);
    process.exit(1);
  }
} else {
  console.error("Usage: node audit.mjs append --actor <name> --action <type> --detail <json>");
  process.exit(1);
}
