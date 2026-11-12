// SUPP-04/05/07 : acces donnees du stack, des prises et des preferences de rappel (tables ziko_*, RLS own).
import { normalizeMoments, type Moment, type StackEntry } from './moments';
import { withDefaultPrefs, type ReminderPref } from './reminders';

/** Date locale AAAA-MM-JJ (jamais toISOString : decale d'un jour apres minuit en UTC+1/+2). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mapStackRow(row: any): StackEntry {
  return {
    id: String(row.id),
    supplementId: String(row.supplement_id),
    name: String(row.supplement?.name ?? ''),
    brandName: row.supplement?.brand?.name ?? null,
    dose: Number(row.dose),
    doseUnit: row.dose_unit ?? null,
    moments: normalizeMoments(row.moments),
  };
}

export async function fetchStack(supabase: any, userId: string): Promise<StackEntry[]> {
  const { data, error } = await supabase
    .from('ziko_user_supplement_stack')
    .select('id, supplement_id, dose, dose_unit, moments, created_at, supplement:ziko_supplements(id, name, serving_size, brand:ziko_supplement_brands(name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapStackRow);
}

export interface StackInput {
  supplementId: string;
  dose: number;
  doseUnit: string | null;
  moments: readonly Moment[];
}

/** Valide l'entree avant ecriture (la contrainte SQL la revalide). Retourne un message ou null. */
export function validateStackInput(input: StackInput): string | null {
  if (!(Number.isFinite(input.dose) && input.dose > 0)) return 'La dose doit être supérieure à 0.';
  if (normalizeMoments(input.moments).length === 0) return 'Choisis au moins un moment de prise.';
  return null;
}

/** Ajoute ou modifie (un produit n'existe qu'une fois dans le stack). */
export async function upsertStackItem(supabase: any, userId: string, input: StackInput): Promise<void> {
  const problem = validateStackInput(input);
  if (problem) throw new Error(problem);
  const { error } = await supabase.from('ziko_user_supplement_stack').upsert(
    {
      user_id: userId,
      supplement_id: input.supplementId,
      dose: input.dose,
      dose_unit: input.doseUnit,
      moments: normalizeMoments(input.moments),
    },
    { onConflict: 'user_id,supplement_id' },
  );
  if (error) throw error;
}

export async function removeStackItem(supabase: any, userId: string, supplementId: string): Promise<void> {
  const { error } = await supabase
    .from('ziko_user_supplement_stack')
    .delete()
    .eq('user_id', userId)
    .eq('supplement_id', supplementId);
  if (error) throw error;
}

export async function fetchStackItem(supabase: any, userId: string, supplementId: string): Promise<StackEntry | null> {
  const { data, error } = await supabase
    .from('ziko_user_supplement_stack')
    .select('id, supplement_id, dose, dose_unit, moments, supplement:ziko_supplements(id, name)')
    .eq('user_id', userId)
    .eq('supplement_id', supplementId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapStackRow(data) : null;
}

/** Cles "<supplementId>:<moment>" prises le jour `date`. */
export async function fetchIntakes(supabase: any, userId: string, date: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('ziko_supplement_intakes')
    .select('supplement_id, moment')
    .eq('user_id', userId)
    .eq('date', date);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => `${r.supplement_id}:${r.moment}`));
}

export async function setIntake(
  supabase: any,
  userId: string,
  supplementId: string,
  moment: Moment,
  date: string,
  taken: boolean,
): Promise<void> {
  if (taken) {
    const { error } = await supabase.from('ziko_supplement_intakes').upsert(
      { user_id: userId, supplement_id: supplementId, moment, date, taken_at: new Date().toISOString() },
      { onConflict: 'user_id,supplement_id,moment,date' },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('ziko_supplement_intakes')
      .delete()
      .eq('user_id', userId)
      .eq('supplement_id', supplementId)
      .eq('moment', moment)
      .eq('date', date);
    if (error) throw error;
  }
}

export async function fetchReminderPrefs(supabase: any, userId: string): Promise<ReminderPref[]> {
  const { data, error } = await supabase
    .from('ziko_supplement_reminder_prefs')
    .select('moment, enabled, remind_time')
    .eq('user_id', userId);
  if (error) throw error;
  return withDefaultPrefs(
    (data ?? []).map((r: any) => ({
      moment: r.moment as Moment,
      enabled: !!r.enabled,
      remindTime: typeof r.remind_time === 'string' ? r.remind_time.slice(0, 5) : undefined,
    })),
  );
}

export async function saveReminderPref(supabase: any, userId: string, pref: ReminderPref): Promise<void> {
  const { error } = await supabase.from('ziko_supplement_reminder_prefs').upsert(
    { user_id: userId, moment: pref.moment, enabled: pref.enabled, remind_time: pref.remindTime },
    { onConflict: 'user_id,moment' },
  );
  if (error) throw error;
}
