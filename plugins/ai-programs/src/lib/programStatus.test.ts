import { describe, it, expect } from 'vitest';
import { getProgramDisplayName, getProgramProgressPct, getProgramStatus } from './programStatus';

const base = { is_active: false, created_at: '2026-11-13T10:00:00Z', program_data: {} as any };
const fmt = () => '13/11/2026';

describe('getProgramDisplayName (P7 run4)', () => {
  it('utilise la colonne name en priorite', () => {
    expect(getProgramDisplayName({ ...base, name: ' Pic de force 8 sem ', program_data: { name: 'autre' } }, fmt)).toBe('Pic de force 8 sem');
  });
  it('puis program_data.name, puis le libelle date', () => {
    expect(getProgramDisplayName({ ...base, name: '', program_data: { name: 'Bloc volume' } }, fmt)).toBe('Bloc volume');
    expect(getProgramDisplayName({ ...base, name: null }, fmt)).toBe('Programme 13/11/2026');
  });
});

describe('getProgramStatus (P7 run4)', () => {
  it('jamais demarre : PAS "Termine 100 %"', () => {
    const s = getProgramStatus(base);
    expect(s).toEqual({ kind: 'unstarted', label: 'Pas encore démarré', progress: 0 });
  });
  it('termine uniquement avec completed_at', () => {
    expect(getProgramStatus({ ...base, started_at: 'x', completed_at: '2026-11-01T00:00:00Z' })).toMatchObject({ kind: 'completed', label: 'Terminé', progress: 100 });
  });
  it('demarre puis desactive : en pause, avancement des seances faites', () => {
    const p = { ...base, started_at: 'x', program_data: { sessions: [{ completed: true }, { completed: false }] } };
    expect(getProgramStatus(p)).toMatchObject({ kind: 'paused', progress: 50 });
  });
  it('actif : en cours, 0 % sans seance cochee (aucun pourcentage invente) ; ancien completed_at ignore', () => {
    expect(getProgramStatus({ ...base, is_active: true })).toMatchObject({ kind: 'active', progress: 0 });
    expect(getProgramStatus({ ...base, is_active: true, completed_at: '2026-10-01T00:00:00Z' })).toMatchObject({ kind: 'active', progress: 0 });
  });
});

describe('getProgramProgressPct', () => {
  it('0 sans donnees', () => {
    expect(getProgramProgressPct(base)).toBe(0);
  });
});
