#!/usr/bin/env node
// HARN-07: enforce supabase/portfolio-migrations/20261201PPSS00_description.sql (14 chiffres) for v1.20 files;
// forbid edits of existing ones. Les 2 derniers chiffres (00) completent le format YYYYMMDDHHMMSS du dossier portfolio.
// Usage: node scripts/uat/check-migration-names.mjs [baseRef=milestone/v1.20]
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT } from './lib.mjs';

const dir = resolve(ROOT, 'supabase/portfolio-migrations');
const bad = [];
const seen = new Map();
for (const f of readdirSync(dir)) {
  if (!f.startsWith('20261201')) continue;
  const m = f.match(/^20261201(\d{2})(\d{2})00_[a-z0-9_]+\.sql$/);
  if (!m) { bad.push(`${f}: must match 20261201PPSS00_description.sql`); continue; }
  const pp = Number(m[1]); const ss = Number(m[2]);
  if (pp < 1 || pp > 29) bad.push(`${f}: PP must be 01-29 (27 = durcissement securite, 28 = correctifs revue B, 29 = correctifs UAT run4)`);
  if (ss < 1 || ss > 9) bad.push(`${f}: SS must be 01-09`);
  const k = m[1] + m[2];
  if (seen.has(k)) bad.push(`${f}: duplicate PPSS with ${seen.get(k)}`);
  seen.set(k, f);
}
try {
  const base = process.argv[2] || 'milestone/v1.20';
  const out = execFileSync('git', ['diff', '--name-status', `${base}...HEAD`, '--', 'supabase/portfolio-migrations'], { cwd: ROOT, encoding: 'utf8' });
  for (const l of out.split('\n').filter(Boolean)) {
    const [s, p] = l.split('\t');
    // Les fichiers v1.20 deplaces depuis supabase/migrations apparaissent comme ajouts (A) ; toute modif/suppression est interdite.
    if (s !== 'A' && !s.startsWith('R')) bad.push(`${p}: existing migration changed (${s})`);
  }
} catch (e) {
  console.warn('[check] diff skipped: ' + String(e.message).split('\n')[0]);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`[check] migration names OK (${seen.size} v1.20 files)`);
