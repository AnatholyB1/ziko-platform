/**
 * Sommeil : logique pure (sans React Native), testable sous vitest.
 * Contrat : lot-C/DESIGN-CONTRACT.md (SL-1..SL-6). Aucune valeur par defaut affichee :
 * pas de nuit = null, pas de cible = null.
 */

export const MAX_NIGHT_MIN = 16 * 60; // SL-6 : au-dela, saisie refusee
export const TIME_STEP_MIN = 15;
export const GOAL_STEP_MIN = 30;
export const GOAL_MIN_H = 4;
export const GOAL_MAX_H = 12;
export const GOAL_FIRST_H = 8; // valeur proposee au 1er appui sur "+" (jamais affichee sans action)

export type SleepSource = 'manual' | 'health';

export interface ManualNight {
  date: string; // jour du reveil, YYYY-MM-DD
  bedtime: string; // HH:MM
  wake_time: string;
  duration_hours: number;
  quality: number; // 1..5
  awakenings: number;
  notes?: string | null;
}

export interface HealthNight {
  date: string;
  sleep_hours: number | null;
  sleep_bedtime: string | null; // HH:MM[:SS]
  sleep_wake_time: string | null;
  sleep_deep_min: number | null;
  sleep_light_min: number | null;
  sleep_rem_min: number | null;
  sleep_awake_min: number | null;
}

export interface SleepStages {
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
}

/** Nuit a afficher : une seule resolution pour l'ecran Sommeil et l'accueil (SL-2/SL-4/SLP-06). */
export interface ResolvedNight {
  date: string;
  source: SleepSource;
  durationH: number;
  bedtime: string | null;
  wakeTime: string | null;
  quality: number | null; // null si la source ne fournit pas de qualite
  awakenings: number | null;
  stages: SleepStages | null; // uniquement avec une source qui les fournit (SL-3)
  /** Saisie manuelle de la meme nuit conservee mais masquee par la source (D-03). */
  hiddenManualDurationH: number | null;
}

// ── Heures ───────────────────────────────────────────────────────────────────

export function parseHHMM(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatHHMM(totalMin: number): string {
  const t = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Decale une heure HH:MM de `deltaMin` minutes (modulo 24 h). */
export function stepTime(v: string, deltaMin: number): string {
  const cur = parseHHMM(v) ?? 0;
  return formatHHMM(cur + deltaMin);
}

/** Duree coucher -> lever en minutes (franchit minuit si lever <= coucher). */
export function nightDurationMin(bedtime: string, wakeTime: string): number {
  const b = parseHHMM(bedtime);
  const w = parseHHMM(wakeTime);
  if (b == null || w == null) return 0;
  let wake = w;
  if (wake <= b) wake += 1440;
  return wake - b;
}

/** `7 h 45`, `8 h`, `17 h 30` (espace insecable fine non utilisee : texte recherchable). */
export function formatDurationMin(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function formatDurationH(hours: number): string {
  return formatDurationMin(hours * 60);
}

export interface NightValidation {
  durationMin: number;
  ok: boolean;
  /** Message affiche sous le champ (D-02), null si valide. */
  error: string | null;
}

export function validateNight(bedtime: string, wakeTime: string, quality: number | null): NightValidation {
  const durationMin = nightDurationMin(bedtime, wakeTime);
  if (durationMin > MAX_NIGHT_MIN) {
    return {
      durationMin,
      ok: false,
      error: `Cette nuit dure ${formatDurationMin(durationMin)}. Vérifie le coucher et le lever (maximum 16 h).`,
    };
  }
  // D-15 : qualite obligatoire (NOT NULL en base), pas de valeur par defaut.
  return { durationMin, ok: durationMin > 0 && quality != null && quality >= 1 && quality <= 5, error: null };
}

// ── Resolution de la nuit (D-08) ──────────────────────────────────────────────

function hhmm(v: string | null): string | null {
  if (!v) return null;
  const p = parseHHMM(v);
  return p == null ? null : formatHHMM(p);
}

export function healthStages(h: HealthNight): SleepStages | null {
  const vals = [h.sleep_deep_min, h.sleep_light_min, h.sleep_rem_min, h.sleep_awake_min];
  if (vals.every((v) => v == null)) return null;
  return {
    deepMin: h.sleep_deep_min ?? 0,
    lightMin: h.sleep_light_min ?? 0,
    remMin: h.sleep_rem_min ?? 0,
    awakeMin: h.sleep_awake_min ?? 0,
  };
}

/**
 * Source connectee prime si le reglage n'impose pas 'manual' et si une nuit connectee non vide existe.
 * Sinon la saisie manuelle. Aucun fallback fabrique : rien -> null.
 */
export function resolveNight(
  manual: ManualNight | null,
  health: HealthNight | null,
  sourcePref: SleepSource | null,
): ResolvedNight | null {
  const healthUsable = !!health && health.sleep_hours != null && Number(health.sleep_hours) > 0;
  if (healthUsable && sourcePref !== 'manual') {
    const h = health as HealthNight;
    return {
      date: h.date,
      source: 'health',
      durationH: Number(h.sleep_hours),
      bedtime: hhmm(h.sleep_bedtime),
      wakeTime: hhmm(h.sleep_wake_time),
      quality: null,
      awakenings: null,
      stages: healthStages(h),
      hiddenManualDurationH: manual ? Number(manual.duration_hours) : null,
    };
  }
  if (manual) {
    return {
      date: manual.date,
      source: 'manual',
      durationH: Number(manual.duration_hours),
      bedtime: hhmm(manual.bedtime),
      wakeTime: hhmm(manual.wake_time),
      quality: manual.quality,
      awakenings: manual.awakenings ?? 0,
      stages: null,
      hiddenManualDurationH: null,
    };
  }
  return null;
}

/** Libelle de la carte d'accueil (SLP-06) : meme chiffre que l'ecran Sommeil. */
export function homeSleepLabel(n: ResolvedNight | null): { primary: string; secondary: string | null } {
  if (!n) return { primary: 'Aucune nuit enregistrée', secondary: null };
  return {
    primary: formatDurationH(n.durationH),
    secondary: n.quality != null ? `qualité ${n.quality} / 5` : null,
  };
}

// ── Graphe 7 nuits ────────────────────────────────────────────────────────────

export interface WeekBar {
  date: string;
  /** null = jour sans nuit : barre ABSENTE, pas de zero (D-05). */
  hours: number | null;
}

/** `days` = 7 dates locales (ancien -> recent) ; `nights` = nuits deja resolues. */
export function buildWeekBars(days: string[], nights: Record<string, number | null | undefined>): WeekBar[] {
  return days.map((date) => {
    const v = nights[date];
    return { date, hours: v != null && v > 0 ? v : null };
  });
}

export function weekAverageH(bars: WeekBar[]): number | null {
  const vals = bars.filter((b) => b.hours != null).map((b) => b.hours as number);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function weekAccessibilityLabel(avgH: number | null, goalH: number | null): string {
  if (avgH == null) return 'Aucune nuit sur les 7 derniers jours';
  const goal = goalH != null ? `, cible ${formatDurationH(goalH)}` : '';
  return `Moyenne ${formatDurationH(avgH)}${goal}`;
}

// ── Reglages (D-09) ───────────────────────────────────────────────────────────

export const PRE_SLEEP_ROUTINE_ITEMS = [
  { id: 'screens', label: 'Écrans éteints 30 min avant' },
  { id: 'stretch', label: 'Étirements doux' },
  { id: 'reading', label: 'Lecture' },
  { id: 'breathing', label: 'Respiration' },
] as const;

export interface SleepSettings {
  /** null = aucune cible definie (jauge masquee, rien d'affiche). */
  goalHours: number | null;
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  smartWake: boolean; // preference seule (Q9 option A)
  source: SleepSource | null; // null = automatique (source connectee prime si presente)
  routine: string[];
}

export const EMPTY_SETTINGS: SleepSettings = {
  goalHours: null,
  reminderEnabled: false,
  reminderTime: '22:30',
  smartWake: false,
  source: null,
  routine: [],
};

/** Lit `ziko_user_plugins.settings` (jsonb) sans jamais inventer de cible. */
export function parseSettings(raw: unknown): SleepSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const goal = Number(r.sleep_goal_hours);
  const rem = r.bedtime_reminder ?? {};
  const time = typeof rem.time === 'string' && parseHHMM(rem.time) != null ? hhmm(rem.time)! : EMPTY_SETTINGS.reminderTime;
  return {
    goalHours: Number.isFinite(goal) && goal >= GOAL_MIN_H && goal <= GOAL_MAX_H ? goal : null,
    reminderEnabled: rem.enabled === true,
    reminderTime: time,
    smartWake: r.smart_wake === true,
    source: r.source === 'manual' || r.source === 'health' ? r.source : null,
    routine: Array.isArray(r.pre_sleep_routine) ? r.pre_sleep_routine.filter((x: unknown) => typeof x === 'string') : [],
  };
}

/** Patch jsonb a fusionner (les autres cles du plugin sont preservees par l'appelant). */
export function settingsToJson(s: SleepSettings): Record<string, unknown> {
  return {
    sleep_goal_hours: s.goalHours,
    bedtime_reminder: { enabled: s.reminderEnabled, time: s.reminderTime },
    smart_wake: s.smartWake,
    source: s.source,
    pre_sleep_routine: s.routine,
  };
}

/** Pas du stepper de cible : null -> 8 h au 1er appui, sinon +/- 30 min borne 4..12 h. */
export function stepGoal(current: number | null, direction: 1 | -1): number {
  if (current == null) return GOAL_FIRST_H;
  const next = current + (direction * GOAL_STEP_MIN) / 60;
  return Math.min(GOAL_MAX_H, Math.max(GOAL_MIN_H, next));
}

// ── Mapping des stades Health Connect (D-12) ─────────────────────────────────

/** Constantes SleepSessionRecord.STAGE_TYPE de Health Connect. */
export const HC_STAGE = { AWAKE: 1, SLEEPING: 2, OUT_OF_BED: 3, LIGHT: 4, DEEP: 5, REM: 6, AWAKE_IN_BED: 7 } as const;

export function mapHealthConnectStages(
  stages: Array<{ stage: number; startTime: string; endTime: string }> | undefined | null,
): SleepStages | null {
  if (!stages || !stages.length) return null;
  const out: SleepStages = { deepMin: 0, lightMin: 0, remMin: 0, awakeMin: 0 };
  let any = false;
  for (const s of stages) {
    const min = Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000);
    if (!(min > 0)) continue;
    switch (s.stage) {
      case HC_STAGE.DEEP: out.deepMin += min; any = true; break;
      case HC_STAGE.LIGHT:
      case HC_STAGE.SLEEPING: out.lightMin += min; any = true; break;
      case HC_STAGE.REM: out.remMin += min; any = true; break;
      case HC_STAGE.AWAKE:
      case HC_STAGE.AWAKE_IN_BED:
      case HC_STAGE.OUT_OF_BED: out.awakeMin += min; any = true; break;
      default: break;
    }
  }
  return any ? out : null;
}
