#!/usr/bin/env node
/**
 * Prompt OS Evidence Checker
 *
 * Validates that a contract has proper evidence before marking it done.
 * Exit codes:
 *   0 = proven or killed with sufficient evidence
 *   2 = false done claim (insufficient evidence)
 *   1 = error
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function checkEvidence(contractPath) {
  if (!existsSync(contractPath)) {
    console.error(`Contract not found: ${contractPath}`);
    process.exit(1);
  }

  const contract = readFileSync(contractPath, "utf8");
  const lines = contract.split("\n");

  let status = null;
  let hasMetric = false;
  let hasEvaluator = false;
  let commandEvidenceCount = 0;
  let hasBarRaiser = false;
  let hasDesignTokens = false;
  let hasAISlopChecklist = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    // Check status
    if (line.includes("status:")) {
      if (line.includes("proven") || line.includes("killed")) {
        status = line.includes("proven") ? "proven" : "killed";
      }
    }

    // Check for non-placeholder metric
    if (line.includes("metric") && /\d/.test(lines[i])) {
      hasMetric = true;
    }

    // Check for evaluator
    if (line.includes("evaluator") || line.includes("graded by")) {
      hasEvaluator = true;
    }

    // Check for command evidence
    if (line.match(/\$.*\w+/) || line.includes("exit:")) {
      commandEvidenceCount++;
    }

    // Check for bar-raiser keywords
    if (line.includes("baseline") || line.includes("competitor") || line.includes("poc") || line.includes("a/b")) {
      hasBarRaiser = true;
    }

    // Check for design tokens (UI contracts)
    if (line.includes("design token") || line.includes("palette") || line.includes("hex")) {
      hasDesignTokens = true;
    }

    // Check for AI-slop checklist
    if (line.includes("ai-slop") || line.includes("slop checklist") || line.includes("generic pattern")) {
      hasAISlopChecklist = true;
    }
  }

  const errors = [];

  // Required checks
  if (!status) {
    errors.push("Missing Status: proven or killed");
  }

  if (!hasMetric) {
    errors.push("Missing falsifiable metric with numbers");
  }

  if (!hasEvaluator) {
    errors.push("Missing evaluator identification");
  }

  if (commandEvidenceCount < 2) {
    errors.push(`Insufficient command evidence (${commandEvidenceCount} < 2 required)`);
  }

  if (!hasBarRaiser) {
    errors.push("Missing bar-raiser artifacts (baseline, PoC, or A/B)");
  }

  // UI-specific checks
  const isUIContract = contract.toLowerCase().includes("ui") || contract.toLowerCase().includes("page") || contract.toLowerCase().includes("component");
  if (isUIContract) {
    if (!hasDesignTokens) {
      errors.push("UI contract missing design token plan");
    }
    if (!hasAISlopChecklist) {
      errors.push("UI contract missing AI-slop checklist");
    }
  }

  if (errors.length > 0) {
    console.error("Evidence check failed:");
    for (const error of errors) {
      console.error(`  ✗ ${error}`);
    }
    process.exit(2);
  }

  console.log(`✓ Evidence check passed for ${status}`);
  console.log(`  Metric: ${hasMetric ? "present" : "missing"}`);
  console.log(`  Evaluator: ${hasEvaluator ? "identified" : "missing"}`);
  console.log(`  Command evidence: ${commandEvidenceCount} blocks`);
  console.log(`  Bar-raiser: ${hasBarRaiser ? "present" : "missing"}`);
  if (isUIContract) {
    console.log(`  Design tokens: ${hasDesignTokens ? "present" : "missing"}`);
    console.log(`  AI-slop checklist: ${hasAISlopChecklist ? "present" : "missing"}`);
  }

  process.exit(0);
}

// CLI
const args = process.argv.slice(2);
const contractPath = args[0];
const flag = args[1];

if (!contractPath) {
  console.error("Usage: node evidence-check.mjs <contract.md> [--done]");
  process.exit(1);
}

if (flag === "--done") {
  checkEvidence(contractPath);
} else {
  console.error("Usage: node evidence-check.mjs <contract.md> [--done]");
  process.exit(1);
}
