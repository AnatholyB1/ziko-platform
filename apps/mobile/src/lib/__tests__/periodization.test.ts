/**
 * Phase 24 (v1.20) - logique pure de la suite de programmes et de la relance (ATEL-07/08/09) + client HTTP (fetch factice).
 * Prouve : textes de bilan NEUTRES (aucun vocabulaire d'echec, y compris a 0 seance), etats du bandeau,
 * la proposition automatique n'est declenchee que pour une relance `pending`, le client n'appelle que les routes
 * attendues avec le jeton, sans jamais toucher aux credits.
 * Ne prouve PAS le rendu des ecrans (jamais affiches sur emulateur ici) ni le serveur reel.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  PERIOD_COPY,
  HINT_LABEL,
  STATUS_LABEL,
  bannerState,
  itemSubtitle,
  lastDone,
  resultsLines,
  shouldPropose,
  type ProgramResults,
  type RelaunchView,
  type SequenceItem,
} from '../periodization';
import { createPeriodizationClient, PeriodizationHttpError } from '../periodizationService';

const results = (over: Partial<ProgramResults> = {}): ProgramResults => ({
  version: 1,
  window: { from: '2026-11-01T00:00:00Z', to: '2026-11-29T00:00:00Z' },
  sessions_done: 7,
  sessions_planned: 8,
  adherence_pct: 88,
  total_volume_kg: 41250,
  lifts: [{ exercise: 'Squat', start_e1rm_kg: 150, end_e1rm_kg: 158.5, delta_kg: 8.5, delta_pct: 5.7 }],
  records: [],
  hint: 'progress',
  ...over,
});
const relaunch = (over: Partial<RelaunchView> = {}): RelaunchView => ({
  id: 'r1', status: 'pending', draft_id: 'd1', program_id: 'p1', program_name: 'Bloc 1', sequence_id: 's1', results: results(), ...over,
});
const item = (over: Partial<SequenceItem>): SequenceItem => ({
  id: 'x', position: 1, name: 'X', goal: null, status: 'planned', weeks: null, started_at: null, completed_at: null, results: null, ...over,
});

const FORBIDDEN = /échec|echec|raté|rate\b|manqu|retard|pénal|penal|mauvais|insuffisant|paresse/i;

describe('resultsLines (bilan neutre)', () => {
  it('seances, volume, evolution du 1RM estime et direction de la suite', () => {
    const l = resultsLines(results());
    expect(l[0]).toBe('7 séances sur 8 prévues');
    expect(l[1]).toContain('41');
    expect(l).toContain('Squat : 150 → 158,5 kg estimés (+8,5 kg)');
    expect(l[l.length - 1]).toBe(HINT_LABEL.progress);
  });
  it('aucune seance : message doux, sans vocabulaire d\'echec', () => {
    const l = resultsLines(results({ sessions_done: 0, adherence_pct: 0, lifts: [], hint: 'reentry' }));
    expect(l).toEqual([PERIOD_COPY.noSessions]);
  });
  it('adherence faible : conseil de reprise, jamais de reproche', () => {
    const all = [
      ...resultsLines(results({ sessions_done: 1, adherence_pct: 12, hint: 'reentry', lifts: [] })),
      ...Object.values(HINT_LABEL),
      ...Object.values(PERIOD_COPY),
      ...Object.values(STATUS_LABEL),
    ].join(' | ');
    expect(all).not.toMatch(FORBIDDEN);
  });
  it('baisse du 1RM estime : delta affiche tel quel, sans jugement', () => {
    const l = resultsLines(results({ lifts: [{ exercise: 'Squat', start_e1rm_kg: 150, end_e1rm_kg: 147, delta_kg: -3, delta_pct: -2 }] }));
    expect(l.join(' ')).toContain('(-3 kg)');
    expect(l.join(' ')).not.toMatch(FORBIDDEN);
  });
});

describe('bandeau et declenchement', () => {
  it('etats du bandeau', () => {
    expect(bannerState(null, false)).toBe('hidden');
    expect(bannerState(relaunch({ status: 'dismissed' }), false)).toBe('hidden');
    expect(bannerState(relaunch(), false)).toBe('prepare');
    expect(bannerState(relaunch(), true)).toBe('preparing');
    expect(bannerState(relaunch({ status: 'proposing' }), false)).toBe('preparing');
    expect(bannerState(relaunch({ status: 'proposed' }), false)).toBe('ready');
  });
  it('la proposition automatique ne part que pour une relance pending avec brouillon', () => {
    expect(shouldPropose(relaunch())).toBe(true);
    expect(shouldPropose(relaunch({ status: 'proposed' }))).toBe(false);
    expect(shouldPropose(relaunch({ status: 'proposing' }))).toBe(false);
    expect(shouldPropose(relaunch({ status: 'dismissed' }))).toBe(false);
    expect(shouldPropose(relaunch({ draft_id: null }))).toBe(false);
    expect(shouldPropose(null)).toBe(false);
  });
});

describe('suite', () => {
  it('sous-titre et dernier programme termine', () => {
    expect(itemSubtitle(item({ weeks: 8, goal: 'force' }))).toBe('8 semaines · force');
    expect(itemSubtitle(item({ weeks: 1 }))).toBe('1 semaine');
    expect(itemSubtitle(item({}))).toBe('');
    const items = [item({ id: 'a', status: 'done' }), item({ id: 'b', status: 'done' }), item({ id: 'c', status: 'active' })];
    expect(lastDone(items)?.id).toBe('b');
    expect(lastDone([item({ status: 'planned' })])).toBeNull();
  });
});

describe('client HTTP', () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as any;
  it('check / propose / dismiss / getSequence : bonnes routes, jeton, aucune route de credits', async () => {
    const f = vi.fn(async () => ok({ relaunch: null, closed_program_id: null, has_sequence: false }));
    const c = createPeriodizationClient({ apiUrl: 'http://api', getToken: async () => 'tok', fetchImpl: f as any });
    await c.check();
    await c.propose('r1');
    await c.dismiss('r1');
    await c.getSequence();
    const calls = f.mock.calls.map((a: any[]) => `${a[1].method} ${a[0]}`);
    expect(calls).toEqual([
      'POST http://api/ai/workshop/relaunch/check',
      'POST http://api/ai/workshop/relaunch/r1/propose',
      'POST http://api/ai/workshop/relaunch/r1/dismiss',
      'GET http://api/ai/workshop/sequence',
    ]);
    expect((f.mock.calls[0] as any[])[1].headers.Authorization).toBe('Bearer tok');
    expect(calls.join(' ')).not.toMatch(/credit|stream/);
  });
  it('sans jeton : 401 sans requete ; erreur serveur : PeriodizationHttpError(status)', async () => {
    const f = vi.fn();
    const noTok = createPeriodizationClient({ apiUrl: 'http://api', getToken: async () => null, fetchImpl: f as any });
    await expect(noTok.check()).rejects.toMatchObject({ status: 401 });
    expect(f).not.toHaveBeenCalled();
    const bad = createPeriodizationClient({
      apiUrl: 'http://api',
      getToken: async () => 'tok',
      fetchImpl: (async () => ({ ok: false, status: 409, json: async () => ({ error: 'dismissed' }) })) as any,
    });
    const err = await bad.propose('r1').catch((e) => e);
    expect(err).toBeInstanceOf(PeriodizationHttpError);
    expect(err.status).toBe(409);
  });
});
