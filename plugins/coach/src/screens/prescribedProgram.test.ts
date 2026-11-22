import { describe, it, expect, vi } from 'vitest';
import {
  selectPrescribed,
  prescribedProgramView,
  needsReplaceConfirmation,
  replaceConfirmCopy,
  loadPrescribedRow,
  loadActiveCandidates,
  resumePrescribed,
  PRESCRIBED_FALLBACK_NAME,
  type PrescribedRow,
} from './prescribedProgram';

const ME = 'athlete-1';
const COACH = 'coach-1';

const row = (o: Partial<PrescribedRow> = {}): PrescribedRow => ({
  id: 'p1',
  name: 'Force 8 semaines',
  days_per_week: 3,
  is_active: false,
  created_at: '2026-10-01T10:00:00Z',
  assigned_to_user_id: ME,
  created_by_coach_id: COACH,
  is_template: false,
  ...o,
});

describe('selectPrescribed (MCOA-04)', () => {
  it('garde uniquement les programmes assignes A l athlete PAR son coach, non templates', () => {
    const rows = [
      row({ id: 'other-coach', created_by_coach_id: 'coach-2' }),
      row({ id: 'other-athlete', assigned_to_user_id: 'athlete-2' }),
      row({ id: 'tpl', is_template: true }),
      row({ id: 'ok' }),
    ];
    expect(selectPrescribed(rows, ME, COACH)?.id).toBe('ok');
  });
  it('le plus recent gagne ; aucun -> null', () => {
    const rows = [row({ id: 'old', created_at: '2026-01-01T00:00:00Z' }), row({ id: 'new', created_at: '2026-10-05T00:00:00Z' })];
    expect(selectPrescribed(rows, ME, COACH)?.id).toBe('new');
    expect(selectPrescribed([], ME, COACH)).toBeNull();
    expect(selectPrescribed(null, ME, COACH)).toBeNull();
  });
});

describe('prescribedProgramView : regle d ecrasement (P7)', () => {
  it('programme du coach actif -> active, rien a remplacer', () => {
    const v = prescribedProgramView(row({ is_active: true }), [{ id: 'p1', kind: 'workout', name: 'x', isActive: true }])!;
    expect(v.status).toBe('active');
    expect(v.replacesName).toBeNull();
    expect(needsReplaceConfirmation(v)).toBe(false);
  });
  it('l athlete a active un autre programme -> replaced (ecrasement autorise), confirmation exigee avec le nom', () => {
    const v = prescribedProgramView(row(), [
      { id: 'p1', kind: 'workout', name: 'Force 8 semaines', isActive: false },
      { id: 'mine', kind: 'workout', name: 'Mon split', isActive: true },
    ])!;
    expect(v.status).toBe('replaced');
    expect(v.replacesName).toBe('Mon split');
    expect(needsReplaceConfirmation(v)).toBe(true);
    expect(replaceConfirmCopy(v).title).toBe('Remplacer "Mon split" ?');
  });
  it('un programme IA actif compte aussi comme remplacant', () => {
    const v = prescribedProgramView(row(), [{ id: 'ai1', kind: 'ai', name: 'Atelier IA', isActive: true }])!;
    expect(v.status).toBe('replaced');
  });
  it('aucun programme actif -> available, reprise sans confirmation', () => {
    const v = prescribedProgramView(row(), [{ id: 'mine', kind: 'workout', name: 'Mon split', isActive: false }])!;
    expect(v.status).toBe('available');
    expect(needsReplaceConfirmation(v)).toBe(false);
  });
  it('pas de programme -> null (la carte affiche l etat vide)', () => {
    expect(prescribedProgramView(null, [])).toBeNull();
  });
  it('sous-titre : seances/semaine + semaine x/y, champs absents omis, jamais NaN/undefined', () => {
    expect(prescribedProgramView(row({ current_cycle_week: 2, weeks_count: 8 }), [])!.subtitle).toBe('3 séances par semaine · semaine 2/8');
    expect(prescribedProgramView(row({ days_per_week: 1 }), [])!.subtitle).toBe('1 séance par semaine');
    expect(prescribedProgramView(row({ days_per_week: null }), [])!.subtitle).toBe('');
    const weird = prescribedProgramView(row({ days_per_week: null, current_cycle_week: 3, cycle_weeks: null, weeks_count: null }), [])!.subtitle;
    expect(weird).not.toMatch(/NaN|undefined|null/);
  });
  it('nom vide -> libelle de repli', () => {
    expect(prescribedProgramView(row({ name: '  ' }), [])!.name).toBe(PRESCRIBED_FALLBACK_NAME);
  });
  it('semaine au-dela du total plafonnee', () => {
    expect(prescribedProgramView(row({ current_cycle_week: 12, weeks_count: 8 }), [])!.subtitle).toContain('semaine 8/8');
  });
});

describe('acces donnees (client injecte)', () => {
  it('loadPrescribedRow filtre assigned_to_user_id, created_by_coach_id, non template', async () => {
    const eqs: [string, unknown][] = [];
    const chain: any = {
      select: () => chain,
      eq: (c: string, v: unknown) => (eqs.push([c, v]), chain),
      order: () => chain,
      limit: async () => ({ data: [row()], error: null }),
    };
    const client = { from: vi.fn(() => chain), rpc: vi.fn() };
    const out = await loadPrescribedRow(client, ME, COACH);
    expect(client.from).toHaveBeenCalledWith('ziko_workout_programs');
    expect(eqs).toEqual([['assigned_to_user_id', ME], ['created_by_coach_id', COACH], ['is_template', false]]);
    expect(out?.id).toBe('p1');
  });
  it('erreur base remontee (jamais un faux programme)', async () => {
    const chain: any = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: null, error: { message: 'rls' } }) };
    await expect(loadPrescribedRow({ from: () => chain, rpc: vi.fn() }, ME, COACH)).rejects.toThrow('rls');
  });
  it('resumePrescribed : UNIQUEMENT la RPC ziko_set_active_program (kind workout), aucun update direct', async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const from = vi.fn();
    await resumePrescribed({ from, rpc }, 'p1');
    expect(rpc).toHaveBeenCalledWith('ziko_set_active_program', { p_kind: 'workout', p_program_id: 'p1' });
    expect(from).not.toHaveBeenCalled();
    await expect(resumePrescribed({ from, rpc: async () => ({ error: { message: 'program not found' } }) }, 'p1')).rejects.toThrow('program not found');
  });
  it('loadActiveCandidates : actifs des 2 tables (workout + ia), nom de repli, erreur remontee', async () => {
    const mk = (data: any, error: any = null) => {
      const chain: any = { select: () => chain, or: () => chain, eq: () => chain, then: (r: any) => r({ data, error }) };
      return chain;
    };
    const tables: Record<string, any> = {
      ziko_workout_programs: mk([{ id: 'w1', name: 'Mon split' }]),
      ziko_ai_generated_programs: mk([{ id: 'a1', name: null }]),
    };
    const out = await loadActiveCandidates({ from: (t: string) => tables[t], rpc: vi.fn() }, ME);
    expect(out).toEqual([
      { id: 'w1', kind: 'workout', name: 'Mon split', isActive: true },
      { id: 'a1', kind: 'ai', name: 'Mon programme', isActive: true },
    ]);
    tables.ziko_ai_generated_programs = mk(null, { message: 'boom' });
    await expect(loadActiveCandidates({ from: (t: string) => tables[t], rpc: vi.fn() }, ME)).rejects.toThrow('boom');
  });
});
