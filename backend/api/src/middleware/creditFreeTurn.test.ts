/**
 * UAT run 9, constat 8 : "le solde reste a 20 apres un tour annonce a 4 credits". Investigation SANS toucher a la
 * facturation (decision : `ziko_deduct_ai_credits` differe au deploiement).
 *
 * Conclusion reproduite ici avec un faux Supabase STRICT (l'INSERT du ledger n'est accepte que pour service_role, sur un
 * type autorise, sans doublon de cle d'idempotence) :
 *  - `cost: 4` dans l'evenement SSE `meta` de l'Atelier est le PRIX d'un message (CREDIT_COSTS.chat), pas un debit : tant
 *    qu'il reste un message gratuit du jour (1 de base + min(gains du jour, 2)), le tour passe en quota gratuit, ecrit une
 *    ligne `quota` d'un montant 0 et NE DEBITE PAS (solde 20 -> 20 est le comportement attendu) ;
 *  - une fois le quota epuise, le tour suivant appelle la RPC de debit avec le cout reel (4) ;
 *  - le solde ne bouge pas non plus quand la RPC de debit est cassee : cas deja couvert (et journalise) par
 *    creditQuotaStrict.integration.test.ts (42P10).
 * Ce test ne prouve pas le SQL reel de la RPC.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

const db = vi.hoisted(() => ({
  ledger: [] as any[],
  balance: 20,
  deductCalls: [] as any[],
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
      if (name === 'ziko_app_config') return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      if (name === 'ziko_user_profiles') return { data: { tier: 'free' }, error: null };
      if (name === 'ziko_user_ai_credits') return { data: { balance: db.balance }, error: null };
      if (insertRow) {
        if (!ALLOWED.includes(insertRow.type)) return { data: null, error: { code: '23514', message: 'violates check constraint' } };
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
      rpc: (fn: string, args: any) => {
        if (fn === 'ziko_deduct_ai_credits') {
          db.deductCalls.push(args);
          db.balance -= args.p_cost;
          return Promise.resolve({ data: { success: true, balance_after: db.balance }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    }),
  };
});

import { creditCheck, creditDeduct } from './creditGate.js';
import { CREDIT_COSTS } from '../config/credits.js';

const today = () => new Date().toISOString();
function buildApp() {
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('auth', { userId: 'u1', email: '' }); await next(); });
  // Meme chaine que POST /ai/workshop/stream : creditCheck('chat') + creditDeduct('chat').
  app.post('/t', creditCheck('chat'), creditDeduct('chat'), (c) => c.json({ ok: true, announced_cost: CREDIT_COSTS.chat }));
  return app;
}
const turn = (app: Hono) => app.request('/t', { method: 'POST' });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  // 1 gain aujourd'hui => quota gratuit chat = 1 + min(1, 2) = 2 messages
  db.ledger = [{ user_id: 'u1', type: 'earn', source: 'meal', idempotency_key: 'e1', created_at: today() }];
  db.balance = 20;
  db.deductCalls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('tour annonce a 4 credits : debit seulement hors quota gratuit (facturation inchangee)', () => {
  it('le prix annonce est 4, mais un tour dans le quota gratuit ne debite rien (solde 20 -> 20, une ligne quota)', async () => {
    const app = buildApp();
    const res = await turn(app);
    expect(res.status).toBe(200);
    expect((await res.json()).announced_cost).toBe(4);
    await flush();
    expect(db.deductCalls).toHaveLength(0);
    expect(db.balance).toBe(20);
    expect(db.ledger.filter((r) => r.type === 'quota' && r.source === 'chat' && r.amount === 0)).toHaveLength(1);
  });

  it('le quota epuise (2 tours gratuits), le 3e tour debite le cout reel via la RPC : 20 -> 16', async () => {
    const app = buildApp();
    await turn(app); await turn(app);
    expect(db.deductCalls).toHaveLength(0);
    expect((await turn(app)).status).toBe(200);
    await flush();
    expect(db.deductCalls).toHaveLength(1);
    expect(db.deductCalls[0].p_cost).toBe(4);
    expect(db.balance).toBe(16);
  });

  it('un tour en echec (>= 400) ne consomme ni quota ni credit', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => { c.set('auth', { userId: 'u1', email: '' }); await next(); });
    app.post('/t', creditCheck('chat'), creditDeduct('chat'), (c) => c.json({ error: 'boom' }, 500));
    expect((await app.request('/t', { method: 'POST' })).status).toBe(500);
    await flush();
    expect(db.ledger.filter((r) => r.type === 'quota')).toHaveLength(0);
    expect(db.deductCalls).toHaveLength(0);
    expect(db.balance).toBe(20);
  });
});
