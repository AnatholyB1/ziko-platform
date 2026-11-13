/**
 * Run3 : GET /forms/athlete/forms/pending repondait 500 (relation `ziko_form_instances` -> `coach_forms`
 * introuvable). Faux client PostgREST qui (a) refuse tout embed dont la table n'existe pas, comme le
 * vrai serveur (PGRST200), et (b) applique la RLS athlete : sans JWT de l'athlete, 0 ligne.
 * Ne prouve pas : PostgREST reel ni les policies SQL (couvertes par test:rls).
 */
import { describe, it, expect, vi } from 'vitest';

const KNOWN_TABLES = new Set(['ziko_coach_forms', 'ziko_form_instances', 'ziko_form_responses']);
const ATHLETE = 'a1111111-1111-4111-8111-111111111111';

const calls = vi.hoisted(() => ({ selects: [] as string[] }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_u: string, _k: string, opts?: any) => {
    const auth: string | undefined = opts?.global?.headers?.Authorization;
    const uid = auth && auth !== 'Bearer ' ? auth.slice(7) : null;
    let sel = '';
    const b: any = {
      from() { return b; },
      select(s: string) { sel = s; calls.selects.push(s); return b; },
      eq() { return b; },
      order() { return b; },
      rpc: () => Promise.resolve({ data: null, error: null }),
      then(ok: any, ko: any) {
        // embed `alias:table!inner(` ou `table!inner(`
        const embeds = [...sel.matchAll(/(?:(\w+):)?(\w+)!inner\s*\(/g)].map((m) => m[2]);
        const bad = embeds.find((t) => !KNOWN_TABLES.has(t));
        if (bad) {
          return Promise.resolve({ data: null, error: { code: 'PGRST200', message: `Could not find a relationship between 'ziko_form_instances' and '${bad}'` } }).then(ok, ko);
        }
        const rows = uid === ATHLETE
          ? [{ id: 'i1', form_id: 'f1', coach_forms: { title: 'Bilan', questions: [{ id: 'q1' }, { id: 'q2' }] } }]
          : []; // RLS : auth.uid() NULL ou autre -> rien
        return Promise.resolve({ data: rows, error: null }).then(ok, ko);
      },
    };
    return b;
  },
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const t = c.req.header('Authorization')?.slice(7);
    if (!t) return c.json({ error: 'unauthorized' }, 401);
    c.set('auth', { userId: t, email: '' });
    await next();
  },
}));
vi.mock('../lib/serviceClient.js', () => ({ createServiceRpcClient: () => ({ rpc: async () => ({ data: null, error: null }) }) }));

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'k';

import { formsRouter } from './forms.js';

describe('GET /athlete/forms/pending', () => {
  it('200 avec le formulaire en attente (relation ziko_coach_forms valide, RLS athlete via son JWT)', async () => {
    const res = await formsRouter.request('/athlete/forms/pending', { headers: { Authorization: `Bearer ${ATHLETE}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { forms: unknown[] };
    expect(body.forms).toEqual([
      expect.objectContaining({ instance_id: 'i1', form_id: 'f1', form_title: 'Bilan', question_count: 2 }),
    ]);
    expect(calls.selects.some((s) => /ziko_coach_forms!inner/.test(s))).toBe(true);
    expect(calls.selects.some((s) => /(^|[\s,(])coach_forms!inner/.test(s))).toBe(false);
  });
});
