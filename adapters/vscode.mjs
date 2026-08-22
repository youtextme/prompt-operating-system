/**
 * VS Code Copilot adapter — wires Prompt OS router into VS Code
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function wireVSCode({ home, routerPath }) {
  const isWin = process.platform === "win32";
  const vscodeDir = join(home, isWin ? "AppData/Roaming/Code/User" : ".config/Code/User");
  mkdirSync(vscodeDir, { recursive: true });

  const instructionsPath = join(vscodeDir, "copilot-instructions.md");
  writeFileSync(instructionsPath, vscodeInstruction(routerPath), "utf8");

  return { tool: "vscode", status: "wired", detail: instructionsPath };
}

function vscodeInstruction(routerPath) {
  return `# Prompt OS

Read and obey \`${routerPath}\` before any substantive action. This defines how every prompt is processed through outcome contracts and verification.

## Classification

- Trivial (Q&A, rename, one-line fix): answer directly
- Non-trivial (new capability, multi-file change): run contract pipeline

## Verification

All non-trivial work requires:
- Falsifiable North Star metric
- Outcome contract
- Evidence with command receipts
- Independent evaluation

## Community Skills

Available from ~/.agents/prompt-os/skills/community/:
- superpowers — shipping methodology
- agent-skills — production engineering
- anthropic-skills — design & testing
`;
}
