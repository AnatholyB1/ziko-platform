import { describe, it, expect } from 'vitest';
import {
  resolveCoachState,
  buildHistoryRows,
  isRevokeConfirmed,
  revokeModalBody,
  revokeDoneMessage,
  FORMER_COACH_NAME,
  HISTORY_MAX,
} from './coachState';

const base = { isLoading: false, isError: false, hasData: true, hasActiveLink: false, hasPreview: false };

describe('resolveCoachState (MCOA-02 : 3 etats code / apercu / lie)', () => {
  it('sans lien ni apercu -> code (etat A)', () => {
    expect(resolveCoachState(base)).toBe('code');
  });
  it('apercu present, pas de lien -> preview (etat B)', () => {
    expect(resolveCoachState({ ...base, hasPreview: true })).toBe('preview');
  });
  it('lien actif -> linked (etat C)', () => {
    expect(resolveCoachState({ ...base, hasActiveLink: true })).toBe('linked');
  });
  it('lien actif ET apercu obsolete : le lien l emporte (jamais de saisie de code a un athlete lie)', () => {
    expect(resolveCoachState({ ...base, hasActiveLink: true, hasPreview: true })).toBe('linked');
  });
  it('chargement prioritaire ; erreur seulement sans donnees (on ne devine pas l etat du lien)', () => {
    expect(resolveCoachState({ ...base, isLoading: true })).toBe('loading');
    expect(resolveCoachState({ ...base, isError: true, hasData: false })).toBe('error');
    expect(resolveCoachState({ ...base, isError: true, hasData: true, hasActiveLink: true })).toBe('linked');
  });
});

describe('buildHistoryRows (historique conserve)', () => {
  const item = (i: number, name: string | null = 'Marie') => ({
    link_id: `l${i}`,
    coach_name: name,
    linked_at: '2026-01-05T10:00:00Z',
    revoked_at: '2026-03-10T10:00:00Z',
  });

  it('vide / null -> aucune ligne (le bloc n est pas affiche)', () => {
    expect(buildHistoryRows(null)).toEqual([]);
    expect(buildHistoryRows([])).toEqual([]);
  });
  it(`plafonne a ${HISTORY_MAX} lignes`, () => {
    expect(buildHistoryRows(Array.from({ length: 9 }, (_, i) => item(i)))).toHaveLength(HISTORY_MAX);
  });
  it('nom absent/vide -> "Ancien coach" (jamais vide)', () => {
    expect(buildHistoryRows([item(1, null)])[0].name).toBe(FORMER_COACH_NAME);
    expect(buildHistoryRows([item(1, '  ')])[0].name).toBe(FORMER_COACH_NAME);
    expect(buildHistoryRows([item(1, 'Marie Durand')])[0].name).toBe('Marie Durand');
  });
  it('plage "du X au Y" ; bornes invalides omises sans "Invalid Date"', () => {
    const r = buildHistoryRows([item(1)])[0];
    expect(r.range).toMatch(/^du .+ 2026 au .+ 2026$/);
    const broken = buildHistoryRows([{ link_id: 'x', linked_at: 'nope', revoked_at: '2026-03-10T10:00:00Z' }])[0];
    expect(broken.range).toMatch(/^jusqu'au /);
    expect(buildHistoryRows([{ link_id: 'x', linked_at: 'nope', revoked_at: 'nope' }])[0].range).toBe('');
    expect(JSON.stringify(buildHistoryRows([item(1)]))).not.toContain('Invalid');
  });
});

describe('retrait sans punition (MCOA-03)', () => {
  it('confirmation : COACH, insensible aux espaces et a la casse', () => {
    expect(isRevokeConfirmed('COACH')).toBe(true);
    expect(isRevokeConfirmed('  coach ')).toBe(true);
    expect(isRevokeConfirmed('COACHS')).toBe(false);
    expect(isRevokeConfirmed('')).toBe(false);
  });
  it('corps de la modale : rassure (conserves, nouveau code), aucun mot punitif', () => {
    const body = revokeModalBody('Marie');
    expect(body).toContain('Marie');
    expect(body).toContain('conservés');
    expect(body).toContain('nouveau code');
    expect(body).not.toMatch(/supprim|perdu|définitiv|definitiv/i);
  });
  it('message de fin neutre avec historique conserve', () => {
    expect(revokeDoneMessage('Marie')).toBe("Tu n'es plus lié à Marie. Ton historique est conservé.");
  });
});
