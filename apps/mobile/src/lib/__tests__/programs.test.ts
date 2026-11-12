import { describe, it, expect } from 'vitest';
import {
  buildProgramList,
  filterPrograms,
  countByFilter,
  countActive,
  menuActionsFor,
  needsCoachConfirmation,
  duplicateName,
  validateProgramName,
  deleteConfirmationText,
  activationToast,
  buildWizardProgramRow,
  wizardSessionSummaries,
  PROGRAM_RULE_TEXT,
} from '../programs';

const ME = 'user-1';
const COACH = 'coach-1';

const workoutRows = [
  { id: 'w-coach', user_id: null, assigned_to_user_id: ME, created_by_coach_id: COACH, name: 'Force 5x5, bloc 2', days_per_week: 3, is_active: true, created_at: '2026-10-01T00:00:00Z', current_cycle_week: 3, weeks_count: 8, is_template: false },
  { id: 'w-mine', user_id: ME, assigned_to_user_id: null, created_by_coach_id: null, name: 'Mon full body', days_per_week: 3, is_active: false, created_at: '2026-09-01T00:00:00Z', is_template: false },
  { id: 'w-tpl', user_id: null, assigned_to_user_id: null, name: 'Template', is_active: false, created_at: '2026-01-01T00:00:00Z', is_template: true },
];
const aiRows = [
  { id: 'a-ppl', user_id: ME, name: 'Hypertrophie Push Pull Legs', days_per_week: 6, is_active: false, created_at: '2026-10-20T00:00:00Z', program_data: {} },
  { id: 'a-wiz', user_id: ME, name: 'Force - 3 séances', days_per_week: 3, is_active: false, created_at: '2026-11-01T00:00:00Z', program_data: { generated: true } },
];

describe('buildProgramList (TRAIN-06, A-1)', () => {
  const items = buildProgramList(workoutRows, aiRows, ME);

  it('lists programs from both tables, excludes templates', () => {
    expect(items.map((i) => i.id).sort()).toEqual(['a-ppl', 'a-wiz', 'w-coach', 'w-mine']);
  });
  it('classifies sources: coach / ai / created', () => {
    const by = Object.fromEntries(items.map((i) => [i.id, i.source]));
    expect(by).toEqual({ 'w-coach': 'coach', 'w-mine': 'created', 'a-ppl': 'ai', 'a-wiz': 'created' });
  });
  it('puts the active program first with exactly one ACTIF', () => {
    expect(items[0].id).toBe('w-coach');
    expect(countActive(items)).toBe(1);
  });
  it('computes progress only when real data exists', () => {
    expect(items[0].progress).toEqual({ week: 3, total: 8, percent: 38 });
    expect(items.find((i) => i.id === 'a-ppl')!.progress).toBeNull();
  });
  it('empty input yields an empty list and 0 active', () => {
    const e = buildProgramList([], [], ME);
    expect(e).toEqual([]);
    expect(countActive(e)).toBe(0);
  });
  it('defends 0-or-1 ACTIF when legacy duplicates come back (keeps the most recent)', () => {
    const dup = buildProgramList(
      [{ ...workoutRows[0] }],
      [{ ...aiRows[0], is_active: true, created_at: '2026-11-05T00:00:00Z' }],
      ME,
    );
    expect(countActive(dup)).toBe(1);
    expect(dup[0].id).toBe('a-ppl');
  });
  it('falls back to a placeholder name', () => {
    const l = buildProgramList([], [{ id: 'x', name: '  ', is_active: false, created_at: 'z', program_data: {} }], ME);
    expect(l[0].name).toBe('Programme sans nom');
  });
});

describe('filters', () => {
  const items = buildProgramList(workoutRows, aiRows, ME);
  it('counts and filters per tab', () => {
    expect(countByFilter(items)).toEqual({ all: 4, ai: 1, coach: 1, created: 2 });
    expect(filterPrograms(items, 'coach').map((i) => i.id)).toEqual(['w-coach']);
    expect(filterPrograms(items, 'all')).toHaveLength(4);
  });
});

describe('menu (TRAIN-08, A-3)', () => {
  const items = buildProgramList(workoutRows, aiRows, ME);
  const get = (id: string) => items.find((i) => i.id === id)!;
  it('active program: no activation entry', () => {
    expect(menuActionsFor(get('w-coach'))).not.toContain('activate');
    expect(menuActionsFor({ ...get('a-ppl'), isActive: true })).toEqual(['duplicate', 'rename', 'delete']);
  });
  it('inactive program: activation is first, then duplicate, delete last', () => {
    expect(menuActionsFor(get('a-ppl'))).toEqual(['activate', 'duplicate', 'delete']);
  });
  it('coach program cannot be renamed nor deleted (D-08)', () => {
    expect(menuActionsFor({ ...get('w-coach'), isActive: false })).toEqual(['activate', 'duplicate']);
    expect(menuActionsFor(get('w-coach'))).toEqual(['duplicate']);
  });
});

describe('conflict rule (TRAIN-07, Q2)', () => {
  const items = buildProgramList(workoutRows, aiRows, ME);
  it('asks confirmation when a non-coach program replaces the active coach program', () => {
    expect(needsCoachConfirmation(items, items.find((i) => i.id === 'a-ppl')!)).toBe(true);
    expect(needsCoachConfirmation(items, items.find((i) => i.id === 'w-mine')!)).toBe(true);
  });
  it('no confirmation when the active one is not the coach', () => {
    const noCoach = buildProgramList([{ ...workoutRows[1], is_active: true }], aiRows, ME);
    expect(needsCoachConfirmation(noCoach, noCoach.find((i) => i.id === 'a-ppl')!)).toBe(false);
  });
  it('no confirmation for the active program itself or for a coach program', () => {
    expect(needsCoachConfirmation(items, items[0])).toBe(false);
    const coachInactive = buildProgramList([{ ...workoutRows[0], is_active: false }, { ...workoutRows[1], is_active: true }], [], ME);
    expect(needsCoachConfirmation(coachInactive, coachInactive.find((i) => i.id === 'w-coach')!)).toBe(false);
  });
  it('rule text matches the contract', () => {
    expect(PROGRAM_RULE_TEXT).toBe("Un seul programme est actif à la fois. En activer un autre met l'actuel en pause.");
  });
});

describe('names and microcopy', () => {
  it('duplicateName numbers copies', () => {
    expect(duplicateName('Mon full body', [])).toBe('Mon full body (copie)');
    expect(duplicateName('Mon full body', ['Mon full body (copie)'])).toBe('Mon full body (copie 2)');
    expect(duplicateName('Mon full body (copie)', ['Mon full body (copie)'])).toBe('Mon full body (copie 2)');
  });
  it('validateProgramName', () => {
    expect(validateProgramName('   ')).toMatchObject({ ok: false });
    expect(validateProgramName('  Mon   plan ')).toEqual({ ok: true, name: 'Mon plan' });
    expect(validateProgramName('x'.repeat(81))).toMatchObject({ ok: false });
  });
  it('contract strings', () => {
    expect(deleteConfirmationText('Mon plan')).toBe("Supprimer 'Mon plan' ? Cette action est définitive.");
    expect(activationToast('Hypertrophie PPL')).toBe('Programme actif : Hypertrophie PPL');
  });
});

describe('wizard output (TRAIN-09, D-10)', () => {
  const row = buildWizardProgramRow(ME, { goal: 'strength', weeks: 8, selectedDays: [4, 0, 2, 2], exercises: ['Squat', 'Développé couché'] });
  it('fills the NOT NULL columns the old insert omitted and is inactive', () => {
    expect(row.name).toBe('Force · 3 séances/sem');
    expect(row.split_type).toBe('custom');
    expect(row.days_per_week).toBe(3);
    expect(row.is_active).toBe(false);
    expect(row.user_id).toBe(ME);
  });
  it('produces sessions the P6 planner understands, one per distinct day', () => {
    const s = wizardSessionSummaries(row.program_data);
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.dayIndex)).toEqual([0, 2, 4]);
    expect(s.every((x) => x.exerciseCount === 2)).toBe(true);
    expect(row.program_data.weeks).toHaveLength(8);
  });
  it('works without exercises (sessions exist, empty)', () => {
    const r = buildWizardProgramRow(ME, { goal: 'wellness', weeks: 4, selectedDays: [1], exercises: [] });
    expect(r.name).toBe('Bien-être · 1 séance/sem');
    expect(wizardSessionSummaries(r.program_data)).toHaveLength(1);
  });
});
