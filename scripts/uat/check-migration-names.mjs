#!/usr/bin/env node
// HARN-07: enforce supabase/migrations/20261201PPSS_description.sql for v1.20 files; forbid edits of existing ones.
// Usage: node scripts/uat/check-migration-names.mjs [baseRef=milestone/v1.20]
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT } from './lib.mjs';

const dir = resolve(ROOT, 'supabase/migrations');
const bad = [];
const seen = new Map();
for (const f of readdirSync(dir)) {
  if (!f.startsWith('20261201')) continue;
  const m = f.match(/^20261201(\d{2})(\d{2})_[a-z0-9_]+\.sql$/);
  if (!m) { bad.push(`${f}: must match 20261201PPSS_description.sql`); continue; }
  const pp = Number(m[1]); const ss = Number(m[2]);
  if (pp < 1 || pp > 27) bad.push(`${f}: PP must be 01-27 (27 = durcissement securite)`);
  if (ss < 1 || ss > 9) bad.push(`${f}: SS must be 01-09`);
  const k = m[1] + m[2];
  if (seen.has(k)) bad.push(`${f}: duplicate PPSS with ${seen.get(k)}`);
  seen.set(k, f);
}
try {
  const base = process.argv[2] || 'milestone/v1.20';
  const out = execFileSync('git', ['diff', '--name-status', `${base}...HEAD`, '--', 'supabase/migrations'], { cwd: ROOT, encoding: 'utf8' });
  for (const l of out.split('\n').filter(Boolean)) {
    const [s, p] = l.split('\t');
    if (s !== 'A') bad.push(`${p}: existing migration changed (${s})`);
  }
} catch (e) {
  console.warn('[check] diff skipped: ' + String(e.message).split('\n')[0]);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`[check] migration names OK (${seen.size} v1.20 files)`);
