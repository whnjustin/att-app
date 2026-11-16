// Fails if a private seed term appears in tracked files or dist/ (docs/PLAN.md B7).
// Terms are stored only as SHA-256 hashes of lowercase 1 and 2 word windows.
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DENY = new Set([
  'e8177bfb7a8b14614088091c1d7bfce4c3fad5bf9c5a706b4e32ccaec7f5f235',
  '052ff38befb367b06353d0c39e3fca98f0d4ae2da161ae681010e299120ad502',
  '161db4bae97234e135b08157cb7a039513cfdb9e4860d3c5e068730c4319aa96',
  '77594002e19d7f0d7b7e2e6725374fe3b02307f6b7e267552a2583d622455953',
  'fad5fba0dc7003ecf9f553c18016f5212ae38becef83aa622bef98d3be7db7fd',
]);

export const sha = (s) => createHash('sha256').update(s).digest('hex');

export function findPrivate(text, deny = DENY) {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const hits = new Set();
  for (let i = 0; i < words.length; i++) {
    if (deny.has(sha(words[i]))) hits.add(words[i]);
    if (i + 1 < words.length && deny.has(sha(`${words[i]} ${words[i + 1]}`)))
      hits.add(`${words[i]} ${words[i + 1]}`);
  }
  return [...hits];
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tracked = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const files = [...tracked, ...(existsSync('dist') ? walk('dist') : [])].filter(
    (f) => existsSync(f) && !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf)$/i.test(f),
  );
  const problems = [];
  for (const f of files) {
    const hits = findPrivate(readFileSync(f, 'utf8'));
    if (hits.length) problems.push(`${f}: private term found`);
  }
  if (problems.length) {
    console.error(`check-private: ${problems.length} file(s)\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log(`check-private: ${files.length} files clean`);
}
