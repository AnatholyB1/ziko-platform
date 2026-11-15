/**
 * Revue A #2/#3 : l'accueil doit etre invalide apres seance / eau avec les VRAIES cles des requetes.
 * On verifie contre un vrai QueryClient : une requete montee sur ['hydration','today',userId] est bien
 * refetchee par invalidateHomeQueries, alors que l'ancienne cle ['hydration','goal',userId] ne l'etait pas.
 */
import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { HOME_QUERY_KEYS, invalidateHomeQueries } from '../homeQueries';

describe('HOME_QUERY_KEYS', () => {
  it('couvre toutes les cles de useHomeData (meme prefixe)', () => {
    const flat = HOME_QUERY_KEYS.map((k) => k.join('/'));
    for (const k of ['workouts/weekly', 'workouts/recent', 'hydration/today', 'nutrition/today', 'program/active', 'streak', 'sleep', 'nutrition/goal']) {
      expect(flat).toContain(k);
    }
  });
});

describe('invalidateHomeQueries', () => {
  it('marque obsolete les requetes de l\'accueil (hydration today, workouts, streak) et pas les autres', async () => {
    const qc = new QueryClient();
    for (const key of [['hydration', 'today', 'u1'], ['workouts', 'recent', 'u1'], ['streak', 'gamification', 'u1'], ['profile', 'u1']]) {
      await qc.fetchQuery({ queryKey: key, queryFn: async () => 1 });
    }
    expect(qc.getQueryState(['hydration', 'today', 'u1'])?.isInvalidated).toBe(false);
    await invalidateHomeQueries(qc);
    expect(qc.getQueryState(['hydration', 'today', 'u1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['workouts', 'recent', 'u1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['streak', 'gamification', 'u1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['profile', 'u1'])?.isInvalidated).toBe(false);
  });
  it('l\'ancienne cle fantome [hydration, goal] ne touchait PAS la requete de l\'accueil', async () => {
    const qc = new QueryClient();
    await qc.fetchQuery({ queryKey: ['hydration', 'today', 'u1'], queryFn: async () => 1 });
    await qc.invalidateQueries({ queryKey: ['hydration', 'goal', 'u1'] });
    expect(qc.getQueryState(['hydration', 'today', 'u1'])?.isInvalidated).toBe(false);
    await qc.invalidateQueries({ queryKey: ['hydration', 'today'] });
    expect(qc.getQueryState(['hydration', 'today', 'u1'])?.isInvalidated).toBe(true);
  });
  it('un echec sur une cle ne bloque pas les autres', async () => {
    const seen: string[] = [];
    const qc = {
      invalidateQueries: async ({ queryKey }: { queryKey: readonly string[] }) => {
        seen.push(queryKey.join('/'));
        if (queryKey[0] === 'program') throw new Error('boom');
      },
    };
    await expect(invalidateHomeQueries(qc)).resolves.toBeUndefined();
    expect(seen.length).toBe(HOME_QUERY_KEYS.length);
  });
});
