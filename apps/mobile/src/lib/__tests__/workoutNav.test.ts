import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROGRAM_QUERY_KEYS, refreshProgramQueries, goToTrainingDashboard, TRAINING_DASHBOARD_ROUTE } from '../workoutNav';
import { validateWizardExercises, wizardActivationPlan, type ProgramItem } from '../programs';

const item = (over: Partial<ProgramItem>): ProgramItem => ({
  id: 'p', kind: 'ai', source: 'created', name: 'Mon programme', subtitle: '', isActive: true,
  status: 'active', createdAt: '', daysPerWeek: 3, progress: null, ...over,
});

describe('goToTrainingDashboard (UATN-03, bug onglet Entrainement)', () => {
  it('depile jusqu au tableau via dismissTo', () => {
    const router = { dismissTo: vi.fn(), replace: vi.fn() };
    goToTrainingDashboard(router);
    expect(router.dismissTo).toHaveBeenCalledWith('/(app)/workout');
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('repli replace sans dismissTo', () => {
    const router = { replace: vi.fn() };
    goToTrainingDashboard(router);
    expect(router.replace).toHaveBeenCalledWith(TRAINING_DASHBOARD_ROUTE);
  });
});

describe('refreshProgramQueries', () => {
  it('invalide programmes, programme actif (accueil + onglet) : la carte du 1er entrainement disparait', async () => {
    const qc = { invalidateQueries: vi.fn(async () => {}) };
    await refreshProgramQueries(qc);
    const keys = qc.invalidateQueries.mock.calls.map((c: any[]) => c[0].queryKey);
    expect(keys).toEqual(PROGRAM_QUERY_KEYS);
    expect(keys).toContainEqual(['program', 'active']); // useHomeData / useActiveAIProgram
    expect(keys).toContainEqual(['programs']);
  });
});

describe('validateWizardExercises (bug 3)', () => {
  it('bloque 0 exercice avec un message francais', () => {
    const r = validateWizardExercises([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/exercice/);
    expect(validateWizardExercises(['  ']).ok).toBe(false);
  });
  it('accepte au moins un exercice', () => {
    expect(validateWizardExercises(['Squat']).ok).toBe(true);
  });
});

describe('wizardActivationPlan (bug 2, decision : 1er programme auto-actif)', () => {
  it('aucun programme actif -> activation automatique', () => {
    expect(wizardActivationPlan(null)).toEqual({ kind: 'auto' });
  });
  it('un programme deja actif -> conserve + proposition d activer', () => {
    expect(wizardActivationPlan(item({ name: 'Force 5x5' }))).toEqual({ kind: 'offer', currentName: 'Force 5x5', canActivate: true });
  });
  it('programme coach actif -> pas d activation directe (A08 sur l ecran Programmes)', () => {
    expect(wizardActivationPlan(item({ source: 'coach' }))).toMatchObject({ kind: 'offer', canActivate: false });
  });
  it('lecture en erreur -> on ne devine pas', () => {
    expect(wizardActivationPlan('error')).toEqual({ kind: 'unknown' });
  });
});

describe('ecrans : creation / activation -> tableau Entrainement', () => {
  const read = (p: string) => readFileSync(resolve(__dirname, '../../../app/(app)', p), 'utf8');
  it('program-builder active le premier programme, notifie et revient au tableau', () => {
    const src = read('workout/program-builder.tsx');
    expect(src).toContain("setActiveProgram(supabase as any, 'ai', programId)");
    expect(src).toContain('goToTrainingDashboard(router)');
    expect(src).toContain('validateWizardExercises(exercises)');
    expect(src).toContain('refreshProgramQueries(queryClient)');
  });
  it('atelier : apres activation, retour au tableau (pas la liste Programmes)', () => {
    const src = read('workout/atelier.tsx');
    expect(src).toContain('goToTrainingDashboard(router)');
  });
  it('onglet Entrainement : tabPress ramene au tableau', () => {
    const src = read('_layout.tsx');
    expect(src).toMatch(/tabPress:[\s\S]*goToTrainingDashboard\(router\)/);
    expect(read('workout/_layout.tsx')).toContain("initialRouteName: 'index'");
  });
});
