#!/usr/bin/env node
/**
 * Prompt OS Watchdog
 *
 * Detects infinite loops and stalls in agent execution.
 * Exit codes:
 *   10 = stall detected (identical outputs)
 *   11 = ack-loop detected (repetitive acknowledgments)
 *   0 = no issues detected
 *   1 = error
 */
import { readFileSync, existsSync } from "node:fs";

function detectStall(lines, windowSize = 5) {
  if (lines.length < windowSize * 2) return false;

  // Check for identical consecutive outputs
  let identicalCount = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === lines[i - 1]) {
      identicalCount++;
      if (identicalCount >= windowSize) return true;
    } else {
      identicalCount = 0;
    }
  }

  return false;
}

function detectAckLoop(lines) {
  const ackPatterns = [
    /ok/i,
    /understood/i,
    /got it/i,
    /proceeding/i,
    /continue/i,
    /will do/i,
  ];

  let ackCount = 0;
  for (const line of lines) {
    for (const pattern of ackPatterns) {
      if (pattern.test(line) && line.length < 50) {
        ackCount++;
        break;
      }
    }
  }

  // If more than 20% of lines are short acknowledgments
  return ackCount > lines.length * 0.2 && ackCount > 5;
}

function analyzeTranscript(transcriptPath) {
  if (!existsSync(transcriptPath)) {
    console.error(`Transcript not found: ${transcriptPath}`);
    process.exit(1);
  }

  const content = readFileSync(transcriptPath, "utf8");
  const lines = content.split("\n").filter(line => line.trim());

  if (detectStall(lines)) {
    console.error("Stall detected: identical consecutive outputs");
    process.exit(10);
  }

  if (detectAckLoop(lines)) {
    console.error("Ack-loop detected: repetitive acknowledgments");
    process.exit(11);
  }

  console.log("✓ No stalls or ack-loops detected");
  process.exit(0);
}

// CLI
const args = process.argv.slice(2);
const fileArg = args.indexOf("--file");
const transcriptPath = fileArg !== -1 ? args[fileArg + 1] : null;

if (!transcriptPath) {
  console.error("Usage: node watchdog.mjs --file <transcript.log>");
  process.exit(1);
}

analyzeTranscript(transcriptPath);
