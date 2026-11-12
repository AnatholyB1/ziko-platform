// SUPP-04/05/07 : moments de prise (Matin / Midi / Soir), dose, regroupement "Aujourd'hui".

export type Moment = 'morning' | 'noon' | 'evening';

export const MOMENTS: readonly Moment[] = ['morning', 'noon', 'evening'] as const;

export const MOMENT_LABEL: Record<Moment, string> = {
  morning: 'Matin',
  noon: 'Midi',
  evening: 'Soir',
};

export const MOMENT_ICON: Record<Moment, 'sunny-outline' | 'partly-sunny-outline' | 'moon-outline'> = {
  morning: 'sunny-outline',
  noon: 'partly-sunny-outline',
  evening: 'moon-outline',
};

/** Heures de rappel par defaut (D-06). */
export const DEFAULT_REMINDER_TIME: Record<Moment, string> = {
  morning: '08:00',
  noon: '13:00',
  evening: '21:30',
};

export function isMoment(v: unknown): v is Moment {
  return v === 'morning' || v === 'noon' || v === 'evening';
}

/** Dedupe + ordre Matin, Midi, Soir ; ignore les valeurs inconnues. */
export function normalizeMoments(list: ReadonlyArray<unknown> | null | undefined): Moment[] {
  const set = new Set((list ?? []).filter(isMoment));
  return MOMENTS.filter((m) => set.has(m));
}

/** Ajoute ou retire un moment (puce multi-choix). */
export function toggleMoment(list: readonly Moment[], moment: Moment): Moment[] {
  return list.includes(moment) ? list.filter((m) => m !== moment) : normalizeMoments([...list, moment]);
}

/** "Matin", "Matin, Soir". */
export function formatMoments(list: readonly Moment[]): string {
  return normalizeMoments(list).map((m) => MOMENT_LABEL[m]).join(', ');
}

// ── Dose ────────────────────────────────────────────────

const INVARIABLE_UNITS = new Set(['g', 'mg', 'µg', 'mcg', 'ml', 'cl', 'ui', 'kg', 'l']);

/** "2 gélules", "5 g", "1 gélule", "2 doses". */
export function formatDose(dose: number, unit: string | null | undefined): string {
  const n = Number.isFinite(dose) && dose > 0 ? dose : 1;
  const label = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  const u = (unit ?? '').trim() || 'dose';
  const lower = u.toLowerCase();
  if (INVARIABLE_UNITS.has(lower)) return `${label} ${u}`;
  const base = lower.endsWith('s') ? u.slice(0, -1) : u;
  return `${label} ${n > 1 ? `${base}s` : base}`;
}

/**
 * Dose et unite par defaut depuis `serving_size` ("30 g", "2 gélules", "1 mesure (30 g)").
 * Repli : 1 dose.
 */
export function defaultDose(servingSize: string | null | undefined): { dose: number; unit: string } {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-ZÀ-ÿµ]+)/.exec(servingSize ?? '');
  if (!m) return { dose: 1, unit: 'dose' };
  const dose = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(dose) || dose <= 0) return { dose: 1, unit: 'dose' };
  let unit = m[2];
  if (!INVARIABLE_UNITS.has(unit.toLowerCase()) && unit.toLowerCase().endsWith('s')) unit = unit.slice(0, -1);
  return { dose, unit };
}

/** Pas du stepper : 1 par defaut, 5 pour les mg/µg. */
export function doseStep(unit: string | null | undefined): number {
  const u = (unit ?? '').toLowerCase();
  if (u === 'g' || u === 'ml' || u === 'cl') return 1;
  if (u === 'mg' || u === 'µg' || u === 'mcg') return 5;
  return 1;
}

export function stepDose(dose: number, unit: string | null | undefined, direction: 1 | -1): number {
  const step = doseStep(unit);
  const next = Math.round((dose + direction * step) * 100) / 100;
  return next < step ? step : next;
}

// ── Stack -> Aujourd'hui ────────────────────────────────

export interface StackEntry {
  id: string;
  supplementId: string;
  name: string;
  brandName?: string | null;
  dose: number;
  doseUnit: string | null;
  moments: Moment[];
}

export interface TodayRow {
  key: string; // supplementId:moment
  supplementId: string;
  moment: Moment;
  name: string;
  doseLabel: string;
  taken: boolean;
}

export interface TodayGroup {
  moment: Moment;
  rows: TodayRow[];
}

/** Cle d'une prise : "<supplementId>:<moment>". */
export const intakeKey = (supplementId: string, moment: Moment): string => `${supplementId}:${moment}`;

/**
 * Groupe les prises du jour par moment (uniquement les moments non vides).
 * `taken` = ensemble de cles intakeKey deja cochees.
 */
export function buildTodayGroups(stack: readonly StackEntry[], taken: ReadonlySet<string>): TodayGroup[] {
  return MOMENTS.map((moment) => ({
    moment,
    rows: stack
      .filter((s) => s.moments.includes(moment))
      .map((s) => ({
        key: intakeKey(s.supplementId, moment),
        supplementId: s.supplementId,
        moment,
        name: s.name,
        doseLabel: formatDose(s.dose, s.doseUnit),
        taken: taken.has(intakeKey(s.supplementId, moment)),
      })),
  })).filter((g) => g.rows.length > 0);
}

/** "3 sur 5 pris". */
export function formatProgress(groups: readonly TodayGroup[]): { taken: number; total: number; label: string } {
  const rows = groups.flatMap((g) => g.rows);
  const taken = rows.filter((r) => r.taken).length;
  return { taken, total: rows.length, label: `${taken} sur ${rows.length} pris` };
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** "Jeudi 12 nov." (sans Intl : Hermes/Android ne l'embarque pas toujours en fr). */
export function formatDayLabel(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
