import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Bloc « Quetes du jour » de l'accueil (v1.21 phase 1). Faux Supabase a etat : `ziko_sync_quests` se comporte comme la
// fonction SQL pour ce qui concerne l'application (creation idempotente des quetes de depart, mesure sur le "monde",
// credit unique). Ces tests prouvent le CABLAGE du bloc (etats, rafraichissement, navigation), pas le SQL.
const h = vi.hoisted(() => ({
  level: 1,
  haptics: [] as string[],
  announced: [] as string[],
}));

vi.mock('expo-haptics', () => ({
  notificationAsync: async (t: string) => { h.haptics.push(t); },
  NotificationFeedbackType: { Success: 'success' },
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: any) => unknown) => sel({ user: { id: 'u1' }, effectiveLevel: h.level, levelLoaded: true }),
}));

interface World {
  waterMl: number; meals: number; sessions: number;
  rows: Map<string, any>; // cle = slug|period (contrainte unique)
  syncCalls: number; fail: boolean; empty: boolean; expiredExtra: boolean; rewarded: Set<string>;
}
const PERIOD = '2026-11-20T00:00:00Z';
const TEMPLATES = [
  { slug: 'starter_daily_water', title: "Boire 2 litres d'eau", icon: 'water', metric: 'hydration_ml', target: 2000, unit: 'ml', reward_coins: 15 },
  { slug: 'starter_daily_meal', title: 'Ajoute un repas', icon: 'restaurant', metric: 'nutrition_logs', target: 1, unit: 'repas', reward_coins: 15 },
  { slug: 'starter_daily_workout', title: 'Terminer une séance', icon: 'barbell', metric: 'workout_sessions', target: 1, unit: 'séance', reward_coins: 25 },
];

function world(over: Partial<World> = {}): World {
  return { waterMl: 0, meals: 0, sessions: 0, rows: new Map(), syncCalls: 0, fail: false, empty: false, expiredExtra: false, rewarded: new Set(), ...over };
}

function measure(w: World, metric: string) {
  return metric === 'hydration_ml' ? w.waterMl : metric === 'nutrition_logs' ? w.meals : w.sessions;
}

function sync(w: World) {
  w.syncCalls++;
  const done: any[] = [];
  if (!w.empty) {
    for (const t of TEMPLATES) {
      const key = `${t.slug}|${PERIOD}`;
      if (!w.rows.has(key)) {
        w.rows.set(key, { id: `id-${t.slug}`, slug: t.slug, source: 'starter', scope: 'daily', description: null, period_start: PERIOD, expires_at: '2026-11-21T00:00:00Z', status: 'active', progress: 0, completed_at: null, ...t }); // ON CONFLICT DO NOTHING
      }
    }
  }
  for (const r of w.rows.values()) {
    if (r.status !== 'active') continue;
    const v = measure(w, r.metric);
    r.progress = v;
    if (v >= r.target && !w.rewarded.has(r.id)) {
      w.rewarded.add(r.id);
      r.status = 'completed';
      done.push({ id: r.id, title: r.title, coins: r.reward_coins });
    }
  }
  const quests = [...w.rows.values()];
  if (w.expiredExtra) quests.push({ id: 'old', slug: 'ai-old', source: 'ai', scope: 'weekly', title: 'Marcher 5 fois', description: null, icon: 'walk', metric: 'habit_logs', target: 5, unit: null, reward_coins: 30, period_start: PERIOD, expires_at: PERIOD, status: 'expired', progress: 2, completed_at: null });
  return { quests, newly_completed: done };
}

function fakeSupabase(w: World) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: async (fn: string) => {
      if (fn !== 'ziko_sync_quests') return { data: null, error: null };
      if (w.fail) return { data: null, error: { message: 'Network request failed' } };
      return { data: sync(w), error: null };
    },
  };
}

let currentWorld: World = world();
vi.mock('../../lib/supabase', () => ({ supabase: new Proxy({}, { get: (_t, k) => (fakeSupabase(currentWorld) as any)[k] }) }));

import { QuestsBlock } from '../../components/home/QuestsBlock';
import { router, routerCalls } from './stubs/expo-router';
import { AccessibilityInfo, emitAppState } from './stubs/react-native';
import { setQuestRefreshHandler } from '@ziko/plugin-sdk';

async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 8)); });
}

// Demonte tous les arbres a la fin de chaque test (minuteurs du toast / du bouton Reessayer nettoyes).
const mountedRoots: Root[] = [];
afterEach(async () => {
  const roots = mountedRoots.splice(0);
  await act(async () => { roots.forEach((r) => r.unmount()); });
});

async function mount(w: World, level = 1, creatingRetryMs = 15) {
  currentWorld = w;
  h.level = level;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(container);
  mountedRoots.push(root);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <QuestsBlock creatingRetryMs={creatingRetryMs} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return { container, qc, root, text: () => container.textContent ?? '' };
}

const buttons = (c: HTMLElement) => [...c.querySelectorAll('button')] as HTMLElement[];

beforeEach(() => {
  h.haptics.length = 0;
  h.announced.length = 0;
  routerCalls.length = 0;
  (AccessibilityInfo as any).announceForAccessibility = (m: string) => { h.announced.push(m); };
});

describe('QNEW-01/03/04: a brand-new account sees its 3 welcome quests', () => {
  it('syncs on open, creates the starters, renders title + action + button, hydration first, header "3 en cours"', async () => {
    const w = world();
    const { text, container } = await mount(w);
    expect(w.syncCalls).toBeGreaterThanOrEqual(1);
    const t = text();
    expect(t).toContain('Quêtes du jour');
    expect(t).toContain('3 en cours');
    const order = ["Bois 2 litres d'eau", 'Ajoute un repas', 'Termine une séance'].map((s) => t.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(t).toContain('Ajoute chaque verre dans Hydratation.');
    expect(t).toContain('Note ton premier repas dans Nutrition.');
    expect(t).toContain("Lance une séance depuis l'onglet Séance.");
    expect(t).toContain('0 / 2 L');
    for (const verb of ['Boire', 'Ajouter', 'Séance']) expect(t).toContain(verb);
    expect(container.querySelectorAll('[data-role="progressbar"]').length).toBe(3);
  });

  it('QNEW-05 / D-04: no "Voir tout" / "Tout voir" link and no Rewards destination', async () => {
    const { text, container } = await mount(world());
    expect(text()).not.toMatch(/voir tout|tout voir/i);
    const rows = buttons(container);
    for (const r of rows) r.click();
    await settle();
    expect(routerCalls.every((c) => !String(c.args[0]).includes('gamification'))).toBe(true);
  });

  it('D-05: no coins and no coin chip at level 1 ; shown at level 3', async () => {
    const l1 = await mount(world(), 1);
    expect(l1.container.querySelector('[data-icon="disc"]')).toBeNull();
    expect(l1.text()).not.toMatch(/pièces/);
    const l3 = await mount(world(), 3);
    expect(l3.container.querySelectorAll('[data-icon="disc"]').length).toBe(3);
  });

  it('QNEW-04: one tap on a row goes straight to the quest screen (never via Rewards)', async () => {
    const { container } = await mount(world());
    const rows = buttons(container);
    expect(rows).toHaveLength(3);
    for (const r of rows) await act(async () => { r.click(); });
    expect(routerCalls.map((c) => [c.method, c.args[0]])).toEqual([
      ['push', '/(plugins)/hydration/dashboard'],
      ['push', '/(plugins)/nutrition/log'],
      ['push', '/(app)/workout'],
    ]);
    expect(router).toBeDefined();
  });

  it('accessibility labels: row = title, counter, action ; section header role', async () => {
    const { container } = await mount(world());
    const labels = buttons(container).map((b) => b.getAttribute('aria-label'));
    expect(labels[0]).toBe("Bois 2 litres d'eau. 0 / 2 L. Boire de l'eau, ouvrir Hydratation");
    expect(labels[1]).toBe('Ajoute un repas. En cours. Ajouter un repas, ouvrir Nutrition');
    expect(container.querySelector('[data-role="header"]')?.textContent).toBe('Quêtes du jour');
  });
});

describe('QNEW-02: idempotence', () => {
  it('syncing again (reopen, focus, refresh) never duplicates a quest', async () => {
    const w = world();
    const { qc, container, text } = await mount(w);
    await act(async () => { await qc.invalidateQueries({ queryKey: ['rewards-quests'] }); });
    await settle();
    await act(async () => { await qc.invalidateQueries({ queryKey: ['rewards-quests'] }); });
    await settle();
    expect(w.syncCalls).toBeGreaterThanOrEqual(3);
    expect(w.rows.size).toBe(3);
    expect(text().match(/Bois 2 litres d'eau/g)).toHaveLength(1);
    expect(buttons(container)).toHaveLength(3);
  });
});

describe('QNEW-06: completion appears without relaunching the app', () => {
  it('after the action is logged and the refresh handler invalidates, the row turns "Terminé", toast + haptic + announcement, no relaunch', async () => {
    const w = world();
    const { qc, text, container } = await mount(w);
    expect(text()).toContain('3 en cours');
    w.waterMl = 2000; // l'utilisateur a bu 2 L (le monde = la base)
    await act(async () => { await qc.invalidateQueries({ queryKey: ['rewards-quests'] }); }); // ce que fait requestQuestRefresh apres le debounce
    await settle();
    const t = text();
    expect(t).toContain('Terminé');
    expect(t).toContain('2 en cours');
    expect(t).toContain("Quête terminée : Bois 2 litres d'eau");
    expect(t).not.toContain('(+15 pièces)'); // niveau 1 : pas de pieces
    expect(h.haptics).toEqual(['success']);
    expect(h.announced).toEqual(["Quête terminée : Bois 2 litres d'eau"]);
    expect(container.querySelector('[data-icon="checkmark-circle"]')).not.toBeNull();
    // la ligne terminee reste en place (pas de saut) : eau toujours premiere
    expect(t.indexOf("Bois 2 litres d'eau")).toBeLessThan(t.indexOf('Ajoute un repas'));
    // une relecture suivante n'annonce pas deux fois
    await act(async () => { await qc.invalidateQueries({ queryKey: ['rewards-quests'] }); });
    await settle();
    expect(h.haptics).toEqual(['success']);
  });

  it('level 3: the toast mentions the coins', async () => {
    const w = world();
    const { qc, text } = await mount(w, 3);
    w.meals = 1;
    await act(async () => { await qc.invalidateQueries({ queryKey: ['rewards-quests'] }); });
    await settle();
    expect(text()).toContain('Quête terminée : Ajoute un repas (+15 pièces)');
    expect(text()).toContain('Terminé · +15 pièces récupérées');
  });

  it('D-07: all done -> "Bravo, tout est fait" card, "3 sur 3", no CTA left', async () => {
    const w = world({ waterMl: 2000, meals: 1, sessions: 1 });
    const { text, container } = await mount(w);
    const t = text();
    expect(t).toContain('Bravo, tout est fait');
    expect(t).toContain('De nouvelles quêtes arrivent bientôt.');
    expect(t).toContain('3 sur 3');
    expect(buttons(container)).toHaveLength(0);
    expect(h.haptics.length).toBe(1); // les 3 quetes viennent d'etre creditees par cette synchro : une seule annonce groupee
  });
});

describe('QNEW-07 / D-08: nothing failed or expired', () => {
  it('an expired quest from the server is never rendered', async () => {
    const { text } = await mount(world({ expiredExtra: true }));
    expect(text()).not.toContain('Marcher 5 fois');
    expect(text()).not.toMatch(/expir|échou|manqu|Non terminée/i);
  });
});

describe('failure path and creating state (contract 5, states 6-7)', () => {
  it('RPC error -> "Quêtes indisponibles" alert card with retry, no fabricated quest ; retry recovers', async () => {
    const w = world({ fail: true });
    const { text, container } = await mount(w);
    await act(async () => { await new Promise((r) => setTimeout(r, 700)); }); // 1 nouvel essai apres 500 ms
    await settle();
    expect(text()).toContain('Quêtes indisponibles');
    expect(text()).toContain('Impossible de charger tes quêtes. Vérifie ta connexion puis réessaie.');
    expect(container.querySelector('[data-role="alert"]')).not.toBeNull();
    expect(text()).not.toContain("Bois 2 litres d'eau");
    w.fail = false;
    const retry = buttons(container).find((b) => b.textContent?.includes('Réessayer'))!;
    await act(async () => { retry.click(); });
    await settle();
    expect(text()).toContain("Bois 2 litres d'eau");
    expect(text()).not.toContain('Quêtes indisponibles');
  });

  it('0 quest read -> "Tes quêtes se préparent", retry button only after the delay', async () => {
    const w = world({ empty: true });
    const { text, container } = await mount(w, 1, 400);
    expect(text()).toContain('Tes quêtes se préparent');
    expect(text()).toContain("Elles s'affichent ici dans un instant.");
    expect(buttons(container).some((b) => b.textContent?.includes('Réessayer'))).toBe(false);
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    expect(buttons(container).some((b) => b.textContent?.includes('Réessayer'))).toBe(true);
    w.empty = false;
    await act(async () => { buttons(container).find((b) => b.textContent?.includes('Réessayer'))!.click(); });
    await settle();
    expect(text()).toContain("Bois 2 litres d'eau");
  });

  it('no emoji anywhere in the rendered block', async () => {
    const { text } = await mount(world({ waterMl: 2000 }), 3);
    expect(text()).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('D-07 / M3: refresh when the app returns to the foreground', () => {
  afterEach(() => setQuestRefreshHandler(null));

  it('AppState "active" asks for a quest refresh ; "background" / "inactive" do not', async () => {
    let calls = 0;
    setQuestRefreshHandler(() => { calls++; });
    await mount(world());
    emitAppState('background');
    emitAppState('inactive');
    expect(calls).toBe(0);
    emitAppState('active');
    expect(calls).toBe(1);
  });

  it('yesterday\'s "Bravo" is replaced by today\'s quests after foreground (new day = new period)', async () => {
    const w = world({ waterMl: 2000, meals: 1, sessions: 1 });
    const { qc, text } = await mount(w);
    expect(text()).toContain('Bravo, tout est fait');
    // lendemain : la base a de nouvelles quetes (autre periode), rien de fait
    w.rows.clear(); w.rewarded.clear(); w.waterMl = 0; w.meals = 0; w.sessions = 0;
    setQuestRefreshHandler(() => { void qc.invalidateQueries({ queryKey: ['rewards-quests'] }); }); // ce que fait le vrai gestionnaire apres le debounce
    await act(async () => { emitAppState('active'); });
    await settle();
    expect(text()).not.toContain('Bravo, tout est fait');
    expect(text()).toContain('3 en cours');
  });

  it('unsubscribes from AppState on unmount', async () => {
    let calls = 0;
    setQuestRefreshHandler(() => { calls++; });
    const { root } = await mount(world());
    await act(async () => { root.unmount(); });
    emitAppState('active');
    expect(calls).toBe(0);
  });
});
