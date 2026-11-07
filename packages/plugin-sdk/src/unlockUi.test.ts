import { describe, it, expect } from 'vitest';
import {
  buildLockedSection,
  lockedTapAlertArgs,
  unlockToastBottom,
  shouldShowUnlockToast,
  unlockToastDetailKey,
  unlockToastMotion,
  UNLOCK_TOAST_DURATION_MS,
  LOCKED_SHORT_NAMES,
  LOCKED_TOKENS,
} from './unlockUi';
import { PLUGIN_LEVEL_MAP } from './gating';
import { translations } from './i18n';

describe('buildLockedSection (B-08, B-12)', () => {
  it('level 1 lists all 12 locked plugins, minLevel ascending', () => {
    const m = buildLockedSection(1);
    expect(m.tiles).toHaveLength(12);
    const levels = m.tiles.map((t) => t.minLevel);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(m.tiles[0].id).toBe('journal');
    expect(m.showLockedSection).toBe(true);
    expect(m.showAllUnlocked).toBe(false);
  });
  it('level 5 has nothing locked: closing line only, never both (B-08)', () => {
    const m = buildLockedSection(5);
    expect(m.tiles).toHaveLength(0);
    expect(m.showLockedSection).toBe(false);
    expect(m.showAllUnlocked).toBe(true);
  });
  it('level 3 leaves the two level-4 plugins', () => {
    expect(buildLockedSection(3).tiles.map((t) => t.id)).toEqual(['ai-programs', 'supplements']);
  });
  it('only next-level tiles get the primary pill tone', () => {
    const m = buildLockedSection(1);
    for (const t of m.tiles) expect(t.pillTone).toBe(t.minLevel === 2 ? 'next' : 'later');
  });
  it('clamps garbage levels to 1', () => {
    expect(buildLockedSection(NaN).tiles).toHaveLength(12);
    expect(buildLockedSection(99).tiles).toHaveLength(0);
  });
  it('every locked plugin has a short name', () => {
    for (const p of Object.values(PLUGIN_LEVEL_MAP)) {
      if (p.minLevel > 1) expect(LOCKED_SHORT_NAMES[p.id]).toBeTruthy();
    }
  });
});

describe('locked tap alert (B-09)', () => {
  it('is a title-only key with the required level', () => {
    expect(lockedTapAlertArgs(3)).toEqual({ key: 'plugins.locked.required', params: { n: 3 } });
    expect(translations.fr['plugins.locked.required'].replace('{n}', '3')).toBe('Niveau 3 requis');
  });
});

describe('unlock toast', () => {
  it('lasts 4000 ms', () => expect(UNLOCK_TOAST_DURATION_MS).toBe(4000));
  it('B-14: clears the tab bar on a 34px-inset device', () => {
    const tabBar = 70 + 34;
    expect(unlockToastBottom(34)).toBeGreaterThanOrEqual(tabBar + 8);
    expect(unlockToastBottom(34)).toBe(116);
    expect(unlockToastBottom(0)).toBe(82);
    expect(unlockToastBottom(NaN)).toBe(82);
  });
  it('B-10: waits for the blocking overlay, needs plugins to announce', () => {
    const up = { plugins: [{}, {}] };
    expect(shouldShowUnlockToast({ levelUp: up, blockingOverlayOpen: true })).toBe(false);
    expect(shouldShowUnlockToast({ levelUp: up, blockingOverlayOpen: false })).toBe(true);
    expect(shouldShowUnlockToast({ levelUp: null, blockingOverlayOpen: false })).toBe(false);
    expect(shouldShowUnlockToast({ levelUp: { plugins: [] }, blockingOverlayOpen: false })).toBe(false);
  });
  it('singular / plural copy keys resolve in fr and en', () => {
    expect(unlockToastDetailKey(1)).toBe('plugins.unlocked.toastDetailOne');
    expect(unlockToastDetailKey(6)).toBe('plugins.unlocked.toastDetail');
    for (const loc of ['fr', 'en'] as const) {
      for (const k of [
        'plugins.locked.required', 'plugins.locked.level', 'plugins.locked.helper', 'plugins.locked.a11y',
        'plugins.locked.a11yHint', 'plugins.unlocked.allDone', 'plugins.unlocked.toastTitle',
        'plugins.unlocked.toastDetail', 'plugins.unlocked.toastDetailOne',
      ]) expect(translations[loc][k], `${loc}:${k}`).toBeTruthy();
    }
    expect(translations.fr['plugins.unlocked.toastDetail'].replace('{k}', '6')).toBe('6 modules débloqués');
  });
  it('B-13: reduced motion removes translateY, 150ms', () => {
    const r = unlockToastMotion(true);
    expect(r.from.translateY).toBeUndefined();
    expect(r.animate.translateY).toBeUndefined();
    expect(r.duration).toBe(150);
    expect(unlockToastMotion(false).from.translateY).toBe(20);
  });
});

describe('B-05 / B-11 tokens', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  it('locked glyph >= 3:1 on locked tile', () => {
    expect(ratio(LOCKED_TOKENS.lockedIcon, LOCKED_TOKENS.lockedBg)).toBeGreaterThanOrEqual(3);
  });
  it('primary ink >= 4.5:1 on white', () => {
    expect(ratio(LOCKED_TOKENS.primaryInk, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
  it('no emoji in new copy', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const loc of ['fr', 'en'] as const)
      for (const [k, v] of Object.entries(translations[loc]))
        if (k.startsWith('plugins.locked') || k.startsWith('plugins.unlocked')) expect(emoji.test(v), k).toBe(false);
  });
});
