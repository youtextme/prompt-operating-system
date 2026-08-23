import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const lib = join(here, 'HEALTH-NUDGES.md');
const pointerFile = join(here, '.pointer');

const lines = readFileSync(lib, 'utf8')
  .split(/\r?\n/)
  .filter((l) => /^\d+\.\s/.test(l))
  .map((l) => l.replace(/^\d+\.\s*/, '').trim());

let pointer = 0;
try {
  pointer = parseInt(readFileSync(pointerFile, 'utf8').trim(), 10) || 0;
} catch {}

const nudge = lines[pointer % lines.length];
writeFileSync(pointerFile, String((pointer + 1) % lines.length));
console.log(`\uD83D\uDCAA ${nudge}`);
