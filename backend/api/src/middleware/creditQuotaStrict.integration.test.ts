/**
 * Run4 P23 : "4 POST /ai/chat -> 200 mais ledger/solde inchanges, aucune erreur journalisee".
 * Cause reelle (reproduite sur la branche de test) : le quota du jour etait DEJA consomme (3 lignes
 * type='quota' source='chat' a 00:23 UTC, plafond 1 + min(gains,2) = 3), donc les 4 tours sont partis sur
 * la voie "solde" ; or la RPC `ziko_deduct_ai_credits` leve 42P10 (ON CONFLICT sans predicat) et le
 * backend avalait l'erreur. Le comportement de facturation n'est volontairement PAS corrige ici
 * (decision : differe au deploiement) ; on verifie que le decompte gratuit marche et que l'echec est
 * desormais JOURNALISE.
 *
 * Faux Supabase STRICT : l'INSERT du ledger est refuse (comme avec la cle anon : "permission denied") si
 * le client n'est pas service_role, ou si le type viole la contrainte CHECK, ou si l'index unique
 * (user_id, source, idempotency_key) est viole. Ne prouve pas le SQL reel (rejoue a la main sur la
 * branche : INSERT service_role OK, INSERT anon 42501).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

const db = vi.hoisted(() => ({
  ledger: [] as any[],
  balance: 20,
  role: 'service_role' as 'service_role' | 'anon',
  debitBroken: true,
}));

const ALLOWED = ['deduct', 'earn', 'welcome', 'daily_base', 'monthly_base', 'admin_adjust', 'premium_grant', 'quota'];

vi.mock('@supabase/supabase-js', () => {
  function table(name: string) {
    const filters: Array<(r: any) => boolean> = [];
    let head = false;
    let insertRow: any = null;
    const b: any = {
      select(_c?: string, o?: any) { head = !!o?.head; return b; },
      eq(k: string, v: unknown) { filters.push((r) => r[k] === v); return b; },
      gte(k: string, v: string) { filters.push((r) => r[k] >= v); return b; },
      insert(row: any) { insertRow = row; return b; },
      upsert() { return Promise.resolve({ error: null }); },
      single() { return Promise.resolve(resolve(true)); },
      then(ok: any, ko: any) { return Promise.resolve(resolve(false)).then(ok, ko); },
    };
    function resolve(single: boolean): any {
      // Flag absent (comme la branche de test) : .single() sans ligne => erreur PGRST116, data null.
      if (name === 'ziko_app_config') return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      if (name === 'ziko_user_profiles') return { data: { tier: 'free' }, error: null };
      if (name === 'ziko_user_ai_credits') return { data: { balance: db.balance }, error: null };
      if (insertRow) {
        if (db.role !== 'service_role') {
          return { data: null, error: { code: '42501', message: 'permission denied for table ziko_ai_credit_transactions' } };
        }
        if (!ALLOWED.includes(insertRow.type)) {
          return { data: null, error: { code: '23514', message: 'violates check constraint' } };
        }
        const dup = db.ledger.some((r) => r.user_id === insertRow.user_id && r.source === insertRow.source
          && insertRow.idempotency_key != null && r.idempotency_key === insertRow.idempotency_key);
        if (dup) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        db.ledger.push({ ...insertRow, created_at: new Date().toISOString() });
        return { data: null, error: null };
      }
      const rows = db.ledger.filter((r) => filters.every((f) => f(r)));
      if (head) return { count: rows.length, data: null, error: null };
      return { data: single ? rows[0] ?? null : rows, error: null };
    }
    return b;
  }
  return {
    createClient: () => ({
      from: (n: string) => table(n),
      rpc: (fn: string) => {
        if (fn === 'ziko_deduct_ai_credits' && db.debitBroken) {
          return Promise.resolve({
            data: null,
            error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' },
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    }),
  };
});

import { creditCheck, creditDeduct } from './creditGate.js';

const today = () => new Date().toISOString();

function buildApp() {
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('auth', { userId: 'u1', email: '' }); await next(); });
  app.post('/t', creditCheck('chat'), creditDeduct('chat'), (c) => c.json({ ok: true }));
  return app;
}
const turn = (app: Hono) => app.request('/t', { method: 'POST' });
const flush = () => new Promise((r) => setTimeout(r, 0));

let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  db.ledger = [
    // 2 gains aujourd'hui => plafond chat = 1 + min(2, 2) = 3
    { user_id: 'u1', type: 'earn', source: 'meal', idempotency_key: 'e1', created_at: today() },
    { user_id: 'u1', type: 'earn', source: 'audit', idempotency_key: 'e2', created_at: today() },
  ];
  db.balance = 20;
  db.role = 'service_role';
  db.debitBroken = true;
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errSpy.mockRestore());

describe('P23 run4 : decompte du quota gratuit + journal des echecs', () => {
  it('les 3 tours gratuits ecrivent chacun une ligne quota (insert strict accepte), sans erreur', async () => {
    const app = buildApp();
    for (let i = 0; i < 3; i++) expect((await turn(app)).status).toBe(200);
    expect(db.ledger.filter((r) => r.type === 'quota' && r.source === 'chat')).toHaveLength(3);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('au-dela du quota, un debit casse (42P10) laisse ledger/solde inchanges mais est JOURNALISE', async () => {
    const app = buildApp();
    for (let i = 0; i < 3; i++) await turn(app);
    const before = db.ledger.length;
    // Comportement de facturation inchange (differe) : 200, rien de debite...
    expect((await turn(app)).status).toBe(200);
    await flush();
    expect(db.ledger).toHaveLength(before);
    expect(db.balance).toBe(20);
    // ... mais l'echec n'est plus silencieux.
    const logged = errSpy.mock.calls.map((c) => String(c[0]));
    expect(logged.some((l) => l.includes('deductCredits failed') && l.includes('42P10'))).toBe(true);
    expect(logged.some((l) => l.includes('charge NOT applied'))).toBe(true);
  });

  it("un INSERT de ledger refuse (cle anon : 42501) n'est pas avale : journalise, reponse 200 conservee", async () => {
    db.role = 'anon';
    const app = buildApp();
    expect((await turn(app)).status).toBe(200);
    expect(db.ledger.filter((r) => r.type === 'quota')).toHaveLength(0);
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('trackQuotaUsage insert failed'))).toBe(true);
  });
});
