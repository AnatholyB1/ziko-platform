// Phase 28 plan 02 — claude.ts export shape test (Wave 2)
// Verifies that parseWithVision and parseWithText are exported functions.
// Actual generateObject calls are integration-tested in plan 28-08 smoke tests.
import { describe, it, expect } from 'vitest';

describe('parse/claude', () => {
  it('parseWithVision: exported as async function', async () => {
    const mod = await import('../../../src/coach/imports/parse/claude.js');
    expect(typeof mod.parseWithVision).toBe('function');
    // Constructor name check: async functions have name !== 'Function'
    // (they are AsyncFunction which is still 'function' in typeof)
    expect(mod.parseWithVision.constructor.name).toBe('AsyncFunction');
  });

  it('parseWithText: exported as async function', async () => {
    const mod = await import('../../../src/coach/imports/parse/claude.js');
    expect(typeof mod.parseWithText).toBe('function');
    expect(mod.parseWithText.constructor.name).toBe('AsyncFunction');
  });
});
