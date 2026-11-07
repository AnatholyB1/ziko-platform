import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  clampLevel,
  getEffectiveLevel,
  isPluginUnlocked,
  getPluginMinLevel,
  filterUnlockedPlugins,
  isPluginIdUnlocked,
  getLockedPlugins,
  getNewlyUnlockedPlugins,
  getPluginIdFromSegments,
  isPluginRouteLocked,
  PLUGIN_LEVEL_MAP,
} from './gating';

describe('getEffectiveLevel', () => {
  it('no row => 1', () => {
    expect(getEffectiveLevel(null)).toBe(1);
    expect(getEffectiveLevel(undefined)).toBe(1);
    expect(getEffectiveLevel({})).toBe(1);
    expect(getEffectiveLevel({ tier: null })).toBe(1);
  });
  it('derives level from tier, ignoring stored level', () => {
    expect(getEffectiveLevel({ tier: 3, level: 1 })).toBe(3);
    expect(getEffectiveLevel({ tier: 1, level: 5 })).toBe(1);
  });
  it('clamps to 1..5', () => {
    expect(getEffectiveLevel({ tier: 0 })).toBe(1);
    expect(getEffectiveLevel({ tier: -4 })).toBe(1);
    expect(getEffectiveLevel({ tier: 9 })).toBe(5);
    expect(getEffectiveLevel({ tier: Number.NaN })).toBe(1);
    expect(clampLevel(2.9)).toBe(2);
  });
});

describe('isPluginUnlocked gating matrix', () => {
  const m = (minLevel?: number, mandatory?: boolean) => ({ minLevel, mandatory });
  it('default minLevel is 1', () => {
    expect(isPluginUnlocked(m(), 1)).toBe(true);
  });
  it('locked below, unlocked at and above minLevel', () => {
    for (let min = 1; min <= 5; min++) {
      for (let lvl = 1; lvl <= 5; lvl++) {
        expect(isPluginUnlocked(m(min), lvl)).toBe(lvl >= min);
      }
    }
  });
  it('mandatory is always unlocked', () => {
    expect(isPluginUnlocked(m(5, true), 1)).toBe(true);
  });
  it('out-of-range minLevel is clamped so it can still be unlocked', () => {
    expect(getPluginMinLevel(m(99))).toBe(5);
    expect(isPluginUnlocked(m(99), 5)).toBe(true);
    expect(isPluginUnlocked(m(-3), 1)).toBe(true);
  });
});

describe('filterUnlockedPlugins floor guarantee', () => {
  it('level 1 never yields zero plugins with the real map', () => {
    const all = Object.values(PLUGIN_LEVEL_MAP);
    expect(filterUnlockedPlugins(all, 1).length).toBeGreaterThanOrEqual(7);
  });
  it('falls back to the lowest-level manifests when nothing passes', () => {
    const all = [{ id: 'a', minLevel: 4 }, { id: 'b', minLevel: 3 }, { id: 'c', minLevel: 3 }];
    // clampLevel(level) is >= 1 so simulate with a level below: use level 2
    const res = filterUnlockedPlugins(all, 2);
    expect(res.map((x) => x.id)).toEqual(['b', 'c']);
  });
  it('empty input stays empty', () => {
    expect(filterUnlockedPlugins([], 1)).toEqual([]);
  });
  it('per-level counts follow D-03 (7/13/17/19 unlocked at 1/2/3/4)', () => {
    const all = Object.values(PLUGIN_LEVEL_MAP);
    expect(all).toHaveLength(19);
    expect(filterUnlockedPlugins(all, 1)).toHaveLength(7);
    expect(filterUnlockedPlugins(all, 2)).toHaveLength(13);
    expect(filterUnlockedPlugins(all, 3)).toHaveLength(17);
    expect(filterUnlockedPlugins(all, 4)).toHaveLength(19);
    expect(filterUnlockedPlugins(all, 5)).toHaveLength(19);
  });
});

describe('level-up', () => {
  it('lists newly unlocked plugins between levels', () => {
    expect(getNewlyUnlockedPlugins(1, 2).map((p) => p.id).sort()).toEqual(
      ['journal', 'measurements', 'pantry', 'persona', 'sleep', 'stats'],
    );
    expect(getNewlyUnlockedPlugins(3, 4).map((p) => p.id).sort()).toEqual(['ai-programs', 'supplements']);
    expect(getNewlyUnlockedPlugins(1, 4)).toHaveLength(12);
  });
  it('no level-up (same or lower) => nothing', () => {
    expect(getNewlyUnlockedPlugins(3, 3)).toEqual([]);
    expect(getNewlyUnlockedPlugins(4, 2)).toEqual([]);
  });
  it('getLockedPlugins shrinks as level rises and is sorted', () => {
    expect(getLockedPlugins(1)).toHaveLength(12);
    expect(getLockedPlugins(4)).toHaveLength(0);
    const l = getLockedPlugins(1).map((p) => p.minLevel);
    expect(l).toEqual([...l].sort((a, b) => a - b));
  });
  it('already-installed plugin above level is re-locked after a downgrade', () => {
    expect(isPluginIdUnlocked('cardio', 3)).toBe(true);
    expect(isPluginIdUnlocked('cardio', 2)).toBe(false);
  });
});

describe('deep-link route guard', () => {
  it('extracts the plugin id from segments', () => {
    expect(getPluginIdFromSegments(['(app)', '(plugins)', 'habits', 'dashboard'])).toBe('habits');
    expect(getPluginIdFromSegments(['(app)', 'index'])).toBeNull();
  });
  it('blocks locked plugin routes, allows unlocked and non-plugin routes', () => {
    expect(isPluginRouteLocked(['(app)', '(plugins)', 'cardio', 'tracker'], 1)).toBe(true);
    expect(isPluginRouteLocked(['(app)', '(plugins)', 'cardio', 'tracker'], 3)).toBe(false);
    expect(isPluginRouteLocked(['(app)', '(plugins)', 'habits', 'log'], 1)).toBe(false);
    expect(isPluginRouteLocked(['(app)', 'profile'], 1)).toBe(false);
    expect(isPluginRouteLocked(['(app)', '(plugins)', 'unknown-plugin', 'x'], 1)).toBe(false);
  });
});

describe('PLUGIN_LEVEL_MAP stays in sync with plugin manifests', () => {
  const root = join(__dirname, '..', '..', '..');
  for (const info of Object.values(PLUGIN_LEVEL_MAP)) {
    it(`${info.id} manifest matches`, () => {
      const p = join(root, 'plugins', info.id, 'src', 'manifest.ts');
      expect(existsSync(p)).toBe(true);
      const src = readFileSync(p, 'utf8');
      expect(src).toContain(`id: '${info.id}'`);
      expect(src).toMatch(new RegExp(`minLevel:\\s*${info.minLevel}\\b`));
      expect(src).toContain(`icon: '${info.icon}'`);
      expect(src).toContain(`name: '${info.name}'`);
      expect(/mandatory:\s*true/.test(src)).toBe(!!info.mandatory);
    });
  }
  it('covers every plugin directory', () => {
    const dirs = readdirSync(join(root, 'plugins'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(Object.keys(PLUGIN_LEVEL_MAP).sort()).toEqual(dirs);
  });
});
