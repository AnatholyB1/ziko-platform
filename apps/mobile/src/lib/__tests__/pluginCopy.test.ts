import { describe, it, expect } from 'vitest';
import { storeDescription, looksEnglish } from '../pluginCopy';
import habits from '@ziko/plugin-habits/manifest';
import nutrition from '@ziko/plugin-nutrition/manifest';
import persona from '@ziko/plugin-persona/manifest';

describe('descriptions du store en francais (run5)', () => {
  it('le registre en anglais (habits, nutrition, persona) est remplace par le libelle francais', () => {
    for (const id of ['habits', 'nutrition', 'persona']) {
      const out = storeDescription(id, 'Track your daily goals: water intake, workouts, sleep.');
      expect(looksEnglish(out)).toBe(false);
      expect(out).not.toContain('Track your');
    }
    expect(storeDescription('habits', 'x')).toContain('objectifs du jour');
  });
  it('autre module : description du registre inchangee', () => {
    expect(storeDescription('hydration', 'Suivi de consommation d\'eau.')).toBe("Suivi de consommation d'eau.");
    expect(storeDescription('hydration', null)).toBe('');
  });
  it('les manifestes locaux sont aussi en francais', () => {
    for (const m of [habits, nutrition, persona]) expect(looksEnglish(String((m as any).description))).toBe(false);
  });
});
