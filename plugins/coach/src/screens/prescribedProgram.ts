// P25 (MCOA-04) : programme prescrit par le coach, vu depuis Mon coach. Logique pure + lecture avec
// client injecte (testable). Regle d'ecrasement (P7) : l'athlete PEUT remplacer le programme du coach
// par un autre, jamais d'activation automatique ; reprendre celui du coach remplace l'actif actuel
// apres confirmation. Activation = RPC `ziko_set_active_program` (seul chemin d'ecriture de is_active).

export interface PrescribedRow {
  id: string;
  name?: string | null;
  days_per_week?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  current_cycle_week?: number | null;
  cycle_weeks?: number | null;
  weeks_count?: number | null;
  created_by_coach_id?: string | null;
  assigned_to_user_id?: string | null;
  is_template?: boolean | null;
}

/** Sous-ensemble de `ProgramItem` (apps/mobile/src/lib/programs.ts) dont on a besoin. */
export interface ActiveCandidate {
  id: string;
  kind: 'workout' | 'ai';
  name: string;
  isActive: boolean;
}

export type PrescribedStatus = 'active' | 'replaced' | 'available';

export interface PrescribedView {
  id: string;
  name: string;
  status: PrescribedStatus;
  /** "3 séances par semaine · semaine 2/8" (champs absents omis). */
  subtitle: string;
  /** Nom du programme actif qui serait remplace en reprenant celui du coach (statut `replaced`). */
  replacesName: string | null;
}

export const PRESCRIBED_FALLBACK_NAME = 'Programme de ton coach';

export const STATUS_LABEL: Record<PrescribedStatus, string> = {
  active: 'Actif',
  replaced: 'Remplacé par ton programme',
  available: 'Disponible',
};

/** Le plus recent programme NON template assigne a l'athlete PAR son coach actuel. */
export function selectPrescribed(rows: PrescribedRow[] | null | undefined, userId: string, coachId: string): PrescribedRow | null {
  const mine = (rows ?? []).filter(
    (r) =>
      r.assigned_to_user_id === userId &&
      r.created_by_coach_id === coachId &&
      r.is_template !== true,
  );
  if (mine.length === 0) return null;
  return [...mine].sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '') || 0)[0];
}

function subtitleOf(row: PrescribedRow): string {
  const parts: string[] = [];
  const days = Number(row.days_per_week);
  if (Number.isFinite(days) && days > 0) parts.push(`${days} séance${days > 1 ? 's' : ''} par semaine`);
  const total = Number(row.weeks_count ?? row.cycle_weeks);
  const week = Number(row.current_cycle_week);
  if (Number.isFinite(total) && total > 0 && Number.isFinite(week) && week >= 1) {
    parts.push(`semaine ${Math.min(week, total)}/${total}`);
  }
  return parts.join(' · ');
}

export function prescribedProgramView(row: PrescribedRow | null, items: ActiveCandidate[]): PrescribedView | null {
  if (!row) return null;
  const otherActive = items.find((i) => i.isActive && !(i.kind === 'workout' && i.id === row.id)) ?? null;
  const status: PrescribedStatus = row.is_active === true ? 'active' : otherActive ? 'replaced' : 'available';
  return {
    id: row.id,
    name: row.name?.trim() || PRESCRIBED_FALLBACK_NAME,
    status,
    subtitle: subtitleOf(row),
    replacesName: row.is_active === true ? null : otherActive?.name ?? null,
  };
}

/** Reprendre le programme du coach demande une confirmation des qu'un autre programme est actif. */
export function needsReplaceConfirmation(view: PrescribedView): boolean {
  return view.status === 'replaced' && view.replacesName !== null;
}

export function replaceConfirmCopy(view: PrescribedView): { title: string; message: string } {
  return {
    title: `Remplacer "${view.replacesName ?? 'ton programme actuel'}" ?`,
    message: 'Ton programme actuel sera mis en pause. Tu pourras le reprendre depuis Mes programmes.',
  };
}

type Client = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

/** Lecture seule ; l'erreur est remontee (l'ecran affiche "Reessayer", jamais un faux programme). */
export async function loadPrescribedRow(client: Client, userId: string, coachId: string): Promise<PrescribedRow | null> {
  const { data, error } = await client
    .from('ziko_workout_programs')
    .select('id,name,days_per_week,is_active,created_at,current_cycle_week,cycle_weeks,weeks_count,created_by_coach_id,assigned_to_user_id,is_template')
    .eq('assigned_to_user_id', userId)
    .eq('created_by_coach_id', coachId)
    .eq('is_template', false)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message || 'Impossible de charger le programme');
  return selectPrescribed((data ?? []) as PrescribedRow[], userId, coachId);
}

/**
 * Programmes actuellement actifs de l'athlete (les 2 tables : P7 garantit 0 ou 1 actif). Lecture seule ;
 * une erreur est remontee (l'ecran ne devine pas un statut "disponible" sans savoir).
 */
export async function loadActiveCandidates(client: Client, userId: string): Promise<ActiveCandidate[]> {
  const [w, a] = await Promise.all([
    client
      .from('ziko_workout_programs')
      .select('id,name')
      .or(`user_id.eq.${userId},assigned_to_user_id.eq.${userId}`)
      .eq('is_template', false)
      .eq('is_active', true),
    client.from('ziko_ai_generated_programs').select('id,name').eq('user_id', userId).eq('is_active', true),
  ]);
  if (w.error) throw new Error(w.error.message || 'Impossible de charger le programme');
  if (a.error) throw new Error(a.error.message || 'Impossible de charger le programme');
  return [
    ...((w.data ?? []) as { id: string; name?: string | null }[]).map((r) => ({ id: r.id, kind: 'workout' as const, name: r.name?.trim() || 'Mon programme', isActive: true })),
    ...((a.data ?? []) as { id: string; name?: string | null }[]).map((r) => ({ id: r.id, kind: 'ai' as const, name: r.name?.trim() || 'Mon programme', isActive: true })),
  ];
}

/** Seul chemin d'ecriture : la RPC (verifie la propriete, desactive les autres dans la meme transaction). */
export async function resumePrescribed(client: Client, programId: string): Promise<void> {
  const { error } = await client.rpc('ziko_set_active_program', { p_kind: 'workout', p_program_id: programId });
  if (error) throw new Error(error.message || "Impossible d'activer ce programme");
}
