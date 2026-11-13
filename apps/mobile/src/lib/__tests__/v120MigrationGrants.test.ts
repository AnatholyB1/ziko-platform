// Non-regression UAT run2 (defaut 3): the portfolio schema has no default privileges, so a table created
// without an explicit GRANT answers "permission denied". Every table created by a v1.20 migration
// (supabase/migrations/2026120*) must be the target of a GRANT in the v1.20 migrations.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(__dirname, '../../../../../supabase/migrations');
const files = fs.readdirSync(DIR).filter((f) => /^2026120\d+_.*\.sql$/.test(f)).sort();
const sqlByFile = new Map(files.map((f) => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]));
const allSql = [...sqlByFile.values()].join('\n');

const created: Array<{ table: string; file: string }> = [];
for (const [file, sql] of sqlByFile) {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) created.push({ table: m[1], file });
}

function hasGrant(table: string, role: string): boolean {
  const re = new RegExp(`grant\\s+[^;]*?\\bon\\s+(?:table\\s+)?(?:public\\.[a-z0-9_]+\\s*,\\s*)*public\\.${table}\\b[^;]*?\\bto\\b[^;]*?\\b${role}\\b`, 'is');
  return re.test(allSql);
}

describe('v1.20 migrations: explicit table GRANTs', () => {
  it('detects the v1.20 tables', () => {
    expect(created.length).toBeGreaterThanOrEqual(10);
  });

  for (const { table, file } of created) {
    it(`${table} (${file}) is granted to service_role or authenticated`, () => {
      expect(hasGrant(table, 'authenticated') || hasGrant(table, 'service_role')).toBe(true);
    });
  }

  // Run3 : `service_role` n'a AUCUN privilege par defaut sur le schema portfolio. Toute table creee OU etendue
  // par une migration v1.20 ET lue/ecrite par le backend (`.from('<table>')` dans backend/api/src) doit etre
  // accordee a service_role (le backend la lit via le client service, sinon "permission denied").
  const touched = new Set<string>(created.map((c) => c.table));
  for (const sql of sqlByFile.values()) {
    const re = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(ziko_[a-z0-9_]+)"?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) touched.add(m[1]);
  }
  const SRC = path.resolve(__dirname, '../../../../../backend/api/src');
  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) && !/testutil/.test(e.name)) out.push(p);
    }
    return out;
  }
  const backendSrc = walk(SRC).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const usedByBackend = [...touched].filter((t) => new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]`).test(backendSrc)).sort();

  it('detects v1.20 tables used by the backend', () => {
    expect(usedByBackend.length).toBeGreaterThanOrEqual(5);
    expect(usedByBackend).toContain('ziko_workshop_drafts');
    expect(usedByBackend).toContain('ziko_athlete_goals');
  });

  for (const t of usedByBackend) {
    it(`${t} (used by backend/api/src) is granted to service_role`, () => {
      expect(hasGrant(t, 'service_role')).toBe(true);
    });
  }

  it('client-facing tables read by the mobile app are granted to authenticated', () => {
    for (const t of [
      'ziko_hydration_settings',
      'ziko_stretching_exercises',
      'ziko_user_supplement_stack',
      'ziko_supplement_intakes',
      'ziko_supplement_reminder_prefs',
    ]) {
      expect(hasGrant(t, 'authenticated'), t).toBe(true);
    }
  });
});
