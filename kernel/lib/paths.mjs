import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function osRoot() {
  if (process.env.PROMPT_OS_ROOT) return process.env.PROMPT_OS_ROOT;
  const pos = join(homedir(), ".agents", "prompt-os");
  const legacy = join(homedir(), ".agents", "outcome-os");
  if (existsSync(pos)) return pos;
  if (existsSync(legacy)) return legacy;
  return pos;
}

export function routerPath() {
  return join(homedir(), ".agents", "router", "PROMPT-ROUTER.md");
}

export function programsDir(root = osRoot()) {
  return join(root, "programs");
}

export function tracesDir(root = osRoot()) {
  return join(root, "traces");
}

export function ledgerDir(root = osRoot()) {
  return join(root, "ledger");
}

export function constitutionPath(root = osRoot()) {
  return join(root, "CONSTITUTION.md");
}
