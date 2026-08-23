#!/usr/bin/env node
/**
 * Model-aware + hardware-aware environment detection.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cpus, freemem, homedir, platform, totalmem, arch, release } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { osRoot } from "../lib/paths.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

async function loadDetectTools() {
  try {
    const mod = await import(join(__dir, "../adapters/index.mjs"));
    return mod.detectTools;
  } catch {
    try {
      const mod = await import(join(__dir, "../../adapters/index.mjs"));
      return mod.detectTools;
    } catch {
      return () => [];
    }
  }
}

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 8000, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

async function ollamaModels() {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      parameter_size: m.details?.parameter_size,
      family: m.details?.family,
    }));
  } catch {
    return [];
  }
}

function gpuInfo() {
  const nvidia = tryExec("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader");
  if (nvidia) {
    const [name, mem] = nvidia.split(",").map((s) => s.trim());
    return { vendor: "nvidia", name, vram: mem, available: true };
  }
  if (platform() === "win32") {
    const wmic = tryExec("wmic path win32_VideoController get name");
    if (wmic) return { vendor: "unknown", name: wmic.split("\n").filter(Boolean).slice(1).join("; "), available: true };
  }
  return { vendor: "none", name: "cpu-only", available: false };
}

function nodeInfo() {
  return { version: process.version, execPath: process.execPath };
}

function computeTier(models, gpu, detectToolsFn) {
  if (models.length > 0) {
    const big = models.some((m) => /70b|72b|79b|coder-next/i.test(m.name || ""));
    if (big || gpu.available) return "local-capable";
    return "local-light";
  }
  const tools = detectToolsFn(homedir());
  if (tools.some((t) => t.id === "cursor" && t.detected)) return "frontier-primary";
  return "unknown";
}

export async function detectEnvironment() {
  const detectTools = await loadDetectTools();
  const models = await ollamaModels();
  const gpu = gpuInfo();
  const ramGb = Math.round(totalmem() / 1024 ** 3);
  const freeRamGb = Math.round(freemem() / 1024 ** 3);
  const env = {
    detectedAt: new Date().toISOString(),
    os: { platform: platform(), arch: arch(), release: release() },
    hardware: {
      cpuCores: cpus().length,
      ramGb,
      freeRamGb,
      gpu,
    },
    node: nodeInfo(),
    ollama: {
      available: models.length > 0,
      baseUrl: "http://127.0.0.1:11434",
      models,
    },
    hub: { port: 8555, configured: existsSync(join(osRoot(), "hub", "server.mjs")) },
    tools: detectTools(homedir()).filter((t) => t.detected).map((t) => t.id),
    computeTier: computeTier(models, gpu, detectTools),
  };

  const wiring = join(osRoot(), "WIRING.json");
  if (existsSync(wiring)) {
    try {
      env.wiring = JSON.parse(readFileSync(wiring, "utf8"));
    } catch {
      /* ignore */
    }
  }
  return env;
}

async function main() {
  const env = await detectEnvironment();
  process.stdout.write(JSON.stringify(env, null, 2) + "\n");
}

if (process.argv[1]?.includes("detect-environment")) main();
