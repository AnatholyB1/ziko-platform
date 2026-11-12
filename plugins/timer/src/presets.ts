// Phase 20 : logique pure des presets Timer (aucune dependance RN, testable en node).

export type TimerTab = 'Séance' | 'Tabata' | 'Intervalle';
export const TIMER_TABS: TimerTab[] = ['Séance', 'Tabata', 'Intervalle'];

export type PresetType = 'hiit' | 'tabata' | 'emom' | 'rest' | 'custom' | 'hyrox' | 'functional';

export interface PresetFields {
  name: string;
  type: string;
  warmup_sec: number;
  work_sec: number;
  rest_sec: number;
  sets: number;
  rounds: number;
  round_rest_sec: number;
}

/** Ligne `ziko_timer_presets` telle que lue en base (colonnes recentes optionnelles : anciennes lignes). */
export interface PresetRow {
  id: string;
  name: string;
  type: string;
  work_sec: number | null;
  rest_sec: number | null;
  rounds: number | null;
  warmup_sec?: number | null;
  sets?: number | null;
  round_rest_sec?: number | null;
  exercises?: unknown;
}

export interface TimerPresetItem extends PresetFields {
  id: string;
  exercises: unknown[];
}

// Q-P20b : Séance = custom, Tabata = tabata, Intervalle = tous les autres (rien ne disparait).
export function tabForType(type: string): TimerTab {
  if (type === 'custom') return 'Séance';
  if (type === 'tabata') return 'Tabata';
  return 'Intervalle';
}

/** Type enregistre pour un NOUVEAU preset selon l'onglet. */
export function typeForTab(tab: TimerTab): PresetType {
  if (tab === 'Séance') return 'custom';
  if (tab === 'Tabata') return 'tabata';
  return 'hiit';
}

export function rowToPreset(row: PresetRow): TimerPresetItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    warmup_sec: row.warmup_sec ?? 0,
    work_sec: row.work_sec ?? 0,
    rest_sec: row.rest_sec ?? 0,
    sets: row.sets ?? 1,
    rounds: row.rounds ?? 1,
    round_rest_sec: row.round_rest_sec ?? 0,
    exercises: Array.isArray(row.exercises) ? row.exercises : [],
  };
}

type DurationFields = Pick<PresetFields, 'warmup_sec' | 'work_sec' | 'rest_sec' | 'sets' | 'rounds' | 'round_rest_sec'>;

/**
 * D-03 (maquette C22 fait foi) :
 * echauffement + rounds x series x (effort + repos) + (rounds - 1) x repos entre rounds.
 * C22 : 300 + 3 x 6 x (90 + 60) + 2 x 120 = 3240 s = 54 min.
 */
export function totalDuration(p: DurationFields): number {
  const rounds = Math.max(1, p.rounds);
  const sets = Math.max(1, p.sets);
  return p.warmup_sec + rounds * sets * (p.work_sec + p.rest_sec) + (rounds - 1) * p.round_rest_sec;
}

/** 90 -> "1 min 30", 60 -> "1 min", 45 -> "45 s", 0 -> "0 s". */
export function formatDurationShort(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  if (r === 0) return `${m} min`;
  return `${m} min ${r.toString().padStart(2, '0')}`;
}

/** Duree totale affichee : "54 min", "1 h 05", "45 s". */
export function formatTotal(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s} s`;
  const mins = Math.ceil(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, '0')}`;
}

/** Resume chiffre d'une ligne de la liste. */
export function presetSummary(p: PresetFields): string {
  const parts: string[] = [];
  if (p.work_sec > 0) parts.push(`${formatDurationShort(p.work_sec)} effort`);
  if (p.rest_sec > 0) parts.push(`${formatDurationShort(p.rest_sec)} repos`);
  const tab = tabForType(p.type);
  if (tab === 'Séance') {
    parts.push(`${p.sets} série${p.sets > 1 ? 's' : ''}`);
  } else {
    parts.push(`${p.rounds} round${p.rounds > 1 ? 's' : ''}`);
    if (p.sets > 1) parts.push(`${p.sets} séries`);
  }
  return parts.join(' · ');
}

// ── Bornes (UI ; le CHECK de la migration est un sous-ensemble) ────────────────
export const LIMITS = {
  nameMax: 60,
  warmup: { min: 0, max: 1800, step: 15 },
  work: { min: 5, max: 3600, step: 5 },
  rest: { min: 0, max: 3600, step: 5 },
  sets: { min: 1, max: 50, step: 1 },
  rounds: { min: 1, max: 99, step: 1 },
  roundRest: { min: 0, max: 3600, step: 15 },
} as const;

export type EditorField = 'warmup_sec' | 'work_sec' | 'rest_sec' | 'sets' | 'rounds' | 'round_rest_sec';

/** D-02 : l'onglet Séance n'expose que repos + séries (les autres champs sont absents). */
export function fieldsForTab(tab: TimerTab): EditorField[] {
  if (tab === 'Séance') return ['rest_sec', 'sets'];
  return ['warmup_sec', 'work_sec', 'rest_sec', 'sets', 'rounds', 'round_rest_sec'];
}

const FIELD_LIMITS: Record<EditorField, { min: number; max: number; step: number }> = {
  warmup_sec: LIMITS.warmup,
  work_sec: LIMITS.work,
  rest_sec: LIMITS.rest,
  sets: LIMITS.sets,
  rounds: LIMITS.rounds,
  round_rest_sec: LIMITS.roundRest,
};

export function limitsFor(field: EditorField) {
  return FIELD_LIMITS[field];
}

export function clampField(field: EditorField, value: number): number {
  const l = FIELD_LIMITS[field];
  if (!Number.isFinite(value)) return l.min;
  return Math.min(l.max, Math.max(l.min, Math.round(value)));
}

export function stepField(field: EditorField, value: number, direction: 1 | -1, multiplier = 1): number {
  return clampField(field, value + direction * FIELD_LIMITS[field].step * multiplier);
}

export interface ValidationResult {
  ok: boolean;
  errors: Partial<Record<'name' | EditorField, string>>;
}

export function validatePreset(p: PresetFields, tab: TimerTab): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  const name = p.name.trim();
  if (name.length === 0) errors.name = 'Donne un nom au preset.';
  else if (name.length > LIMITS.nameMax) errors.name = `Maximum ${LIMITS.nameMax} caractères.`;
  for (const f of fieldsForTab(tab)) {
    const l = FIELD_LIMITS[f];
    const v = p[f];
    if (!Number.isInteger(v) || v < l.min || v > l.max) errors[f] = `Entre ${l.min} et ${l.max}.`;
  }
  if (tab === 'Séance' && !errors.rest_sec && p.rest_sec <= 0) errors.rest_sec = 'Le repos doit être supérieur à 0.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Valeurs initiales d'un nouveau preset (saisie utilisateur, jamais persistees sans action). */
export function defaultsForTab(tab: TimerTab): PresetFields {
  const type = typeForTab(tab);
  if (tab === 'Séance') return { name: '', type, warmup_sec: 0, work_sec: 0, rest_sec: 90, sets: 4, rounds: 1, round_rest_sec: 0 };
  if (tab === 'Tabata') return { name: '', type, warmup_sec: 0, work_sec: 20, rest_sec: 10, sets: 1, rounds: 8, round_rest_sec: 0 };
  return { name: '', type, warmup_sec: 0, work_sec: 45, rest_sec: 15, sets: 1, rounds: 10, round_rest_sec: 0 };
}

/** Normalise les champs non exposes par l'onglet Séance (effort 0, 1 round, pas d'echauffement). */
export function normalizeForTab(p: PresetFields, tab: TimerTab): PresetFields {
  const base = { ...p, name: p.name.trim() };
  if (tab === 'Séance') return { ...base, warmup_sec: 0, work_sec: 0, rounds: 1, round_rest_sec: 0 };
  return base;
}

/** Payload d'ecriture Supabase (colonnes ziko_timer_presets). `exercises` jamais touche. */
export function toDbPayload(p: PresetFields) {
  return {
    name: p.name,
    type: p.type,
    warmup_sec: p.warmup_sec,
    work_sec: p.work_sec,
    rest_sec: p.rest_sec,
    sets: p.sets,
    rounds: p.rounds,
    round_rest_sec: p.round_rest_sec,
  };
}

export function duplicateName(name: string): string {
  const base = `${name} (copie)`;
  return base.length > LIMITS.nameMax ? `${name.slice(0, LIMITS.nameMax - 9)} (copie)` : base;
}

// ── Moteur de decompte (G-06) ──────────────────────────────────────────────────
export type PhaseKind = 'warmup' | 'work' | 'rest' | 'round_rest';
export interface Phase {
  kind: PhaseKind;
  seconds: number;
  round: number;
  set: number;
}

/** Sequence ordonnee de phases ; somme des durees = totalDuration(). */
export function buildPhases(p: DurationFields): Phase[] {
  const phases: Phase[] = [];
  const rounds = Math.max(1, p.rounds);
  const sets = Math.max(1, p.sets);
  if (p.warmup_sec > 0) phases.push({ kind: 'warmup', seconds: p.warmup_sec, round: 1, set: 1 });
  for (let r = 1; r <= rounds; r++) {
    for (let s = 1; s <= sets; s++) {
      if (p.work_sec > 0) phases.push({ kind: 'work', seconds: p.work_sec, round: r, set: s });
      if (p.rest_sec > 0) phases.push({ kind: 'rest', seconds: p.rest_sec, round: r, set: s });
    }
    if (r < rounds && p.round_rest_sec > 0) phases.push({ kind: 'round_rest', seconds: p.round_rest_sec, round: r, set: sets });
  }
  return phases;
}

export interface PhasePosition {
  done: boolean;
  index: number;
  phase: Phase | null;
  secondsLeft: number;
}

/** Position dans la sequence apres `elapsed` secondes (base sur l'horloge murale : robuste a l'arriere-plan). */
export function phaseAt(phases: Phase[], elapsed: number): PhasePosition {
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const end = acc + phases[i].seconds;
    if (elapsed < end) return { done: false, index: i, phase: phases[i], secondsLeft: end - elapsed };
    acc = end;
  }
  return { done: true, index: phases.length, phase: null, secondsLeft: 0 };
}

export const PHASE_LABEL: Record<PhaseKind, string> = {
  warmup: 'Échauffement',
  work: 'Effort',
  rest: 'Repos',
  round_rest: 'Repos entre rounds',
};
