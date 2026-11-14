import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { keyboardAvoidBehavior } from '../keyboardAvoid';

// Ce test ne prouve PAS le comportement natif du clavier (un rendu DOM ne le simule pas) : il garantit le reglage
// (Android n'est plus laisse sans comportement) ; a re-verifier sur emulateur.
describe('keyboardAvoidBehavior (Atelier, UAT run 9 defaut 5)', () => {
  it('Android et iOS : padding (Android edge-to-edge ne redimensionne plus la fenetre)', () => {
    expect(keyboardAvoidBehavior('android')).toBe('padding');
    expect(keyboardAvoidBehavior('ios')).toBe('padding');
  });
  it('les deux KeyboardAvoidingView de l\'Atelier (ecran + feuille) utilisent le helper, plus `undefined` sur Android', () => {
    const src = readFileSync(resolve(__dirname, '../../../app/(app)/workout/atelier.tsx'), 'utf8');
    const kavs = src.match(/<KeyboardAvoidingView[^>]*>/g) ?? [];
    expect(kavs.length).toBe(2);
    for (const k of kavs) expect(k).toMatch(/behavior=\{keyboardAvoidBehavior\(Platform\.OS\)\}/);
    expect(src).not.toMatch(/'padding' : undefined/);
  });
});
