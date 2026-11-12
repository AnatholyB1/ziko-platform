import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GamificationPlugin from '../../../../../plugins/gamification/src/screens/GamificationPlugin';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Faux Supabase a etat : `ziko_sync_quests` recalcule les quetes a partir des "donnees reelles" du monde
// (eau bue, seances), comme la fonction SQL (la logique SQL elle-meme est prouvee par scripts/uat/p13-quests-sql).
// Ces tests prouvent le CABLAGE de l'ecran (lecture base, rafraichissement, etats), pas le SQL.
interface World {
  coins: number;
  waterMl: number;
  sessions: number;
  weeklyDone: boolean;
  expired: boolean;
  noQuests: boolean;
  failNetwork: boolean;
  rewarded: Set<string>;
  syncCalls: number;
}

const EXPIRES = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
const WEEK_END = new Date(Date.now() + 3 * 86400 * 1000).toISOString();

function quests(w: World) {
  const mk = (over: Record<string, unknown>) => ({
    description: null, source: 'starter', unit: null, period_start: new Date().toISOString(), completed_at: null, ...over,
  });
  const out: any[] = [];
  const workoutDone = w.sessions >= 1;
  const waterDone = w.waterMl >= 2000;
  out.push(mk({ id: 'q-work', slug: 'starter_daily_workout', scope: 'daily', title: 'Terminer une séance', icon: 'barbell', metric: 'workout_sessions', target: 1, unit: 'séance', reward_coins: 25, expires_at: EXPIRES, status: workoutDone ? 'completed' : 'active', progress: Math.min(1, w.sessions) }));
  out.push(mk({ id: 'q-water', slug: 'starter_daily_water', scope: 'daily', title: "Boire 2 litres d'eau", icon: 'water', metric: 'hydration_ml', target: 2000, unit: 'ml', reward_coins: 15, expires_at: EXPIRES, status: waterDone ? 'completed' : 'active', progress: w.waterMl }));
  out.push(mk({ id: 'q-week', slug: 'starter_weekly_train', scope: 'weekly', title: "S'entraîner 3 fois", icon: 'trophy', metric: 'workout_sessions', target: 3, unit: 'séance', reward_coins: 60, expires_at: WEEK_END, status: w.weeklyDone ? 'completed' : 'active', progress: w.weeklyDone ? 3 : w.sessions }));
  if (w.expired) out.push(mk({ id: 'q-old', slug: 'ai-1', source: 'ai', scope: 'weekly', title: 'Marcher 5 fois', icon: 'walk', metric: 'habit_logs', target: 5, expires_at: '2026-11-01T00:00:00Z', status: 'expired', progress: 2, reward_coins: 30 }));
  return out;
}

function fakeSupabase(w: World) {
  const rpc = async (fn: string) => {
    if (w.failNetwork) return { data: null, error: { message: 'Network request failed' } };
    switch (fn) {
      case 'ziko_ensure_gamification_profile':
        return { data: { user_id: 'u1', xp: 100, level: 1, coins: w.coins, current_streak: 1, longest_streak: 1, last_activity_date: null, equipped_title: 'Débutant', equipped_badge: null, equipped_banner_name: null, equipped_theme: null }, error: null };
      case 'ziko_check_and_award_badges':
        return { data: [], error: null };
      case 'ziko_get_badge_progress':
        return { data: { counters: {}, badges: [] }, error: null };
      case 'ziko_sync_quests': {
        w.syncCalls++;
        if (w.noQuests) return { data: { quests: [], newly_completed: [] }, error: null };
        const list = quests(w);
        const done: any[] = [];
        for (const q of list) {
          if (q.status === 'completed' && !w.rewarded.has(q.id) && q.id !== 'q-week') {
            w.rewarded.add(q.id);
            w.coins += q.reward_coins;
            done.push({ id: q.id, title: q.title, coins: q.reward_coins });
          }
        }
        return { data: { quests: list, newly_completed: done }, error: null };
      }
      default:
        return { data: null, error: null };
    }
  };
  const tables: Record<string, () => any> = {
    ziko_level_definitions: () => [{ level: 1, xp_required: 0, title: 'Débutant', reward_coins: 0 }, { level: 2, xp_required: 500, title: 'Athlète', reward_coins: 0 }],
    ziko_badge_definitions: () => [],
    ziko_user_badges: () => [],
    ziko_coin_transactions: () => [],
    ziko_user_profiles: () => ({ name: 'Anatholy' }),
  };
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc,
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, order: () => chain, range: () => chain, limit: () => chain,
        maybeSingle: async () => ({ data: tables[table]?.() ?? null, error: null }),
        then: (ok: any, bad: any) => Promise.resolve({ data: tables[table]?.() ?? [], error: null }).then(ok, bad),
      };
      return chain;
    },
  };
}

const world = (over: Partial<World> = {}): World => ({
  coins: 340, waterMl: 1300, sessions: 0, weeklyDone: true, expired: false, noQuests: false, failNetwork: false,
  rewarded: new Set(['q-week']), syncCalls: 0, ...over,
});

async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 8)); });
}

async function mount(w: World, props: Record<string, unknown> = { initialTab: 'Quêtes' }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(container);
  const supabase = fakeSupabase(w);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <GamificationPlugin supabase={supabase} {...props} />
      </QueryClientProvider>,
    );
  });
  await settle();
  if (w.failNetwork) await act(async () => { await new Promise((r) => setTimeout(r, 700)); });
  await settle();
  return { container, root };
}

const buttons = (c: HTMLElement) => [...c.querySelectorAll('button')] as HTMLElement[];
async function click(c: HTMLElement, t: string) {
  const b = buttons(c).find((x) => x.textContent?.trim() === t || x.textContent?.includes(t));
  if (!b) throw new Error(`button not found: ${t}`);
  await act(async () => { b.click(); });
  await settle();
}

describe('Quetes en base (B12)', () => {
  it('QUEST-01: reads the quests from the database, sections + measured progress (maquette B12)', async () => {
    const w = world();
    const { container } = await mount(w);
    const t = container.textContent ?? '';
    expect(w.syncCalls).toBeGreaterThanOrEqual(1);
    expect(t).toContain("Aujourd'hui · se renouvelle dans 6 h");
    expect(t).toContain('Cette semaine');
    expect(t).toContain('Terminer une séance');
    expect(t).toContain("Boire 2 litres d'eau");
    expect(t).toContain('1,3 / 2 L');
    expect(t).toContain("S'entraîner 3 fois");
    expect(t).toContain('Terminé · +60 pièces récupérées');
    expect(t).toContain('25');
    expect(t).toContain('15');
    expect(t).not.toContain('Pas de quête active');
    expect(t).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u); // aucun emoji
  });

  it('QUEST-01: the progress moves when the user does the real action (water logged), on return to the tab', async () => {
    const w = world();
    const { container } = await mount(w);
    expect(container.textContent).toContain('1,3 / 2 L');
    expect(container.textContent).toContain('340');
    // l'utilisateur boit 700 ml (le monde = la base), quitte puis revient sur l'onglet
    w.waterMl = 2000;
    await click(container, 'Niveau');
    await click(container, 'Quêtes');
    const t = container.textContent ?? '';
    expect(t).not.toContain('1,3 / 2 L');
    expect(t).toContain('Terminé · +15 pièces récupérées');
    expect(t).toContain('Quête terminée : Boire 2 litres d\'eau (+15 pièces)');
    expect(t).toContain('355'); // le solde permanent suit
  });

  it('a finished session completes the daily workout quest and credits it once', async () => {
    const w = world({ sessions: 1 });
    const { container } = await mount(w);
    expect(container.textContent).toContain('Terminé · +25 pièces récupérées');
    expect(w.coins).toBe(340 + 25);
    await click(container, 'Niveau');
    await click(container, 'Quêtes');
    expect(w.coins).toBe(340 + 25); // pas de double credit
  });

  it('B13: honest empty state when no quest exists, none of the former static quests', async () => {
    const { container } = await mount(world({ noQuests: true }));
    expect(container.textContent).toContain('Pas de quête active');
    expect(container.textContent).toContain('De nouvelles quêtes arrivent chaque jour. Reviens demain.');
    for (const gone of ['Battre un PR cette semaine', '5 séances en 7 jours', '3 jours hydratation parfaite', 'Squat à 145kg']) {
      expect(container.textContent).not.toContain(gone);
    }
  });

  it('REWD-10: network failure = error card (B05) with retry, zero fabricated quest', async () => {
    const w = world({ failNetwork: true });
    const { container } = await mount(w);
    const t = container.textContent ?? '';
    expect(t).toContain('Quêtes indisponibles');
    for (const name of ['Terminer une séance', "Boire 2 litres d'eau", "S'entraîner 3 fois", 'Pas de quête active']) expect(t).not.toContain(name);
    w.failNetwork = false;
    await click(container, 'Réessayer');
    expect(container.textContent).toContain("Boire 2 litres d'eau");
  });

  it('v1.18 non-punitive: an expired quest is shown neutral, outside the active sections, no penalty wording', async () => {
    const { container } = await mount(world({ expired: true }));
    const t = container.textContent ?? '';
    expect(t).toContain('Non terminées');
    expect(t).toContain('Marcher 5 fois');
    expect(t).toContain('Non terminée · aucune pénalité');
    for (const bad of ['échec', 'Échec', 'perdu', 'raté', 'pénalité de', '-30']) expect(t).not.toContain(bad);
    // l'echue n'est pas dans la section "Cette semaine" des actives
    expect(t.indexOf('Marcher 5 fois')).toBeGreaterThan(t.indexOf("S'entraîner 3 fois"));
  });
});
