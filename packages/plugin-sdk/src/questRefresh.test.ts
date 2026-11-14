import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createQuestRefresher, requestQuestRefresh, setQuestRefreshHandler } from './questRefresh';

const fakeTimers = () => {
  let fn: (() => void) | null = null; let n = 0;
  return {
    setTimer: (f: () => void) => { fn = f; n++; return n; },
    clearTimer: () => { fn = null; },
    fire: () => { const f = fn; fn = null; f?.(); },
    armed: () => fn !== null,
  };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createQuestRefresher (debounce + invalidation)', () => {
  it('regroupe 3 ecritures rapprochees en UNE synchro puis invalide', async () => {
    const t = fakeTimers();
    const sync = vi.fn().mockResolvedValue({ quests: [] });
    const invalidate = vi.fn();
    const r = createQuestRefresher({ sync, invalidate, setTimer: t.setTimer, clearTimer: t.clearTimer });
    r.schedule(); r.schedule(); r.schedule();
    expect(sync).not.toHaveBeenCalled();
    expect(r.isPending()).toBe(true);
    t.fire(); await tick();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ quests: [] });
    expect(r.isPending()).toBe(false);
  });

  it('une synchro en echec invalide quand meme (l\'ecran refera la synchro) et ne leve jamais', async () => {
    const t = fakeTimers();
    const invalidate = vi.fn();
    const r = createQuestRefresher({ sync: () => Promise.reject(new Error('offline')), invalidate, setTimer: t.setTimer, clearTimer: t.clearTimer });
    r.schedule(); t.fire(); await tick();
    expect(invalidate).toHaveBeenCalledWith(null);
  });

  it('une ecriture arrivee PENDANT la synchro declenche une seconde synchro (rien n\'est perdu)', async () => {
    const t = fakeTimers();
    let release!: () => void;
    const sync = vi.fn()
      .mockImplementationOnce(() => new Promise((res) => { release = () => res('first'); }))
      .mockResolvedValueOnce('second');
    const invalidate = vi.fn();
    const r = createQuestRefresher({ sync, invalidate, setTimer: t.setTimer, clearTimer: t.clearTimer });
    r.schedule(); t.fire(); await tick();
    expect(sync).toHaveBeenCalledTimes(1);
    r.schedule(); t.fire(); await tick();
    expect(sync).toHaveBeenCalledTimes(1);
    release(); await tick(); await tick();
    expect(sync).toHaveBeenCalledTimes(2);
    expect(invalidate.mock.calls.map((c) => c[0])).toEqual(['first', 'second']);
  });

  it('flush() synchronise tout de suite et annule le minuteur', async () => {
    const t = fakeTimers();
    const sync = vi.fn().mockResolvedValue(1);
    const r = createQuestRefresher({ sync, invalidate: vi.fn(), setTimer: t.setTimer, clearTimer: t.clearTimer });
    r.schedule();
    await r.flush();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(t.armed()).toBe(false);
  });
});

describe('requestQuestRefresh (registre)', () => {
  beforeEach(() => setQuestRefreshHandler(null));
  it('sans gestionnaire : sans effet, sans erreur', () => {
    expect(() => requestQuestRefresh()).not.toThrow();
  });
  it('appelle le gestionnaire enregistre ; un gestionnaire qui leve ne casse pas l\'ecriture', () => {
    const h = vi.fn();
    setQuestRefreshHandler(h);
    requestQuestRefresh();
    expect(h).toHaveBeenCalledTimes(1);
    setQuestRefreshHandler(() => { throw new Error('boom'); });
    expect(() => requestQuestRefresh()).not.toThrow();
  });
});

describe('cablage : chaque ecriture qui alimente une metrique de quete demande un rafraichissement', () => {
  const root = resolve(__dirname, '../../..');
  const src = (p: string) => readFileSync(resolve(root, p), 'utf8');
  it.each([
    ['apps/mobile/app/(app)/index.tsx', 'eau / poids / humeur (Quick Log accueil)'],
    ['packages/plugin-sdk/src/mealLog.ts', 'log repas (saveMeal, utilise par LogMealScreen)'],
    ['plugins/habits/src/screens/HabitsPlugin.tsx', 'habitudes'],
    ['plugins/hydration/src/screens/HydrationPlugin.tsx', 'hydratation (plugin)'],
    ['plugins/measurements/src/screens/MeasurementsPlugin.tsx', 'mesures'],
    ['plugins/measurements/src/screens/MeasurementsLog.tsx', 'mesures (saisie)'],
  ])('%s appelle requestQuestRefresh (%s)', (file) => {
    expect(src(file)).toMatch(/requestQuestRefresh/);
  });
  it('l\'application enregistre le gestionnaire (synchro + invalidation des quetes)', () => {
    const s = src('apps/mobile/src/lib/questRefreshHandler.ts');
    expect(s).toMatch(/setQuestRefreshHandler/);
    expect(s).toMatch(/rewards-quests/);
    expect(s).toMatch(/syncQuestsQuiet/);
  });
});
