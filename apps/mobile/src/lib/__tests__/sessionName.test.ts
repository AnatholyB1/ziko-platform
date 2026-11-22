import { describe, it, expect } from 'vitest';
import { resolveSessionName, DEFAULT_SESSION_NAME } from '../workoutPlan';

describe('resolveSessionName (UAT run 6 : seance nommee "A")', () => {
  it('garde un nom parlant', () => {
    expect(resolveSessionName('Full Body Power', 'Force')).toBe('Full Body Power');
  });
  it('prefixe un nom trop court du nom du programme', () => {
    expect(resolveSessionName('A', 'Force 5x5')).toBe('Force 5x5 · A');
  });
  it('vide => programme ou "Séance libre"', () => {
    expect(resolveSessionName('', 'Force')).toBe('Force');
    expect(resolveSessionName(undefined)).toBe(DEFAULT_SESSION_NAME);
    expect(DEFAULT_SESSION_NAME).toBe('Séance libre');
  });
});
