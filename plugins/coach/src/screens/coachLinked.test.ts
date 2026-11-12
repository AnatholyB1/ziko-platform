import { describe, it, expect } from 'vitest';
import { resolveLinkedView, formatSince, initials, GENERIC_COACH_NAME } from './coachLinked';

const link = { id: 'l1', created_at: '2026-10-03T09:00:00Z' };

describe('resolveLinkedView (COACH-01, CO-1, CO-3)', () => {
  it('pas de lien -> null (etat A)', () => {
    expect(resolveLinkedView(null)).toBeNull();
    expect(resolveLinkedView({ link: null })).toBeNull();
  });

  it('lien sans preview : carte degradee avec nom generique (jamais vide)', () => {
    const v = resolveLinkedView({ link, preview: null });
    expect(v).toMatchObject({ name: GENERIC_COACH_NAME, degraded: true, kycVerified: false, specialties: [] });
    expect(v?.since).toBeTruthy();
  });

  it('lien sans champ preview du tout', () => {
    expect(resolveLinkedView({ link })?.degraded).toBe(true);
  });

  it('lien + profil : nom, specialites exactes, badge KYC seulement si verified', () => {
    const base = { display_name: 'Marie Durand', specialties: ['Force', 'Mobilité'], photo_signed_url: 'https://x/y.jpg' };
    const ok = resolveLinkedView({ link, preview: { ...base, kyc_status: 'verified' } });
    expect(ok).toMatchObject({ name: 'Marie Durand', degraded: false, kycVerified: true, specialties: ['Force', 'Mobilité'], photoUrl: 'https://x/y.jpg' });
    for (const st of ['pending', 'submitted', 'rejected', null] as const) {
      expect(resolveLinkedView({ link, preview: { ...base, kyc_status: st } })?.kycVerified).toBe(false);
    }
  });

  it('nom vide ou espaces -> libelle generique mais profil non degrade', () => {
    const v = resolveLinkedView({ link, preview: { display_name: '   ', specialties: null, kyc_status: null } });
    expect(v).toMatchObject({ name: GENERIC_COACH_NAME, degraded: false, specialties: [] });
  });

  it('logo de marque prioritaire (chemin conserve)', () => {
    const v = resolveLinkedView({ link, preview: { display_name: 'A' }, branding: { logo_url: 'a/logo.png' } });
    expect(v?.logoPath).toBe('a/logo.png');
  });
});

describe('formatSince / initials', () => {
  it('date en francais court', () => {
    expect(formatSince('2026-10-03T09:00:00Z')).toMatch(/3 oct\.? 2026/);
    expect(formatSince('nope')).toBeNull();
    expect(formatSince(null)).toBeNull();
  });
  it('initiales', () => {
    expect(initials('Marie Durand')).toBe('MD');
    expect(initials('Ziko')).toBe('Z');
    expect(initials('  ')).toBe('?');
  });
});
