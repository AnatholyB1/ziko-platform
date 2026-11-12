import { describe, it, expect } from 'vitest';
import {
  awardBadges, equipItem, fetchAchievements, fetchCoinHistory, awardWorkoutXP, HISTORY_PAGE_SIZE,
} from '../../../../../plugins/gamification/src/store';

type Call = { fn: string; args: any };

/** Faux client Supabase : enregistre les RPC, renvoie les tables fournies. */
function fake(opts: {
  tables?: Record<string, { data?: any; error?: any }>;
  rpc?: Record<string, { data?: any; error?: any }>;
  user?: { id: string } | null;
}) {
  const calls: Call[] = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: 'u1' } : opts.user } }) },
    rpc: async (fn: string, args: any) => {
      calls.push({ fn, args });
      return opts.rpc?.[fn] ?? { data: null, error: null };
    },
    from: (table: string) => {
      const res = opts.tables?.[table] ?? { data: [], error: null };
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        range: (a: number, b: number) => { calls.push({ fn: `range:${table}`, args: [a, b] }); return chain; },
        then: (ok: any) => ok({ data: res.data ?? null, error: res.error ?? null }),
      };
      return chain;
    },
  };
  return { supabase, calls };
}

const DEFS = [
  { slug: 'first_session', name: 'Première séance', description: 'd', icon: '🏋️', condition_type: 'sessions', condition_value: 1, tier: 1 },
  { slug: 'streak_7', name: 'Streak 7 jours', description: 'd', icon: '⚡', condition_type: 'streak', condition_value: 7, tier: 1 },
];

describe('awardBadges (D-08)', () => {
  it('calls the RPC with the authenticated user id and returns the new badges', async () => {
    const { supabase, calls } = fake({ rpc: { ziko_check_and_award_badges: { data: [{ slug: 'first_session', name: 'Première séance', coins: 25 }] } } });
    const r = await awardBadges(supabase);
    expect(calls[0]).toEqual({ fn: 'ziko_check_and_award_badges', args: { p_user_id: 'u1' } });
    expect(r).toEqual([{ slug: 'first_session', name: 'Première séance', coins: 25 }]);
  });
  it('never throws: RPC error, no user, or exception all return []', async () => {
    expect(await awardBadges(fake({ rpc: { ziko_check_and_award_badges: { error: { message: 'boom' } } } }).supabase)).toEqual([]);
    expect(await awardBadges(fake({ user: null }).supabase)).toEqual([]);
    const throwing = { auth: { getUser: async () => { throw new Error('offline'); } } };
    expect(await awardBadges(throwing)).toEqual([]);
  });
  it('awardWorkoutXP checks badges after the XP/coin awards (R-3 trigger on session end)', async () => {
    const { supabase, calls } = fake({
      rpc: { ziko_ensure_gamification_profile: { data: { xp: 0, level: 1, coins: 0, current_streak: 0, longest_streak: 0, last_activity_date: new Date().toISOString().split('T')[0] } } },
    });
    await awardWorkoutXP(supabase, 'sess-1');
    const order = calls.map((c) => c.fn);
    expect(order.indexOf('ziko_award_xp')).toBeGreaterThan(-1);
    expect(order[order.length - 1]).toBe('ziko_check_and_award_badges');
  });
});

describe('fetchAchievements (REWD-10: no fallback list)', () => {
  it('builds the 7/4 style view from definitions + earned + progress', async () => {
    const { supabase, calls } = fake({
      tables: {
        ziko_badge_definitions: { data: DEFS },
        ziko_user_badges: { data: [{ badge_slug: 'first_session', earned_at: '2026-11-12T09:00:00Z' }] },
      },
      rpc: { ziko_get_badge_progress: { data: { counters: {}, badges: [{ slug: 'streak_7', current: 5, reward_coins: 25 }] } } },
    });
    const r = await fetchAchievements(supabase, 'u1');
    expect(calls.find((c) => c.fn === 'ziko_get_badge_progress')!.args).toEqual({ p_user_id: 'u1' });
    expect(r.unlockedCount).toBe(1);
    expect(r.locked[0]).toMatchObject({ slug: 'streak_7', current: 5, target: 7 });
  });
  it.each([
    ['definitions', { ziko_badge_definitions: { error: { message: 'net' } } }, {}],
    ['earned', { ziko_user_badges: { error: { message: 'net' } } }, {}],
    ['progress rpc', {}, { ziko_get_badge_progress: { error: { message: 'net' } } }],
  ])('throws when %s fails, so the screen shows the error card instead of a static list', async (_n, tables, rpc) => {
    const { supabase } = fake({ tables: { ziko_badge_definitions: { data: DEFS }, ziko_user_badges: { data: [] }, ...tables }, rpc });
    await expect(fetchAchievements(supabase, 'u1')).rejects.toBeTruthy();
  });
});

describe('equipItem (D-12) and history paging (D-14)', () => {
  it('equips through the single atomic RPC (no client-side multi-update)', async () => {
    const { supabase, calls } = fake({ rpc: { ziko_equip_item: { data: { success: true, category: 'theme' } } } });
    const r = await equipItem(supabase, 'item-1');
    expect(r).toEqual({ success: true, category: 'theme' });
    expect(calls).toEqual([{ fn: 'ziko_equip_item', args: { p_item_id: 'item-1' } }]);
  });
  it('surfaces an RPC error as { success: false }', async () => {
    const { supabase } = fake({ rpc: { ziko_equip_item: { error: { message: 'Objet non possédé' } } } });
    expect(await equipItem(supabase, 'x')).toEqual({ success: false, error: 'Objet non possédé' });
  });
  it('paginates with range(), no hard limit(20)', async () => {
    const { supabase, calls } = fake({ tables: { ziko_coin_transactions: { data: [] } } });
    await fetchCoinHistory(supabase, 2);
    expect(calls.find((c) => c.fn === 'range:ziko_coin_transactions')!.args).toEqual([2 * HISTORY_PAGE_SIZE, 3 * HISTORY_PAGE_SIZE - 1]);
  });
  it('throws on a history error', async () => {
    const { supabase } = fake({ tables: { ziko_coin_transactions: { error: { message: 'x' } } } });
    await expect(fetchCoinHistory(supabase, 0)).rejects.toBeTruthy();
  });
});
