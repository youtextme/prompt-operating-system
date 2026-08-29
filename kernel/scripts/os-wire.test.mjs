#!/usr/bin/env node
/**
 * Tests for OS-level wiring helpers.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROFILE_MARKER,
  appendShellProfile,
  defaultEnvVars,
  doctorOsLevel,
  wireLinuxEnvironmentD,
  writePosEnvFile,
} from "./os-wire.mjs";

let failed = 0;
function ok(name, cond) {
  if (cond) process.stdout.write(`ok   ${name}\n`);
  else {
    process.stdout.write(`FAIL ${name}\n`);
    failed++;
  }
}

const home = mkdtempSync(join(tmpdir(), "pos-os-wire-"));
const posRoot = join(home, ".agents", "prompt-os");

try {
  const vars = defaultEnvVars(posRoot);
  ok("defaultEnvVars has PROMPT_OS_ROOT", vars.PROMPT_OS_ROOT === posRoot);
  ok("defaultEnvVars has gateway URL", vars.OPENAI_BASE_URL.includes("8555"));

  const envSh = writePosEnvFile(home, vars);
  const envContent = readFileSync(envSh, "utf8");
  ok("writePosEnvFile creates exports", envContent.includes('export PROMPT_OS_ROOT='));
  ok("writePosEnvFile idempotent update", writePosEnvFile(home, vars) === envSh);

  const bashrc = join(home, ".bashrc");
  appendShellProfile(bashrc);
  ok("appendShellProfile adds marker", readFileSync(bashrc, "utf8").includes(PROFILE_MARKER));
  appendShellProfile(bashrc);
  ok("appendShellProfile no duplicate", readFileSync(bashrc, "utf8").split(PROFILE_MARKER).length === 2);

  const envd = wireLinuxEnvironmentD(home, vars);
  ok("environment.d wired on linux", process.platform !== "linux" || envd.status === "wired");

  const doc = doctorOsLevel(home, posRoot);
  ok("doctorOsLevel shell profile ok", doc.lines.some((l) => l.includes("shell profile")));
  ok("doctorOsLevel pos-env ok", doc.lines.some((l) => l.includes(".pos-env.sh")));

  process.stdout.write(failed ? `\n${failed} failed\n` : "\nall os-wire tests passed\n");
  process.exit(failed ? 1 : 0);
} finally {
  rmSync(home, { recursive: true, force: true });
}
