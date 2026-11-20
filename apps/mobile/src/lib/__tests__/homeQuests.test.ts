import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPluginRouteLocked, getPluginIdFromSegments, PLUGIN_LEVEL_MAP } from '@ziko/plugin-sdk';

// L'index du SDK charge du code natif : on le remplace par le vrai module de gating (pur), seule partie utilisee ici.
// (chemin en variable : tsc ne doit pas inclure le fichier source du SDK dans le projet mobile)
vi.mock('@ziko/plugin-sdk', async () => {
  const path = ['../../../../..', 'packages/plugin-sdk/src/gating'].join('/');
  return await import(/* @vite-ignore */ path);
});
import { parseQuestSync, type Quest } from '@ziko/plugin-gamification/quests';
import {
  QUEST_ACTIONS, visibleHomeQuests, homeQuestsState, homeQuestsHeaderCount, homeCompletedNote, homeToastText,
  detectCompletions, orderQuests, coinsVisible, activeRowLabel, doneRowLabel,
} from '../homeQuests';

const root = resolve(__dirname, '../../../../..');
const row = (over: Record<string, unknown> = {}) => ({
  id: 'q1', slug: 'starter_daily_water', source: 'starter', scope: 'daily', title: "Boire 2 litres d'eau",
  description: null, icon: 'water', metric: 'hydration_ml', target: 2000, unit: 'ml', reward_coins: 15,
  period_start: '2026-11-20T00:00:00Z', expires_at: '2026-11-21T00:00:00Z', status: 'active', progress: 0, completed_at: null, ...over,
});
const qs = (...r: Record<string, unknown>[]): Quest[] => parseQuestSync({ quests: r.map((x) => row(x)) }).quests;
const starters = () => qs(
  { id: 'w', slug: 'starter_daily_workout', title: 'Terminer une séance', icon: 'barbell', metric: 'workout_sessions', target: 1, unit: 'séance', reward_coins: 25 },
  { id: 'm', slug: 'starter_daily_meal', title: 'Ajoute un repas', icon: 'restaurant', metric: 'nutrition_logs', target: 1, unit: 'repas', reward_coins: 15 },
  { id: 'h' },
);

describe('QNEW-03/04: welcome set order and copy (contract 4 and 6)', () => {
  it('orders eau, repas, seance (CLAR-03: hydration first) with the contract copy and one action each', () => {
    const v = visibleHomeQuests(starters(), 1);
    expect(v.map((x) => x.title)).toEqual(["Bois 2 litres d'eau", 'Ajoute un repas', 'Termine une séance']);
    expect(v.map((x) => x.action.verb)).toEqual(['Boire', 'Ajouter', 'Séance']);
    expect(v.map((x) => x.actionText)).toEqual([
      'Ajoute chaque verre dans Hydratation.', 'Note ton premier repas dans Nutrition.', "Lance une séance depuis l'onglet Séance.",
    ]);
  });
  it('never shows more than 3 (weekly starter of an existing account is dropped behind the dailies)', () => {
    const all = qs(
      { id: 'wk', slug: 'starter_weekly_train', scope: 'weekly', metric: 'workout_sessions', target: 3 },
      { id: 'w', slug: 'starter_daily_workout', metric: 'workout_sessions', target: 1 },
      { id: 'm', slug: 'starter_daily_meal', metric: 'nutrition_logs', target: 1 },
      { id: 'h' },
    );
    const v = visibleHomeQuests(all, 1);
    expect(v).toHaveLength(3);
    expect(v.map((x) => x.quest.id)).toEqual(['h', 'm', 'w']);
  });
  it('header: "N en cours", then "3 sur 3" when everything is done; never negative wording', () => {
    expect(homeQuestsHeaderCount(visibleHomeQuests(starters(), 1))).toBe('3 en cours');
    const one = qs(
      { id: 'h' },
      { id: 'm', slug: 'starter_daily_meal', metric: 'nutrition_logs', target: 1, status: 'completed' },
      { id: 'w', slug: 'starter_daily_workout', metric: 'workout_sessions', target: 1, status: 'completed' },
    );
    expect(homeQuestsHeaderCount(visibleHomeQuests(one, 1))).toBe('1 en cours');
    const all = starters().map((q) => ({ ...q, status: 'completed' as const }));
    expect(homeQuestsHeaderCount(visibleHomeQuests(all, 1))).toBe('3 sur 3');
  });
});

describe('QNEW-07 / D-08: nothing failed or expired is ever shown', () => {
  it('an expired quest in input yields no row', () => {
    const v = visibleHomeQuests(qs({ id: 'x', status: 'expired' }, { id: 'h2', slug: 'starter_daily_water2' }), 1);
    expect(v.map((x) => x.quest.id)).toEqual(['h2']);
    expect(visibleHomeQuests(qs({ id: 'x', status: 'expired' }), 1)).toEqual([]);
  });
  it('rendered strings never contain expir / échou / manqu / Non terminée', () => {
    const v = visibleHomeQuests(starters(), 3);
    const strings = [
      ...v.flatMap((x) => [x.title, x.actionText, x.action.verb, x.action.a11yLabel, activeRowLabel(x, null, 3), doneRowLabel(x, 3), homeCompletedNote(x.quest, 3)]),
      homeToastText([{ id: 'a', title: 'T', coins: 5 }], 3), homeQuestsHeaderCount(v),
    ].join(' ');
    expect(strings).not.toMatch(/expir|échou|manqu|Non terminée|perdu/i);
    expect(strings).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('D-05: coins hidden below level 3', () => {
  it('coinsVisible / note / toast / labels', () => {
    expect(coinsVisible(1)).toBe(false);
    expect(coinsVisible(2)).toBe(false);
    expect(coinsVisible(3)).toBe(true);
    expect(homeCompletedNote({ rewardCoins: 15 }, 1)).toBe('Terminé');
    expect(homeCompletedNote({ rewardCoins: 15 }, 3)).toBe('Terminé · +15 pièces récupérées');
    expect(homeToastText([{ id: 'a', title: "Bois 2 litres d'eau", coins: 15 }], 1)).toBe("Quête terminée : Bois 2 litres d'eau");
    expect(homeToastText([{ id: 'a', title: "Bois 2 litres d'eau", coins: 15 }], 3)).toBe("Quête terminée : Bois 2 litres d'eau (+15 pièces)");
    expect(homeToastText([{ id: 'a', title: 'A', coins: 15 }, { id: 'b', title: 'B', coins: 25 }], 3)).toBe('2 quêtes terminées (+40 pièces)');
    const h = visibleHomeQuests(starters(), 1)[0];
    expect(activeRowLabel(h, '0 / 2 L', 1)).toBe("Bois 2 litres d'eau. 0 / 2 L. Boire de l'eau, ouvrir Hydratation");
    expect(activeRowLabel(h, '0 / 2 L', 3)).toContain('Récompense 15 pièces.');
  });
});

describe('block state machine (contract 5)', () => {
  const v = visibleHomeQuests(starters(), 1);
  it('maps loading / error / creating / allDone / list', () => {
    expect(homeQuestsState({ loading: true, error: false, visible: [] })).toBe('loading');
    expect(homeQuestsState({ loading: false, error: true, visible: [] })).toBe('error');
    expect(homeQuestsState({ loading: false, error: false, visible: [] })).toBe('creating');
    expect(homeQuestsState({ loading: false, error: false, visible: v })).toBe('list');
    expect(homeQuestsState({ loading: false, error: false, visible: v.map((x) => ({ ...x, done: true })) })).toBe('allDone');
  });
});

describe('QNEW-06: completion detection and stable order', () => {
  it('announces an active -> completed transition once, plus server newlyCompleted, deduped', () => {
    const before = starters();
    const after = before.map((q) => (q.id === 'h' ? { ...q, status: 'completed' as const, progress: 2000 } : q));
    const seen = new Set<string>();
    const first = detectCompletions(before, after, [], seen);
    expect(first).toEqual([{ id: 'h', title: "Bois 2 litres d'eau", coins: 15 }]);
    first.forEach((c) => seen.add(c.id));
    expect(detectCompletions(after, after, [], seen)).toEqual([]);
    expect(detectCompletions(before, after, [{ id: 'h', title: 'x', coins: 15 }], seen)).toEqual([]);
    expect(detectCompletions(undefined, after, [{ id: 'm', title: 'Ajoute un repas', coins: 15 }], new Set())).toEqual([
      { id: 'm', title: 'Ajoute un repas', coins: 15 },
    ]);
  });
  it('first load of an already-completed quest is silent (no previous snapshot, nothing newly credited)', () => {
    expect(detectCompletions(undefined, starters().map((q) => ({ ...q, status: 'completed' as const })), [], new Set())).toEqual([]);
  });
  it('a completed row keeps its place during the session, done rows go last on the next read', () => {
    const base = starters();
    const order = visibleHomeQuests(base, 1).map((x) => x.quest.id);
    const done = base.map((q) => (q.id === 'h' ? { ...q, status: 'completed' as const } : q));
    expect(visibleHomeQuests(done, 1, order).map((x) => x.quest.id)).toEqual(order);
    expect(visibleHomeQuests(done, 1).map((x) => x.quest.id)).toEqual(['m', 'w', 'h']);
    expect(orderQuests(done, []).map((q) => q.id)).toEqual(['m', 'w', 'h']);
  });
});

describe('QNEW-05 / CLAR-04: no CTA reaches a locked screen at level 1, and the route guard never bounces it', () => {
  const routes = Object.values(QUEST_ACTIONS).map((a) => a.route);
  it('every route of the metric table is unlocked at level 1 (A5)', () => {
    for (const r of routes) expect(isPluginRouteLocked(r.split('/'), 1), r).toBe(false);
  });
  it('the plugins layout guard sees these routes as unlocked (segments as expo-router gives them)', () => {
    for (const r of routes) {
      const segments = ['(app)', ...r.split('/').filter((s) => s && s !== '(app)')];
      const id = getPluginIdFromSegments(segments);
      const info = id ? PLUGIN_LEVEL_MAP[id] : undefined;
      // _layout.tsx: bounce = levelLoaded && isLocked ; hold = !levelLoaded && gated plugin (minLevel > 1). Neither at level 1.
      expect(isPluginRouteLocked(segments, 1), r).toBe(false);
      if (id) expect(info?.minLevel, r).toBe(1);
    }
  });
  it('the guard still blocks a gated plugin (sanity: the check is not vacuous)', () => {
    expect(isPluginRouteLocked(['(app)', '(plugins)', 'journal', 'entry'], 1)).toBe(true);
    expect(isPluginRouteLocked(['(app)', '(plugins)', 'gamification', 'dashboard'], 1)).toBe(true);
  });
  it('every route points to an existing expo-router file', () => {
    for (const r of routes) {
      const rel = r.replace(/^\/\(app\)\//, '').replace(/^\//, '');
      const base = resolve(root, 'apps/mobile/app/(app)', rel);
      expect(existsSync(`${base}.tsx`) || existsSync(resolve(base, 'index.tsx')), r).toBe(true);
    }
  });
  it('the first-mission CTA of a level-1 account (hydration_log) lands on a level-1 route', () => {
    const src = readFileSync(resolve(root, 'apps/mobile/src/hooks/useHomeData.ts'), 'utf8');
    const m = src.match(/hydration_log:\s*'([^']+)'/);
    expect(m).not.toBeNull();
    expect(isPluginRouteLocked(m![1].split('/'), 1)).toBe(false);
    expect(isPluginRouteLocked(['(app)', ...m![1].split('/').filter(Boolean)], 1)).toBe(false);
  });
});

describe('QNEW-02: starter set is idempotent and welcome-shaped (static check of the migration files)', () => {
  const sql = (f: string) => readFileSync(resolve(root, 'supabase/portfolio-migrations', f), 'utf8');
  it('the latest ziko_sync_quests inserts starters with ON CONFLICT (user_id, slug, period_start) DO NOTHING', () => {
    const s = sql('20261201290400_quest_reward_system_award.sql');
    expect(s).toMatch(/is_starter AND is_active/);
    expect(s).toMatch(/ON CONFLICT \(user_id, slug, period_start\) DO NOTHING/);
    expect(sql('20261201130100_quest_tables.sql')).toMatch(/UNIQUE \(user_id, slug, period_start\)/);
  });
  it('the v1.21 migration adds the meal template (nutrition_logs), keeps water/workout starters, keeps the weekly starter (D-11)', () => {
    const s = sql('20261215010100_welcome_quests_meal_template.sql');
    expect(s).toMatch(/starter_daily_meal'.*'nutrition_logs'/s);
    expect(s).toMatch(/ON CONFLICT \(slug\) DO NOTHING/);
    expect(s).not.toMatch(/is_starter\s*=\s*false/i);
    expect(s).not.toMatch(/\b(DELETE|DROP|TRUNCATE)\b/i);
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
