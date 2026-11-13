/**
 * UAT run 6 : daily_earned (6) > daily_cap (4). Garde STATIQUE de la migration 202612012903 : le comptage du
 * plafond journalier doit se faire SOUS un verrou consultatif par utilisateur, sinon deux earnCredits()
 * concurrents (outils du chat en fire-and-forget) depassent le plafond. Ce test lit le SQL : il ne prouve pas le
 * comportement concurrent reel sur Postgres (a re-verifier sur la branche uat).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(__dirname, '../../../../supabase/migrations/202612012903_earn_credits_daily_cap_lock.sql'),
  'utf8',
);

describe('ziko_earn_ai_credits : plafond journalier sous verrou (migration 2903)', () => {
  it('prend un verrou consultatif transactionnel par utilisateur AVANT de compter', () => {
    const lock = sql.indexOf('pg_advisory_xact_lock');
    const count = sql.indexOf('SELECT COUNT(*)');
    const insert = sql.indexOf('INSERT INTO public.ziko_ai_credit_transactions');
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(count);
    expect(count).toBeLessThan(insert);
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtextextended\([^)]*p_user_id/);
  });

  it('refuse au-dela du plafond et reste idempotente (CREATE OR REPLACE, ON CONFLICT)', () => {
    expect(sql).toMatch(/v_earn_count >= p_daily_cap/);
    expect(sql).toMatch(/daily_cap_reached/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.ziko_earn_ai_credits/);
    expect(sql).toMatch(/ON CONFLICT \(user_id, source, idempotency_key\) WHERE idempotency_key IS NOT NULL DO NOTHING/);
  });

  it('reste reservee a service_role et ne touche pas au debit', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.ziko_earn_ai_credits\(uuid, text, text, integer, integer\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.ziko_earn_ai_credits\(uuid, text, text, integer, integer\) TO service_role/);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.ziko_deduct_ai_credits/);
  });
});
