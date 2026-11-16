// Fails if a banned character appears in src/** or index.html (docs/PLAN.md B1).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED = [
  ['—', 'em dash'],
  ['–', 'en dash'],
  ['·', 'middle dot'],
  ['•', 'bullet'],
];
const EMOJI = /\p{Extended_Pictographic}/u;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = ['index.html', ...walk('src')].filter((f) => /\.(tsx?|css|html|json|mjs|js|svg)$/.test(f));
const problems = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [ch, label] of BANNED) {
      if (line.includes(ch)) problems.push(`${file}:${i + 1}: ${label}`);
    }
    if (EMOJI.test(line)) problems.push(`${file}:${i + 1}: emoji`);
  });
}

if (problems.length) {
  console.error(`check-copy: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`check-copy: ${files.length} files clean`);
