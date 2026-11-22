/**
 * Run3 P23 : le quota gratuit doit etre BORNE. Ce test enchaine le VRAI creditCheck + creditDeduct +
 * creditService sur un faux Supabase a etat (ledger en memoire avec l'index unique
 * (user_id, source, idempotency_key) et la RPC de debit), et envoie N tours.
 * Ne prouve pas : le SQL reel (RPC, trigger balance_after) ni le minuit UTC reel (horloge figee ici).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const db = vi.hoisted(() => ({
  ledger: [] as any[],
  balance: 0,
  tier: 'free',
}));

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
      if (name === 'ziko_app_config') return { data: { value: true }, error: null };
      if (name === 'ziko_user_profiles') return { data: { tier: db.tier }, error: null };
      if (name === 'ziko_user_ai_credits') return { data: { balance: db.balance }, error: null };
      if (insertRow) {
        const dup = db.ledger.some(
          (r) => r.user_id === insertRow.user_id && r.source === insertRow.source
            && insertRow.idempotency_key != null && r.idempotency_key === insertRow.idempotency_key,
        );
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
      rpc: (fn: string, a: any) => {
        if (fn !== 'ziko_deduct_ai_credits') return Promise.resolve({ data: null, error: null });
        if (db.balance < a.p_cost) {
          return Promise.resolve({ data: { success: false, balance: db.balance, required: a.p_cost }, error: null });
        }
        db.balance -= a.p_cost;
        const dup = db.ledger.some((r) => r.user_id === a.p_user_id && r.source === a.p_action_type
          && r.idempotency_key === a.p_idempotency_key);
        if (!dup) {
          db.ledger.push({ user_id: a.p_user_id, type: 'deduct', amount: -a.p_cost, source: a.p_action_type,
            idempotency_key: a.p_idempotency_key, created_at: new Date().toISOString() });
        }
        return Promise.resolve({ data: { success: true, balance_after: db.balance }, error: null });
      },
    }),
  };
});

import { creditCheck, creditDeduct } from './creditGate.js';

function buildApp(status = 200) {
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('auth', { userId: 'u1', email: '' }); await next(); });
  app.post('/t', creditCheck('chat'), creditDeduct('chat'), (c) => c.json({ ok: true }, status as any));
  return app;
}

const turn = (app: Hono, headers: Record<string, string> = {}) => app.request('/t', { method: 'POST', headers });

beforeEach(() => { db.ledger = []; db.balance = 0; db.tier = 'free'; });

describe('quota gratuit borne (chat : base 1, aucun gain => 1 tour gratuit)', () => {
  it('le tour N+1 est refuse en 402 puis ne repart pas en gratuit', async () => {
    const app = buildApp();
    expect((await turn(app)).status).toBe(200);
    for (let i = 0; i < 5; i++) {
      const r = await turn(app);
      expect(r.status).toBe(402);
    }
    expect(db.ledger.filter((r) => r.type === 'quota')).toHaveLength(1);
  });

  it('un X-Request-Id identique et reutilise ne contourne pas le quota', async () => {
    const app = buildApp();
    const h = { 'X-Request-Id': 'same-key' };
    expect((await turn(app, h)).status).toBe(200);
    expect((await turn(app, h)).status).toBe(402);
    expect((await turn(app, h)).status).toBe(402);
    expect(db.ledger.filter((r) => r.type === 'quota')).toHaveLength(1);
  });

  it('apres remise du solde : les tours sont DEBITES, pas gratuits', async () => {
    const app = buildApp();
    await turn(app);
    expect((await turn(app)).status).toBe(402);
    db.balance = 8;
    expect((await turn(app)).status).toBe(200);
    expect((await turn(app)).status).toBe(200);
    expect(db.balance).toBe(0);
    expect((await turn(app)).status).toBe(402);
    expect(db.ledger.filter((r) => r.type === 'quota')).toHaveLength(1);
    expect(db.ledger.filter((r) => r.type === 'deduct')).toHaveLength(2);
  });

  it('un tour en echec (>= 400) ne consomme pas de slot gratuit', async () => {
    const failing = buildApp(502);
    expect((await turn(failing)).status).toBe(502);
    expect(db.ledger).toHaveLength(0);
    expect((await turn(buildApp())).status).toBe(200);
  });
});
