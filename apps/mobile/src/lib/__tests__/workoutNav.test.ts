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
  it('texte libre non reconnu dans le catalogue : bloque meme avec des exercices valides', () => {
    const r = validateWizardExercises(['Squat'], 'Zercher carry');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.title).toBe('Exercice non reconnu');
      expect(r.message).toContain('Zercher carry');
    }
    expect(validateWizardExercises(['Squat'], null).ok).toBe(true);
    expect(validateWizardExercises(['Squat'], '  ').ok).toBe(true);
  });
  it('program-builder : suggestions, erreur inline, texte libre bloque, aucun composant defini dans le rendu', () => {
    const src = readFileSync(resolve(__dirname, '../../../app/(app)/workout/program-builder.tsx'), 'utf8');
    expect(src).toContain('suggestExercises(');
    expect(src).toContain('testID="exercise-entry-error"');
    expect(src).toContain('testID={`exercise-suggestion-${i}`}');
    expect(src).toContain('disabled={!canContinue() || isSaving}');
    // le texte libre n'est jamais ajoute tel quel : seul un libelle du catalogue entre dans la liste
    expect(src).not.toMatch(/setExercises\(\(prev\) => \[\.\.\.prev, trimmed\]\)/);
    // StepN() et non <StepN /> : un composant inline remonte le TextInput a chaque frappe (perte de focus)
    expect(src).not.toMatch(/<Step[1-4] \/>/);
  });
  it('program-builder : clavier ouvert, le pied reste atteignable (KeyboardAvoidingView + ScrollView handled)', () => {
    const src = readFileSync(resolve(__dirname, '../../../app/(app)/workout/program-builder.tsx'), 'utf8');
    const kav = src.indexOf('<KeyboardAvoidingView');
    const scroll = src.indexOf('<ScrollView');
    const cta = src.indexOf("'Creer mon programme'");
    const kavEnd = src.indexOf('</KeyboardAvoidingView>');
    // le ScrollView ET le bouton principal sont DANS le KeyboardAvoidingView
    expect(kav).toBeGreaterThan(-1);
    expect(kav).toBeLessThan(scroll);
    expect(scroll).toBeLessThan(kavEnd);
    expect(cta).toBeLessThan(kavEnd);
    expect(src).toMatch(/behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
    expect(src).toContain('keyboardShouldPersistTaps="handled"');
    // le pied n'est pas DANS le ScrollView (sinon il defile hors ecran)
    const scrollEnd = src.indexOf('</ScrollView>');
    expect(cta).toBeGreaterThan(scrollEnd);
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
    expect(src).toContain('validateWizardExercises(finalExercises, blockedEntry)');
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
