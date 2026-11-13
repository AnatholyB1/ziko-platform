import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QUICK_TILE_HEIGHT, QUICK_TILE_OUTER_STYLE, quickTileCardStyle } from './tileStyles';

const base = { locked: false, surface: '#FFFFFF', border: '#E2E0DA', primary: '#FF5C1A' };

describe('HY-2 tuiles de log rapide (run 7 : 103 dp, sans fond)', () => {
  it('le Pressable porte un style statique de 132 dp, flex 1', () => {
    expect(QUICK_TILE_HEIGHT).toBe(132);
    expect(QUICK_TILE_OUTER_STYLE).toEqual({ flex: 1, height: 132 });
    expect(typeof QUICK_TILE_OUTER_STYLE).toBe('object');
  });

  it('au repos : fond carte, bord 1 px, ombre, hauteur 132', () => {
    const s = quickTileCardStyle({ ...base, pressed: false });
    expect(s.height).toBe(132);
    expect(s.backgroundColor).toBe('#FFFFFF');
    expect(s.borderWidth).toBe(1);
    expect(s.borderColor).toBe('#E2E0DA');
    expect(s.borderRadius).toBe(16);
    expect((s as any).shadowOpacity).toBe(0.08);
  });

  it('presse : etat distinct (fond, bord 2 px primaire, pas d ombre), meme hauteur', () => {
    const s = quickTileCardStyle({ ...base, pressed: true });
    expect(s.height).toBe(132);
    expect(s.backgroundColor).toBe('#F0EFE9');
    expect(s.borderWidth).toBe(2);
    expect(s.borderColor).toBe('#FF5C1A');
    expect((s as any).shadowOpacity).toBeUndefined();
  });

  it('verrouille : estompe sauf si presse', () => {
    expect(quickTileCardStyle({ ...base, locked: true, pressed: false }).opacity).toBe(0.7);
    expect(quickTileCardStyle({ ...base, locked: true, pressed: true }).opacity).toBe(1);
  });

  it('garde : l ecran n utilise plus de style fonction sur le Pressable des tuiles', () => {
    const src = readFileSync(resolve(__dirname, 'screens/HydrationPlugin.tsx'), 'utf8');
    expect(src).not.toMatch(/style=\{\(\{ pressed \}\)/);
    expect(src).toContain('style={QUICK_TILE_OUTER_STYLE}');
  });
});
