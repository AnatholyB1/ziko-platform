import { describe, it, expect } from 'vitest';
import { classifyLoadError, httpError, LOAD_FAILURE_COPY } from './loadError';

describe('classifyLoadError (run7 : 401 != reseau)', () => {
  it('401 du backend = session expiree, pas "verifie ta connexion"', () => {
    const k = classifyLoadError(httpError('Failed to fetch link status', 401));
    expect(k).toBe('expired');
    expect(LOAD_FAILURE_COPY[k].title).toBe('Session expirée');
    expect(LOAD_FAILURE_COPY[k].body).not.toMatch(/connexion/i);
  });
  it('403 / JWT expire = session expiree', () => {
    expect(classifyLoadError(httpError('x', 403))).toBe('expired');
    expect(classifyLoadError({ message: 'JWT expired', code: 'PGRST301' })).toBe('expired');
  });
  it('erreur reseau (fetch qui echoue) = hors ligne', () => {
    expect(classifyLoadError(new TypeError('Network request failed'))).toBe('offline');
    expect(LOAD_FAILURE_COPY.offline.body).toBe('Vérifie ta connexion, puis réessaie.');
  });
  it('500 = erreur serveur', () => {
    expect(classifyLoadError(httpError('Failed to fetch link status', 500))).toBe('server');
  });
});
