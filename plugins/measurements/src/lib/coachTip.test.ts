import { describe, it, expect } from 'vitest';
import { weightCoachTip } from './coachTip';

describe('weightCoachTip (UAT run2 P15)', () => {
  it('jamais "stables" sans mesure', () => {
    expect(weightCoachTip([])).not.toMatch(/stable/i);
    expect(weightCoachTip(null)).not.toMatch(/stable/i);
    expect(weightCoachTip([{ weight_kg: null }, {}])).not.toMatch(/stable/i);
  });
  it('jamais "stables" avec une seule mesure', () => {
    expect(weightCoachTip([{ weight_kg: 80 }])).not.toMatch(/stable/i);
  });
  it('"stables" seulement avec au moins 2 mesures proches', () => {
    expect(weightCoachTip([{ weight_kg: 80.2 }, { weight_kg: 80 }])).toMatch(/stables/);
  });
  it('pas de "stables" quand le poids bouge', () => {
    expect(weightCoachTip([{ weight_kg: 82 }, { weight_kg: 80 }])).not.toMatch(/stable/i);
  });
});
