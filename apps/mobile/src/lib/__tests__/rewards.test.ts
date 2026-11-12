import { describe, it, expect } from 'vitest';
import {
  BADGE_ICONS, buildAchievements, badgeIconName, categoryCounts, equippedViolations, formatAmount, historyLabel,
  itemsInCategory, missingCoinsShort, missingCoinsText, ownedByCategory, parseAwarded, awardToastText, relativeDay,
  remainingHint, shopItemState, sortHistory, stripEmoji, themeEquipNote, tierCoins, unlockedLong, unlockedShort,
  type BadgeDefinition, type ShopItemLite,
} from '@ziko/plugin-gamification/rewards';

// Les 11 definitions reelles (supabase/migrations/20260522143410_profile_settings_gap.sql).
const DEFS: BadgeDefinition[] = [
  ['first_session', 'Première séance', 'sessions', 1, 1],
  ['ten_sessions', '10 séances', 'sessions', 10, 1],
  ['fifty_sessions', '50 séances', 'sessions', 50, 2],
  ['hundred_sessions', '100 séances', 'sessions', 100, 3],
  ['streak_7', 'Streak 7 jours', 'streak', 7, 1],
  ['streak_30', 'Streak 30 jours', 'streak', 30, 2],
  ['streak_100', 'Streak 100 jours', 'streak', 100, 3],
  ['first_pr', 'Premier PR', 'prs', 1, 1],
  ['ten_prs', '10 PRs battus', 'prs', 10, 2],
  ['profile_complete', 'Profil complet', 'profile_complete', 1, 1],
  ['first_friend', 'Premier ami', 'friends', 1, 1],
].map(([slug, name, ct, cv, tier]) => ({
  slug: slug as string, name: name as string, description: `desc ${slug}`, icon: '🏋️',
  condition_type: ct as string, condition_value: cv as number, tier: tier as number,
}));

describe('badge icons (REWD-02, D-07)', () => {
  it('maps the 11 real slugs to 11 distinct Ionicons, never an emoji', () => {
    const names = DEFS.map((d) => badgeIconName(d.slug));
    expect(new Set(names).size).toBe(11);
    for (const n of names) expect(n).toMatch(/^[a-z-]+$/);
    expect(Object.keys(BADGE_ICONS)).toHaveLength(11);
  });
  it('falls back to ribbon for an unknown slug', () => {
    expect(badgeIconName('something_new')).toBe('ribbon');
  });
});

describe('buildAchievements', () => {
  it('new account: 0 unlocked, 11 locked, progress from counters', () => {
    const r = buildAchievements(DEFS, [], DEFS.map((d) => ({ slug: d.slug, current: 0, reward_coins: tierCoins(d.tier) })));
    expect(r.total).toBe(11);
    expect(r.unlockedCount).toBe(0);
    expect(r.locked).toHaveLength(11);
    expect(r.unlocked).toHaveLength(0);
    expect(r.pct).toBe(0);
  });

  it('R-2 shape (7 locked + 4 unlocked), n/N capped, proximity order', () => {
    const earned = ['first_session', 'ten_sessions', 'first_pr', 'profile_complete'].map((s, i) => ({ badge_slug: s, earned_at: `2026-09-0${i + 1}T10:00:00Z` }));
    const counters: Record<string, number> = { sessions: 42, streak: 5, prs: 6, friends: 0, profile_complete: 1 };
    const progress = DEFS.map((d) => ({ slug: d.slug, current: counters[d.condition_type], reward_coins: tierCoins(d.tier) }));
    const r = buildAchievements(DEFS, earned, progress);
    expect(r.unlockedCount).toBe(4);
    expect(r.locked).toHaveLength(7);
    expect(r.pct).toBe(36);
    // 42/50 (0.84), then 5/7 (0.71), then 6/10 (0.6).
    expect(r.locked.map((a) => a.slug).slice(0, 3)).toEqual(['fifty_sessions', 'streak_7', 'ten_prs']);
    const fifty = r.locked[0];
    expect(`${fifty.current} / ${fifty.target}`).toBe('42 / 50');
    // an over-target counter never shows 60 / 50
    const capped = buildAchievements(DEFS, [], [{ slug: 'fifty_sessions', current: 60, reward_coins: 50 }]);
    expect(capped.locked.find((a) => a.slug === 'fifty_sessions')!.current).toBe(50);
    // friend badge locked with 0 / 1 and last in proximity order among equals
    expect(r.locked.find((a) => a.slug === 'first_friend')!.current).toBe(0);
  });

  it('unlocked shows the real date, newest first, and locked never carries a date (R-4)', () => {
    const earned = [
      { badge_slug: 'first_session', earned_at: '2026-09-03T08:00:00Z' },
      { badge_slug: 'first_pr', earned_at: '2026-09-18T08:00:00Z' },
    ];
    const r = buildAchievements(DEFS, earned, []);
    expect(r.unlocked.map((a) => a.slug)).toEqual(['first_pr', 'first_session']);
    for (const a of r.unlocked) { expect(a.current).toBe(a.target); expect(a.earnedAt).toBeTruthy(); }
    for (const a of r.locked) expect(a.earnedAt).toBeNull();
  });

  it('R-3: an award moves a badge from locked to unlocked on the next build, with its date', () => {
    const before = buildAchievements(DEFS, [], [{ slug: 'first_session', current: 0, reward_coins: 25 }]);
    expect(before.locked.some((a) => a.slug === 'first_session')).toBe(true);
    const after = buildAchievements(DEFS, [{ badge_slug: 'first_session', earned_at: '2026-11-12T09:00:00Z' }], [{ slug: 'first_session', current: 1, reward_coins: 25 }]);
    expect(after.locked.some((a) => a.slug === 'first_session')).toBe(false);
    expect(after.unlocked[0]).toMatchObject({ slug: 'first_session', earnedAt: '2026-11-12T09:00:00Z' });
  });

  it('reward coins come from the server progress, tier mapping only as fallback', () => {
    const r = buildAchievements(DEFS, [], [{ slug: 'streak_7', current: 1, reward_coins: 75 }]);
    expect(r.locked.find((a) => a.slug === 'streak_7')!.rewardCoins).toBe(75);
    expect(r.locked.find((a) => a.slug === 'streak_100')!.rewardCoins).toBe(100);
    expect(tierCoins(1)).toBe(25); expect(tierCoins(2)).toBe(50); expect(tierCoins(3)).toBe(100);
  });
});

describe('copy (lot B microcopy)', () => {
  it('streak hint matches the contract wording', () => {
    const r = buildAchievements(DEFS, [], [{ slug: 'streak_7', current: 5, reward_coins: 25 }]);
    expect(remainingHint(r.locked.find((a) => a.slug === 'streak_7')!)).toBe("Encore 2 jours d'entraînement ou de check-in.");
  });
  it('dates: short and long, empty when absent', () => {
    expect(unlockedShort('2026-09-03T12:00:00Z')).toBe('Débloqué le 3 sept.');
    expect(unlockedLong('2026-09-18T12:00:00Z')).toBe('Débloqué le 18 septembre 2026');
    expect(unlockedShort(null)).toBe('');
    expect(unlockedLong('not-a-date')).toBe('');
  });
  it('toast text for one and several awards', () => {
    expect(awardToastText([])).toBe('');
    expect(awardToastText([{ slug: 'a', name: 'Premier PR', coins: 25 }])).toBe('Succès débloqué : Premier PR (+25 pièces)');
    expect(awardToastText([{ slug: 'a', name: 'A', coins: 25 }, { slug: 'b', name: 'B', coins: 50 }])).toBe('2 succès débloqués (+75 pièces)');
  });
  it('parseAwarded tolerates void/null/garbage from the old function shape', () => {
    expect(parseAwarded(null)).toEqual([]);
    expect(parseAwarded('x')).toEqual([]);
    expect(parseAwarded([{ slug: 'first_pr', name: 'Premier PR', coins: 25 }, { nope: 1 }])).toEqual([{ slug: 'first_pr', name: 'Premier PR', coins: 25 }]);
  });
});

const item = (id: string, category: ShopItemLite['category'], price: number, level = 1): ShopItemLite => ({
  id, name: id, description: null, category, price, level_required: level,
});

describe('shop (REWD-05/06/09)', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => item(`b${i}`, 'badge', 100 + i));
  const items = [...twelve, item('t1', 'theme', 500), item('t2', 'theme', 800), item('t3', 'theme', 900, 10), item('ti1', 'title', 300)];

  it('R-5: counters are the real counts and the list is not capped at 8', () => {
    const c = categoryCounts(items);
    expect(c).toEqual({ title: 1, badge: 12, theme: 3, banner: 0 });
    expect(itemsInCategory(items, 'badge')).toHaveLength(12);
  });

  it('item states: price, owned, level-locked, insufficient (R-6)', () => {
    const inv = [{ item_id: 't1', is_equipped: false }];
    const ctx = { coins: 340, level: 7, inventory: inv };
    expect(shopItemState(items.find((i) => i.id === 't1')!, ctx)).toEqual({ kind: 'owned', equipped: false });
    expect(shopItemState(items.find((i) => i.id === 't2')!, ctx)).toEqual({ kind: 'insufficient', missing: 460 });
    expect(shopItemState(items.find((i) => i.id === 't3')!, ctx)).toEqual({ kind: 'level_locked', level: 10 });
    expect(shopItemState(items.find((i) => i.id === 'ti1')!, ctx)).toEqual({ kind: 'available' });
    // level lock wins over insufficient funds
    expect(shopItemState(items.find((i) => i.id === 't3')!, { ...ctx, coins: 0 })).toEqual({ kind: 'level_locked', level: 10 });
  });

  it('copy for missing coins', () => {
    expect(missingCoinsShort(460)).toBe('Il manque 460 pièces');
    expect(missingCoinsText(160)).toBe("Il te manque 160 pièces. Gagne-en en t'entraînant.");
  });

  it('R-8: Mes objets lists owned only, equipped first, and flags >1 equipped per category', () => {
    const inv = [
      { item_id: 'ti1', is_equipped: true },
      { item_id: 't1', is_equipped: false },
      { item_id: 't2', is_equipped: true },
    ];
    const g = ownedByCategory(items, inv);
    expect(g.map((x) => x.category)).toEqual(['title', 'theme']);
    expect(g[1].items.map((i) => i.id)).toEqual(['t2', 't1']);
    expect(equippedViolations(items, inv)).toEqual([]);
    expect(equippedViolations(items, [{ item_id: 't1', is_equipped: true }, { item_id: 't2', is_equipped: true }])).toEqual(['theme']);
  });

  it('Q6: coach branding note only when a coach is active', () => {
    expect(themeEquipNote(false)).toBeNull();
    expect(themeEquipNote(true)).toContain('coach');
  });
});

describe('history (REWD-08, R-9)', () => {
  it('strips stored emoji and falls back to a source label (never an emoji rendered)', () => {
    expect(stripEmoji('🛒 Achat : Machine')).toBe('Achat : Machine');
    expect(stripEmoji('💪 Séance terminée : +50 XP')).toBe('Séance terminée : +50 XP');
    expect(stripEmoji('🏋️ ✅ ok')).toBe('ok');
    expect(historyLabel({ source: 'achievement', description: null })).toBe('Succès');
    expect(historyLabel({ source: 'workout', description: '💰 Séance terminée : +25 pièces' })).toBe('Séance terminée : +25 pièces');
  });
  it('amount sign and reverse-chronological order, no cap', () => {
    expect(formatAmount(25)).toBe('+25');
    expect(formatAmount(-300)).toBe('−300');
    const rows = Array.from({ length: 30 }, (_, i) => ({ created_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z` }));
    const sorted = sortHistory(rows);
    expect(sorted).toHaveLength(30);
    expect(sorted[0].created_at).toBe('2026-10-30T10:00:00Z');
    expect(sorted[29].created_at).toBe('2026-10-01T10:00:00Z');
  });
  it('relative day labels', () => {
    const now = new Date(2026, 10, 12, 15, 0, 0);
    expect(relativeDay(new Date(2026, 10, 12, 8, 0).toISOString(), now)).toBe("aujourd'hui");
    expect(relativeDay(new Date(2026, 10, 11, 20, 0).toISOString(), now)).toBe('hier');
    expect(relativeDay(new Date(2026, 9, 3, 12, 0).toISOString(), now)).toBe('3 oct.');
  });
});
