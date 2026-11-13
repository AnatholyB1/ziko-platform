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
  const re = new RegExp(`grant\\s+[^;]*?\\bon\\s+(?:table\\s+)?public\\.${table}\\b[^;]*?\\bto\\b[^;]*?\\b${role}\\b`, 'is');
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
