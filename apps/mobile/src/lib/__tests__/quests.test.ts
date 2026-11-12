import { describe, it, expect } from 'vitest';
import {
  activeCount, completedNote, dailyHeading, expiredNote, groupQuests, parseQuestSync, progressText,
  questRatio, questToastText, renewLabel, type Quest,
} from '@ziko/plugin-gamification/quests';
import { syncQuests, syncQuestsQuiet, awardWorkoutXP } from '@ziko/plugin-gamification/store';
import { historyLabel } from '@ziko/plugin-gamification/rewards';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'q1', slug: 'starter_daily_water', source: 'starter', scope: 'daily', title: "Boire 2 litres d'eau",
  description: null, icon: 'water', metric: 'hydration_ml', target: 2000, unit: 'ml', reward_coins: 15,
  period_start: '2026-11-12T23:00:00Z', expires_at: '2026-11-13T23:00:00Z', status: 'active', progress: 1300,
  completed_at: null, ...over,
});

const quest = (over: Partial<Quest> = {}): Quest => parseQuestSync({ quests: [row(over as any)] }).quests[0];

describe('parseQuestSync', () => {
  it('normalises rows (camelCase, numbers) and keeps the completion list', () => {
    const out = parseQuestSync({ quests: [row()], newly_completed: [{ id: 'q9', title: 'T', coins: '25' }] });
    expect(out.quests).toHaveLength(1);
    expect(out.quests[0]).toMatchObject({ id: 'q1', scope: 'daily', rewardCoins: 15, target: 2000, progress: 1300, status: 'active', source: 'starter' });
    expect(out.newlyCompleted).toEqual([{ id: 'q9', title: 'T', coins: 25 }]);
  });
  it('never invents quests: null / garbage / invalid rows give an empty list', () => {
    expect(parseQuestSync(null).quests).toEqual([]);
    expect(parseQuestSync({ quests: 'x' }).quests).toEqual([]);
    expect(parseQuestSync({ quests: [null, {}, row({ target: 0 }), row({ title: undefined })] }).quests).toEqual([]);
  });
  it('unknown status falls back to active, missing icon to flag (never an emoji)', () => {
    const q = quest({ status: 'weird' as any, icon: '' as any });
    expect(q.status).toBe('active');
    expect(q.icon).toBe('flag');
  });
});

describe('grouping (maquette B12)', () => {
  const all = parseQuestSync({
    quests: [
      row({ id: 'a', scope: 'daily' }),
      row({ id: 'b', scope: 'daily', status: 'completed' }),
      row({ id: 'c', scope: 'weekly' }),
      row({ id: 'd', scope: 'daily', status: 'expired' }),
    ],
  }).quests;
  it('splits daily / weekly / expired; expired never counts as active', () => {
    const g = groupQuests(all);
    expect(g.daily.map((q) => q.id)).toEqual(['a', 'b']);
    expect(g.weekly.map((q) => q.id)).toEqual(['c']);
    expect(g.expired.map((q) => q.id)).toEqual(['d']);
    expect(activeCount(all)).toBe(2);
  });
});

describe('progress rendering', () => {
  it('water in litres with a French decimal comma: 1,3 / 2 L', () => {
    expect(progressText(quest())).toBe('1,3 / 2 L');
    expect(progressText(quest({ progress: 0 } as any))).toBe('0 / 2 L');
  });
  it('a one-shot quest shows no counter; a multi quest shows n / N (capped at the target)', () => {
    expect(progressText(quest({ metric: 'workout_sessions', unit: 'séance', target: 1, progress: 0 } as any))).toBeNull();
    expect(progressText(quest({ metric: 'workout_sessions', unit: 'séance', target: 3, progress: 1 } as any))).toBe('1 / 3');
    expect(progressText(quest({ metric: 'workout_sessions', unit: 'séance', target: 3, progress: 5 } as any))).toBe('3 / 3');
  });
  it('ratio: clamped 0..1, completed = 1', () => {
    expect(questRatio(quest())).toBeCloseTo(0.65);
    expect(questRatio(quest({ progress: 9999 } as any))).toBe(1);
    expect(questRatio(quest({ status: 'completed', progress: 0 } as any))).toBe(1);
  });
});

describe('labels', () => {
  const now = Date.parse('2026-11-13T17:00:00Z');
  it('renewal countdown', () => {
    expect(renewLabel('2026-11-13T23:00:00Z', now)).toBe('dans 6 h');
    expect(renewLabel('2026-11-13T17:25:00Z', now)).toBe('dans 25 min');
    expect(renewLabel('2026-11-13T16:00:00Z', now)).toBe('dans 1 min'); // jamais negatif
    expect(renewLabel('2026-11-18T17:00:00Z', now)).toBe('dans 5 j');
    expect(renewLabel('nope', now)).toBe('');
  });
  it('daily heading matches the mockup', () => {
    expect(dailyHeading([quest()], now)).toBe("Aujourd'hui · se renouvelle dans 6 h");
    expect(dailyHeading([], now)).toBe("Aujourd'hui");
  });
  it('completed note matches the mockup; expired note is neutral (v1.18: no punitive wording)', () => {
    expect(completedNote({ rewardCoins: 60 })).toBe('Terminé · +60 pièces récupérées');
    expect(completedNote({ rewardCoins: 0 })).toBe('Terminé');
    const t = expiredNote().toLowerCase();
    for (const bad of ['échec', 'perdu', 'raté', 'manqué', 'perte']) expect(t).not.toContain(bad);
    expect(t).toContain('aucune pénalité');
  });
  it('toast text', () => {
    expect(questToastText([])).toBe('');
    expect(questToastText([{ id: '1', title: 'Boire 2 litres d\'eau', coins: 15 }])).toBe("Quête terminée : Boire 2 litres d'eau (+15 pièces)");
    expect(questToastText([{ id: '1', title: 'a', coins: 15 }, { id: '2', title: 'b', coins: 25 }])).toBe('2 quêtes terminées (+40 pièces)');
  });
  it('coin history labels the quest source', () => {
    expect(historyLabel({ source: 'quest', description: null })).toBe('Quête');
  });
});

describe('syncQuests (store)', () => {
  const client = (rpcRes: { data?: any; error?: any }, user: { id: string } | null = { id: 'u1' }) => {
    const calls: any[] = [];
    return {
      calls,
      supabase: {
        auth: { getUser: async () => ({ data: { user } }) },
        rpc: async (fn: string, args: any) => { calls.push({ fn, args }); return { data: rpcRes.data ?? null, error: rpcRes.error ?? null }; },
      },
    };
  };
  it('calls ziko_sync_quests with the signed-in user and parses the result', async () => {
    const { supabase, calls } = client({ data: { quests: [row()], newly_completed: [] } });
    const res = await syncQuests(supabase);
    expect(calls).toEqual([{ fn: 'ziko_sync_quests', args: { p_user_id: 'u1' } }]);
    expect(res.quests).toHaveLength(1);
  });
  it('throws on a server error (the screen shows the error card, never fallback quests)', async () => {
    await expect(syncQuests(client({ error: { message: 'boom' } }).supabase)).rejects.toBeTruthy();
    await expect(syncQuests(client({}, null).supabase)).rejects.toBeTruthy();
  });
  it('quiet variant never throws', async () => {
    expect(await syncQuestsQuiet(client({ error: { message: 'boom' } }).supabase)).toBeNull();
  });
  it('awardWorkoutXP syncs quests at the end of a session (best effort)', async () => {
    const { supabase, calls } = client({ data: { xp: 0, level: 1, coins: 0, current_streak: 0, longest_streak: 0, last_activity_date: new Date().toISOString().split('T')[0], quests: [], newly_completed: [] } });
    (supabase as any).from = () => {
      const chain: any = { select: () => chain, eq: () => chain, order: () => chain, then: (ok: any) => ok({ data: [], error: null }) };
      return chain;
    };
    await awardWorkoutXP(supabase, 's1');
    expect(calls.some((c) => c.fn === 'ziko_sync_quests')).toBe(true);
  });
});
