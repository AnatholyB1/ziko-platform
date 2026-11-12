/**
 * Phase 14 (v1.20) - QUEST-05/06/07 : regles pures des quetes IA.
 * Prouve : liste blanche de metriques, plages (cible, duree limite toujours presente, pieces), une quete par
 * (metrique, portee), icone jamais emoji, libelle neutre des quetes echues.
 * Ne prouve PAS le plafond de 3 en base (voir scripts/uat/p14-quests-sql) ni le comportement du vrai modele.
 */
import { describe, it, expect } from 'vitest';
import {
  DURATION_HOURS,
  EXPIRED_LABEL,
  MAX_ACTIVE_QUESTS,
  REWARD_COINS,
  describeQuest,
  normalizeProposal,
  normalizeProposals,
  parseClaim,
  sanitizeIcon,
} from './rules.js';

const ok = { title: 'Boire plus', metric: 'hydration_ml', target: 2500, scope: 'daily', duration_hours: 24, reward_coins: 15 };

describe('normalizeProposal', () => {
  it('accepte une proposition valide', () => {
    const p = normalizeProposal(ok)!;
    expect(p).toMatchObject({ metric: 'hydration_ml', target: 2500, scope: 'daily', duration_hours: 24, reward_coins: 15, unit: 'ml' });
  });
  it('rejette une metrique hors liste blanche, un titre vide, une cible nulle ou non numerique', () => {
    expect(normalizeProposal({ ...ok, metric: 'steps' })).toBeNull();
    expect(normalizeProposal({ ...ok, title: '  ' })).toBeNull();
    expect(normalizeProposal({ ...ok, target: 0 })).toBeNull();
    expect(normalizeProposal({ ...ok, target: 'beaucoup' })).toBeNull();
    expect(normalizeProposal(null)).toBeNull();
  });
  it('recadre cible, duree et pieces dans les plages', () => {
    const p = normalizeProposal({ ...ok, target: 99999, duration_hours: 9999, reward_coins: 9999 })!;
    expect(p.target).toBe(4000);
    expect(p.duration_hours).toBe(DURATION_HOURS.daily.max);
    expect(p.reward_coins).toBe(REWARD_COINS.daily.max);
    const q = normalizeProposal({ ...ok, metric: 'workout_sessions', scope: 'weekly', target: 40, duration_hours: 1, reward_coins: -5 })!;
    expect(q.target).toBe(6);
    expect(q.duration_hours).toBe(DURATION_HOURS.weekly.min);
    expect(q.reward_coins).toBe(REWARD_COINS.weekly.min);
  });
  it('toute quete a une duree limite (defaut selon la portee si absente)', () => {
    const { duration_hours: _d, ...noDuration } = ok;
    expect(normalizeProposal(noDuration)!.duration_hours).toBe(DURATION_HOURS.daily.default);
    expect(normalizeProposal({ ...noDuration, scope: 'weekly' })!.duration_hours).toBe(DURATION_HOURS.weekly.default);
  });
  it("l'eau est arrondie a 50 ml, les autres cibles sont entieres", () => {
    expect(normalizeProposal({ ...ok, target: 1234 })!.target).toBe(1250);
    expect(normalizeProposal({ ...ok, metric: 'nutrition_logs', target: 2.6 })!.target).toBe(3);
  });
  it('portee inconnue => weekly ; ai_meta propage', () => {
    expect(normalizeProposal({ ...ok, scope: 'monthly' })!.scope).toBe('weekly');
    expect(normalizeProposal(ok, { trigger: 'level_up' })!.ai_meta).toEqual({ trigger: 'level_up' });
  });
});

describe('sanitizeIcon', () => {
  it('garde un nom Ionicons, remplace emoji / espaces / majuscules par flag', () => {
    expect(sanitizeIcon('water')).toBe('water');
    expect(sanitizeIcon('barbell-outline')).toBe('barbell-outline');
    for (const bad of ['💧', 'Water', 'a b', '', undefined, 42, 'x'.repeat(41)]) expect(sanitizeIcon(bad)).toBe('flag');
  });
});

describe('normalizeProposals', () => {
  it('limite au nombre de places et ignore les invalides', () => {
    const raw = [
      ok,
      { ...ok, metric: 'steps' },
      { ...ok, metric: 'workout_sessions', target: 3, scope: 'weekly' },
      { ...ok, metric: 'habit_logs', target: 4 },
      { ...ok, metric: 'nutrition_logs', target: 3 },
    ];
    const out = normalizeProposals(raw, 2);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.metric)).toEqual(['hydration_ml', 'workout_sessions']);
  });
  it('une seule quete par (metrique, portee)', () => {
    const out = normalizeProposals([ok, { ...ok, title: 'Autre eau' }, { ...ok, scope: 'weekly' }], MAX_ACTIVE_QUESTS);
    expect(out.map((p) => `${p.metric}:${p.scope}`)).toEqual(['hydration_ml:daily', 'hydration_ml:weekly']);
  });
  it('0 place ou entree non tableau => liste vide', () => {
    expect(normalizeProposals([ok], 0)).toEqual([]);
    expect(normalizeProposals('x' as unknown, 3)).toEqual([]);
  });
});

describe('describeQuest (QUEST-07, non punitif v1.18)', () => {
  const now = new Date('2026-11-12T10:00:00Z');
  const base = { title: 'T', scope: 'daily', metric: 'habit_logs', target: 3, progress: 1, unit: 'habitudes', reward_coins: 10 };
  it('active : heures restantes', () => {
    const d = describeQuest({ ...base, status: 'active', expires_at: '2026-11-12T16:00:00Z' }, now);
    expect(d).toMatchObject({ status: 'active', hours_left: 6, progress: '1/3 habitudes' });
  });
  it('echue (statut expired OU active deja echue) : libelle neutre, aucune penalite, aucun mot punitif', () => {
    for (const status of ['expired', 'active'] as const) {
      const d = describeQuest({ ...base, status, expires_at: '2026-11-11T00:00:00Z' }, now);
      expect(d).toMatchObject({ status: 'not_completed', label: EXPIRED_LABEL, penalty: 'none' });
      expect(JSON.stringify(d)).not.toMatch(/échou|echou|perdu|failed|fail/i);
    }
  });
  it('terminee', () => {
    expect(describeQuest({ ...base, status: 'completed', expires_at: '2026-11-13T00:00:00Z' }, now)).toMatchObject({ status: 'completed' });
  });
});

describe('parseClaim', () => {
  it('lit la reponse SQL, refuse une forme invalide', () => {
    expect(parseClaim({ proceed: true, reason: 'level_up', slots: 2, level: 4, active: 1 })).toEqual({ proceed: true, reason: 'level_up', slots: 2, level: 4, active: 1 });
    expect(parseClaim(null)).toBeNull();
    expect(parseClaim({ reason: 'x' })).toBeNull();
  });
});
