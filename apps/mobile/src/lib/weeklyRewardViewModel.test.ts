import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPointsView,
  buildReviewViewModel,
  ctaKey,
  getMotionSpec,
  nextStep,
  stepPills,
  type RewardGrantRow,
  type WeeklyDecisionOutcome,
} from './weeklyRewardViewModel';

const HERE = __dirname;
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');
const I18N = readFileSync(join(HERE, '../../../../packages/plugin-sdk/src/i18n.ts'), 'utf8');
const VIEW_SRC = read('../components/WeeklyReviewRevealView.tsx');
const OVERLAY_SRC = read('../components/WeeklyReviewRevealOverlay.tsx');

const out = (o: Partial<WeeklyDecisionOutcome>): WeeklyDecisionOutcome => ({
  points_outcome: 'met',
  points_earned: 10,
  points_total: 70,
  tier: 2,
  tier_up: false,
  ...o,
});

const grant = (over: Partial<RewardGrantRow> = {}): RewardGrantRow => ({
  tier: 3,
  granted_at: '2026-11-08T10:00:05Z',
  key: 't3_title_regular',
  kind: 'title',
  icon: 'ribbon-outline',
  label_fr: 'Régulier',
  label_en: 'Steady',
  ...over,
});

const DECISION_AT = '2026-11-08T10:00:00Z';

// Fixture states from 45-DESIGN-CONTRACT section 4 (one coherent story, A-16).
const MET = out({});
const EXCEEDED = out({ points_outcome: 'exceeded', points_earned: 15, points_total: 75 });
const MISSED = out({ points_outcome: 'missed', points_earned: 0, points_total: 60 });
const TIER_UP = out({ points_outcome: 'met', points_earned: 10, points_total: 150, tier: 3, tier_up: true });

describe('points view (REWARD-01, A-08, A-16)', () => {
  it('met / exceeded / missed show the contract numbers at Palier 2 of 150', () => {
    const met = buildPointsView(MET, 70)!;
    const exc = buildPointsView(EXCEEDED, 75)!;
    const mis = buildPointsView(MISSED, 60)!;
    expect([met.total, exc.total, mis.total]).toEqual([70, 75, 60]);
    expect([met.tier, exc.tier, mis.tier]).toEqual([2, 2, 2]);
    expect([met.barMax, exc.barMax, mis.barMax]).toEqual([150, 150, 150]);
    expect(met.earned).toBe(10);
    expect(exc.earned).toBe(15);
  });

  it('A-08: missed never moves the bar and never awards points', () => {
    const mis = buildPointsView(MISSED, 60)!;
    expect(mis.earned).toBe(0);
    expect(mis.barFrom).toBe(mis.barTo);
    expect(mis.barTo).toBeCloseTo(60 / 150);
  });

  it('bar never moves backward, even on inconsistent data (D-07)', () => {
    for (const o of [MET, EXCEEDED, MISSED, out({ points_earned: 999, points_total: 20 })]) {
      const v = buildPointsView(o, null)!;
      expect(v.barFrom).toBeLessThanOrEqual(v.barTo);
      expect(v.earned).toBeGreaterThanOrEqual(0);
      expect(v.previousTotal).toBeGreaterThanOrEqual(0);
    }
  });

  it('top tier: bar is full and has no next threshold', () => {
    const v = buildPointsView(out({ tier: 4, points_total: 320, points_earned: 10 }), 320)!;
    expect(v.barMax).toBeNull();
    expect(v.barTo).toBe(1);
  });

  it('A-12: no points card when points are unknown, stale or no_target', () => {
    expect(buildPointsView(null, 70)).toBeNull();
    expect(buildPointsView({}, 70)).toBeNull();
    expect(buildPointsView(out({ points_earned: undefined }), 70)).toBeNull();
    expect(buildPointsView(out({ points_outcome: 'no_target' }), 70)).toBeNull();
    expect(buildPointsView(MET, 999)).toBeNull(); // decision does not match live state
    expect(buildReviewViewModel({ outcome: {}, stateTotal: 10, locale: 'fr' }).points).toBeNull();
    expect(buildReviewViewModel({ outcome: null, stateTotal: null, locale: 'fr' }).steps).toEqual(['result']);
  });
});

describe('flow and steps (A-13, contract section 3)', () => {
  it('no tier-up: a single step, CTA is the final "Voir mon focus"', () => {
    const vm = buildReviewViewModel({ outcome: MET, stateTotal: 70, locale: 'fr' });
    expect(vm.steps).toEqual(['result']);
    expect(ctaKey(vm, 'result')).toBe('cta');
    expect(nextStep(vm, 'result')).toBeNull();
    expect(stepPills(vm, 'result')).toBeNull();
  });

  it('tier-up with a grant: 3 steps, CTAs Continuer, Decouvrir, Voir mon focus, pills on 2 and 3', () => {
    const vm = buildReviewViewModel({
      outcome: TIER_UP, stateTotal: 150, decisionCreatedAt: DECISION_AT, grants: [grant()], locale: 'fr',
    });
    expect(vm.steps).toEqual(['result', 'tierUp', 'reward']);
    expect(ctaKey(vm, 'result')).toBe('cta.continue');
    expect(ctaKey(vm, 'tierUp')).toBe('tierUp.cta');
    expect(ctaKey(vm, 'reward')).toBe('cta');
    expect(stepPills(vm, 'result')).toBeNull();
    expect(stepPills(vm, 'tierUp')).toEqual({ index: 2, total: 3 });
    expect(stepPills(vm, 'reward')).toEqual({ index: 3, total: 3 });
    expect(vm.tierUp).toMatchObject({ tier: 3, total: 150, hasReward: true });
  });

  it('A-13: tier-up without a reward row (failed grant / pool empty): 2 steps, no reward mention, no pills', () => {
    const vm = buildReviewViewModel({
      outcome: TIER_UP, stateTotal: 150, decisionCreatedAt: DECISION_AT, grants: [], locale: 'fr',
    });
    expect(vm.steps).toEqual(['result', 'tierUp']);
    expect(vm.reward).toBeNull();
    expect(vm.tierUp?.hasReward).toBe(false);
    expect(ctaKey(vm, 'tierUp')).toBe('cta');
    expect(stepPills(vm, 'tierUp')).toBeNull();
  });

  it('A-13: a reward row never creates step 3 without a tier-up, nor for another tier or an older grant', () => {
    const noUp = buildReviewViewModel({
      outcome: MET, stateTotal: 70, decisionCreatedAt: DECISION_AT, grants: [grant()], locale: 'fr',
    });
    expect(noUp.steps).toEqual(['result']);
    const wrongTier = buildReviewViewModel({
      outcome: TIER_UP, stateTotal: 150, decisionCreatedAt: DECISION_AT, grants: [grant({ tier: 2 })], locale: 'fr',
    });
    expect(wrongTier.reward).toBeNull();
    const older = buildReviewViewModel({
      outcome: TIER_UP, stateTotal: 150, decisionCreatedAt: DECISION_AT,
      grants: [grant({ granted_at: '2026-10-01T00:00:00Z' })], locale: 'fr',
    });
    expect(older.reward).toBeNull();
  });

  it('reward name comes from data, localised by locale', () => {
    const base = { outcome: TIER_UP, stateTotal: 150, decisionCreatedAt: DECISION_AT, grants: [grant()] };
    expect(buildReviewViewModel({ ...base, locale: 'fr' }).reward?.name).toBe('Régulier');
    expect(buildReviewViewModel({ ...base, locale: 'en' }).reward?.name).toBe('Steady');
    expect(buildReviewViewModel({ ...base, locale: 'fr' }).reward?.kind).toBe('title');
  });
});

describe('A-09 reduced motion', () => {
  it('removes springs and translate; opacity only, every duration <= 150ms, bar jumps', () => {
    const m = getMotionSpec(true);
    expect(m.badge.spring).toBe(false);
    expect(m.badge.fadeMs).toBeLessThanOrEqual(150);
    expect(m.card.fadeMs).toBeLessThanOrEqual(150);
    expect(m.card.delayMs).toBe(0);
    expect(m.stepFadeMs).toBeLessThanOrEqual(150);
    expect(m.bar.durationMs).toBe(0);
  });
  it('normal motion follows the contract timings', () => {
    const m = getMotionSpec(false);
    expect(m.badge.spring).toBe(true);
    expect(m.card).toEqual({ fadeMs: 240, delayMs: 120 });
    expect(m.bar).toEqual({ durationMs: 400, delayMs: 300 });
  });
  it('the view applies the spec (springify only on the non-reduced branch, no translate/scale)', () => {
    expect(VIEW_SRC).toContain('motion.badge.spring');
    expect(VIEW_SRC).toContain('reduceMotion');
    expect(OVERLAY_SRC).toContain('useReducedMotion');
    expect(VIEW_SRC).not.toMatch(/scale|ZoomIn|BounceIn|translate/i);
  });
});

function weeklyReviewStrings(): Record<'fr' | 'en', Record<string, string>> {
  const re = /^\s*'(coach\.weeklyReview\.[^']+)':\s*'((?:[^'\\]|\\.)*)',\s*$/gm;
  const all: Array<[string, string]> = [...I18N.matchAll(re)].map((m) => [m[1]!, m[2]!.replace(/\\'/g, "'")]);
  // fr dictionary precedes en dictionary: keys repeat once each, in the same order.
  const half = all.length / 2;
  const fr: Record<string, string> = {};
  const en: Record<string, string> = {};
  all.slice(0, half).forEach(([k, v]) => (fr[k.replace('coach.weeklyReview.', '')] = v));
  all.slice(half).forEach(([k, v]) => (en[k.replace('coach.weeklyReview.', '')] = v));
  return { fr, en };
}

describe('i18n copy (A-06, A-07, A-10)', () => {
  const { fr, en } = weeklyReviewStrings();
  // Contract section 5, plus the English equivalents of every forbidden idea.
  const FORBIDDEN = /perdu|échec|echec|raté|pénalité|malus|chance|tirage|hasard|jackpot|coffre|valeur|euros?|boutique|\blost\b|\bfail|penalty|\bluck|draw\b|random|surprise|jackpot|chest|\bprice|\bshop/i;

  it('fr and en define the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect(Object.keys(fr).length).toBeGreaterThan(25);
  });

  it('A-06: no forbidden word, minus sign, down arrow, dash glyph or emoji in any string', () => {
    for (const dict of [fr, en]) {
      for (const [k, v] of Object.entries(dict)) {
        expect(v, k).not.toMatch(FORBIDDEN);
        expect(v, k).not.toMatch(/[−–—↓▼]/u);
        expect(v, k).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(v, k).not.toMatch(/(^|\s)-\d/);
      }
    }
  });

  it('A-07: reward chip says chosen for you by Ziko', () => {
    expect(fr['reward.chip']).toBe('Choisi pour toi par Ziko');
    expect(en['reward.chip']).toBe('Chosen for you by Ziko');
  });

  it('A-10: one headline, never conditional on the result', () => {
    expect(fr.headline).toBe('Ziko a fait le point sur ta semaine.');
    expect(fr['points.met']).not.toBe(fr['points.missed']);
    expect(VIEW_SRC.match(/coach\.weeklyReview\.headline/g)?.length).toBe(1);
  });

  it('missed copy reassures and names neither a loss nor a deduction', () => {
    expect(fr['points.missedSub']).toBe('Pas de points cette semaine. Ton palier et tes récompenses restent à toi.');
    expect(fr['points.missed']).toBe('Semaine d\'ajustement');
  });
});

describe('source rules (A-11, A-14, A-15)', () => {
  it('A-14: CTA label is 19px bold, fill and radius unchanged from Phase 44', () => {
    expect(VIEW_SRC).toMatch(/fontSize: 19,[^}]*fontWeight: '700',[^}]*color: '#fff'/);
    expect(VIEW_SRC).toMatch(/paddingVertical: 16, borderRadius: 16, backgroundColor: C\.primary/);
  });

  it('A-15: Phase 44 parity of the centered stack, glow, badge and gap', () => {
    expect(VIEW_SRC).toContain("bg: '#1C1A17'");
    expect(VIEW_SRC).toContain('backgroundColor: C.bg');
    expect(VIEW_SRC).toContain('top: -40');
    expect(VIEW_SRC).toContain('marginLeft: -180');
    expect(VIEW_SRC).toContain("backgroundColor: 'rgba(255,92,26,0.25)'");
    expect(VIEW_SRC).toContain('width: 76');
    expect(VIEW_SRC).toContain('borderRadius: 22');
    expect(VIEW_SRC).toContain('FadeInUp.springify().damping(12)');
    expect(VIEW_SRC).toContain("justifyContent: 'center', gap: 32");
    expect(VIEW_SRC).toContain('paddingHorizontal: 24');
    // CTA is a child of the same stack as badge/headline/body (not pinned).
    const stack = VIEW_SRC.indexOf('gap: 32');
    expect(VIEW_SRC.indexOf('<TouchableOpacity')).toBeGreaterThan(stack);
    expect(VIEW_SRC.indexOf('</ScrollView>')).toBeGreaterThan(VIEW_SRC.indexOf('<TouchableOpacity'));
  });

  it('A-11: Ionicons only, no emoji, no StyleSheet.create, no RN Alert, no new colour outside the contract', () => {
    for (const src of [VIEW_SRC, OVERLAY_SRC]) {
      expect(src).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(src).not.toContain('StyleSheet.create');
      expect(src).not.toMatch(/\bAlert\b/);
    }
    expect(VIEW_SRC).toContain('@expo/vector-icons');
    const colours = new Set([...VIEW_SRC.matchAll(/#[0-9A-Fa-f]{3,6}\b|rgba?\([^)]*\)/g)].map((m) => m[0].replace(/\s/g, '')));
    const allowed = new Set([
      '#1C1A17', '#FFFAF6', 'rgba(255,250,246,0.70)', 'rgba(255,250,246,0.06)', 'rgba(255,250,246,0.14)',
      '#FF5C1A', '#8BDCAA', 'rgba(46,158,91,0.20)', '#FFB594', 'rgba(255,92,26,0.20)', 'rgba(255,250,246,0.10)',
      'rgba(255,92,26,0.25)', 'rgba(255,92,26,0.70)', '#fff',
    ]);
    for (const c of colours) expect(allowed.has(c), c).toBe(true);
    expect(VIEW_SRC).not.toMatch(/#(?:FF0000|E53935|D32F2F|ef4444)/i);
  });

  it('A-11: only the Ionicons named by the contract are used', () => {
    const VM_SRC = read('./weeklyRewardViewModel.ts');
    const names = [...(VIEW_SRC + VM_SRC).matchAll(/'(sparkles|medal|ribbon|checkmark-circle|trending-up|leaf)'/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(['sparkles', 'medal', 'ribbon', 'checkmark-circle', 'trending-up', 'leaf']));
  });
});
