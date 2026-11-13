// Run3 MC-8 : DELETE /coach/clients/links/:id. Monte le VRAI routeur Hono (clientsRouter) avec un
// faux client Supabase en memoire qui APPLIQUE les filtres .eq/.is de l'update et compte les lignes
// modifiees. L'ancien test mockait la couche db et n'a pas vu le masquage de route.
// Ce que ca ne prouve pas : RLS / trigger ziko_coach_link_guard (revoked_by) cote Postgres reel ;
// le faux client reproduit le trigger (revoked_by) pour verifier que le service ne le falsifie pas.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const COACH = '11111111-1111-4111-8111-111111111111';
const ATHLETE = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const LINK_ID = '44444444-4444-4444-8444-444444444444';

type Row = {
  id: string;
  coach_id: string;
  client_id: string;
  revoked_at: string | null;
  revoked_by: string | null;
};

const state = vi.hoisted(() => ({ rows: [] as any[], updates: 0, currentUser: '' }));

vi.mock('@supabase/supabase-js', () => {
  function builder(jwtUser: () => string) {
    const filters: Array<(r: Row) => boolean> = [];
    let patch: Partial<Row> | null = null;
    const b: any = {
      from() { return b; },
      update(p: Partial<Row>) { patch = p; return b; },
      select() { return b; },
      eq(col: keyof Row, val: unknown) { filters.push((r) => r[col] === val); return b; },
      is(col: keyof Row, val: unknown) { filters.push((r) => r[col] === val); return b; },
      maybeSingle() { return Promise.resolve(run(true)); },
      then(res: any, rej: any) { return Promise.resolve(run(false)).then(res, rej); },
    };
    function run(single: boolean) {
      const rows = (state.rows as Row[]).filter((r) => filters.every((f) => f(r)));
      // Reproduit RLS : l'appelant ne voit que les liens dont il est partie.
      const visible = rows.filter((r) => r.client_id === jwtUser() || r.coach_id === jwtUser());
      if (patch) {
        for (const r of visible) {
          Object.assign(r, patch);
          // trigger ziko_coach_link_guard : revoked_by pose cote serveur
          r.revoked_by = r.client_id === jwtUser() ? 'client' : 'coach';
          state.updates += 1;
        }
      }
      const data = single ? (visible[0] ?? null) : visible;
      return { data, error: null };
    }
    return b;
  }
  return {
    createClient: (_url: string, _key: string, opts?: any) => {
      const auth: string | undefined = opts?.global?.headers?.Authorization;
      return builder(() => (auth ? auth.slice(7) : ''));
    },
  };
});

// L'auth reelle appelle Supabase : on garde le routeur mais le jeton = l'id utilisateur.
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const t = c.req.header('Authorization')?.slice(7);
    if (!t) return c.json({ error: 'Missing Authorization header' }, 401);
    c.set('auth', { userId: t, email: '' });
    await next();
  },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: () => undefined }));
vi.mock('../../src/services/notificationService.js', () => ({ notificationService: {} }));
vi.mock('../../src/lib/serviceClient.js', () => ({ createServiceRpcClient: () => ({}) }));

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';

async function del(user: string, param: string) {
  const { clientsRouter } = await import('../../src/coach/clients/service.js');
  return clientsRouter.request(`/links/${param}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${user}` },
  });
}

beforeEach(() => {
  state.updates = 0;
  state.rows = [
    { id: LINK_ID, coach_id: COACH, client_id: ATHLETE, revoked_at: null, revoked_by: null },
  ];
});

describe('DELETE /coach/clients/links/:id (routeur reel, faux client Supabase)', () => {
  it('athlete : param = id du lien -> 1 ligne modifiee, revoked_at pose, revoked_by=client', async () => {
    const res = await del(ATHLETE, LINK_ID);
    expect(res.status).toBe(200);
    expect((await res.json()).revoked_by).toBe('client');
    expect(state.updates).toBe(1);
    expect(state.rows[0].revoked_at).not.toBeNull();
    expect(state.rows[0].revoked_by).toBe('client');
  });

  it('coach : param = client_id -> 1 ligne modifiee, revoked_by=coach', async () => {
    const res = await del(COACH, ATHLETE);
    expect(res.status).toBe(200);
    expect(state.updates).toBe(1);
    expect(state.rows[0].revoked_at).not.toBeNull();
    expect(state.rows[0].revoked_by).toBe('coach');
  });

  it('jamais 200 si 0 ligne modifiee : tiers, id inconnu, lien deja retire', async () => {
    expect((await del(OTHER, LINK_ID)).status).toBe(404);
    expect((await del(OTHER, ATHLETE)).status).toBe(404);
    expect((await del(ATHLETE, OTHER)).status).toBe(404);
    expect(state.updates).toBe(0);
    expect(state.rows[0].revoked_at).toBeNull();

    expect((await del(ATHLETE, LINK_ID)).status).toBe(200);
    expect((await del(ATHLETE, LINK_ID)).status).toBe(404);
    expect((await del(COACH, ATHLETE)).status).toBe(404);
    expect(state.updates).toBe(1);
  });

  it('athlete ne peut pas retirer via le chemin coach (id lien != client_id)', async () => {
    // L'athlete passe son propre id : ne correspond ni a un lien.id ni a un lien dont il est coach.
    expect((await del(ATHLETE, ATHLETE)).status).toBe(404);
    expect(state.updates).toBe(0);
  });

  it('refuse un identifiant mal forme (400)', async () => {
    expect((await del(ATHLETE, 'not-a-uuid')).status).toBe(400);
  });
});
