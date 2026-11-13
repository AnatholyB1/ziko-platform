import { describe, it, expect } from 'vitest';
import { classifyProfileRead, decideAppGate, parseCachedProfile, profileCacheKey } from '../profileGate';

describe('classifyProfileRead', () => {
  it('profil lu => loaded', () => {
    expect(classifyProfileRead({ data: { id: 'u1' }, error: null })).toBe('loaded');
  });
  it('aucune ligne (PGRST116) => missing', () => {
    expect(classifyProfileRead({ data: null, error: { code: 'PGRST116' } })).toBe('missing');
  });
  it('echec reseau => error (jamais missing)', () => {
    expect(classifyProfileRead({ data: null, error: { message: 'TypeError: Network request failed' } })).toBe('error');
    expect(classifyProfileRead({ data: null, error: { code: '', message: 'fetch failed' } })).toBe('error');
  });
  it('ni donnee ni erreur => missing', () => {
    expect(classifyProfileRead({ data: null, error: null })).toBe('missing');
  });
});

describe('decideAppGate (cold start hors ligne, UAT run 6)', () => {
  it('sans session => login', () => {
    expect(decideAppGate({ hasSession: false, profile: null, profileStatus: 'unknown' })).toBe('login');
  });
  it('profil onboarde => app, quel que soit le statut', () => {
    for (const profileStatus of ['unknown', 'loaded', 'error'] as const) {
      expect(decideAppGate({ hasSession: true, profile: { onboarding_done: true }, profileStatus })).toBe('app');
    }
  });
  it('HORS LIGNE sans profil (lecture en echec) => app degradee, PAS onboarding', () => {
    expect(decideAppGate({ hasSession: true, profile: null, profileStatus: 'error' })).toBe('app');
  });
  it('profil absent lu avec succes => onboarding', () => {
    expect(decideAppGate({ hasSession: true, profile: null, profileStatus: 'missing' })).toBe('onboarding');
  });
  it('profil lu mais onboarding incomplet => onboarding', () => {
    expect(decideAppGate({ hasSession: true, profile: { onboarding_done: false }, profileStatus: 'loaded' })).toBe(
      'onboarding',
    );
    expect(decideAppGate({ hasSession: true, profile: { onboarding_done: false }, profileStatus: 'error' })).toBe(
      'onboarding',
    );
  });
  it('lecture pas encore terminee => attend (ni onboarding ni app)', () => {
    expect(decideAppGate({ hasSession: true, profile: null, profileStatus: 'unknown' })).toBe('wait');
  });
});

describe('parseCachedProfile', () => {
  it('rend le profil du bon utilisateur', () => {
    const raw = JSON.stringify({ id: 'u1', onboarding_done: true });
    expect(parseCachedProfile(raw, 'u1')).toEqual({ id: 'u1', onboarding_done: true });
  });
  it('ignore un autre utilisateur, un JSON casse et une valeur absente', () => {
    expect(parseCachedProfile(JSON.stringify({ id: 'u2' }), 'u1')).toBeNull();
    expect(parseCachedProfile('{oops', 'u1')).toBeNull();
    expect(parseCachedProfile(null, 'u1')).toBeNull();
  });
  it('cle de cache par utilisateur', () => {
    expect(profileCacheKey('u1')).not.toBe(profileCacheKey('u2'));
  });
});
