// Journal : logique pure (testable sans React Native). v1.20 P22 (JRNL-01, JRNL-02).

// Identite du module (decision utilisateur : sarcelle, remplace l'ancien violet).
export const JOURNAL_TEAL = '#0F766E';
export const JOURNAL_TEAL_TINT = '#E1F1EF';
export const JOURNAL_NEUTRAL_ICON = '#8A877F';

// Valeurs autorisees par le CHECK de ziko_journal_entries.context.
export type JournalContext = 'morning' | 'pre_workout' | 'post_workout' | 'evening' | 'general';

export const CONTEXTS: { value: JournalContext; label: string; icon: string }[] = [
  { value: 'morning', label: 'Matin', icon: 'sunny' },
  { value: 'pre_workout', label: 'Avant séance', icon: 'barbell' },
  { value: 'post_workout', label: 'Après séance', icon: 'fitness' },
  { value: 'evening', label: 'Soir', icon: 'moon' },
  { value: 'general', label: 'Général', icon: 'ellipse' },
];

export const CONTEXT_VALUES: JournalContext[] = CONTEXTS.map((c) => c.value);

export const contextLabel = (v: string | null | undefined): string =>
  CONTEXTS.find((c) => c.value === v)?.label ?? 'Général';

/** Toute valeur inconnue (ancien libelle 'Post-séance', 'afternoon'...) retombe sur 'general'. */
export function normalizeContext(v: unknown): JournalContext {
  return CONTEXT_VALUES.includes(v as JournalContext) ? (v as JournalContext) : 'general';
}

// Memes noms d'icones que le selecteur d'humeur de l'accueil (P8).
export const MOODS: { v: number; icon: string; label: string }[] = [
  { v: 1, icon: 'sad-outline', label: 'Mauvais' },
  { v: 2, icon: 'sad', label: 'Bof' },
  { v: 3, icon: 'remove-circle', label: 'Moyen' },
  { v: 4, icon: 'happy', label: 'Bien' },
  { v: 5, icon: 'happy-outline', label: 'Super' },
];

export const moodMeta = (v: number | null | undefined) => MOODS.find((m) => m.v === v) ?? MOODS[2];

export const ENERGY_LEGEND = { low: 'Épuisé', high: 'En forme' };
export const STRESS_LEGEND = { low: 'Détendu', high: 'Très stressé' };

export const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Date locale AAAA-MM-JJ (jamais toISOString : decalage UTC pres de minuit). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface TrendEntry {
  mood: number;
  date?: string | null;
  created_at?: string | null;
}

const entryDay = (e: TrendEntry): string | null => {
  if (e.date) return String(e.date).slice(0, 10);
  if (e.created_at) {
    const d = new Date(e.created_at);
    return Number.isNaN(d.getTime()) ? null : localDateKey(d);
  }
  return null;
};

export interface TrendDay {
  key: string;
  label: string;
  name: string;
  /** Moyenne du jour ; null = aucune entree (barre absente, pas un zero). */
  avg: number | null;
  today: boolean;
}

/** 7 derniers jours (aujourd'hui inclus) ; jour sans entree => avg null. */
export function buildTrend(entries: TrendEntry[], today: Date = new Date()): TrendDay[] {
  const days: TrendDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = localDateKey(d);
    const moods = entries.filter((e) => entryDay(e) === key && typeof e.mood === 'number').map((e) => e.mood);
    days.push({
      key,
      label: DAY_LABELS[d.getDay()],
      name: DAY_NAMES[d.getDay()],
      avg: moods.length ? moods.reduce((s, v) => s + v, 0) / moods.length : null,
      today: i === 0,
    });
  }
  return days;
}

/** Moyenne des humeurs entre deux bornes de dates locales (incluses). */
export function averageBetween(entries: TrendEntry[], fromKey: string, toKey: string): number | null {
  const moods = entries
    .filter((e) => {
      const k = entryDay(e);
      return k !== null && k >= fromKey && k <= toKey && typeof e.mood === 'number';
    })
    .map((e) => e.mood);
  return moods.length ? moods.reduce((s, v) => s + v, 0) / moods.length : null;
}

export function weekStats(entries: TrendEntry[], today: Date = new Date()) {
  const key = (back: number) => localDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back));
  const current = averageBetween(entries, key(6), key(0));
  const previous = averageBetween(entries, key(13), key(7));
  return { current, previous, delta: current !== null && previous !== null ? current - previous : null };
}

export const formatAvg = (v: number): string => v.toFixed(1).replace('.', ',');

export function trendDescription(days: TrendDay[]): string {
  const parts = days.map((d) => `${d.name} ${d.avg === null ? 'aucune entrée' : formatAvg(d.avg)}`);
  return `Humeur des 7 derniers jours : ${parts.join(', ')}`;
}

// ── Erreurs d'enregistrement (JRNL-01) ─────────────────────────────────────
export type SaveFailure = 'expired' | 'offline' | 'server';

export function classifySaveError(err: any): SaveFailure {
  const name = String(err?.name ?? '');
  const msg = String(err?.message ?? '').toLowerCase();
  const code = String(err?.code ?? '');
  const status = Number(err?.status ?? 0);
  if (
    name === 'SessionExpiredError' ||
    code === 'PGRST301' ||
    code === 'PGRST303' ||
    status === 401 ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('session expir')
  ) {
    return 'expired';
  }
  if (
    name === 'TypeError' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  ) {
    return 'offline';
  }
  return 'server';
}

export const FAILURE_COPY: Record<SaveFailure, { title: string; body: string }> = {
  expired: {
    title: 'Session expirée',
    body: "Ton entrée n'a pas été enregistrée. Reconnecte-toi, ta saisie est conservée.",
  },
  offline: {
    title: 'Pas de connexion',
    body: "Ton entrée n'est pas enregistrée.",
  },
  server: {
    title: 'Enregistrement impossible',
    body: "Réessaie dans un instant.",
  },
};

// ── Enregistrement ─────────────────────────────────────────────────────────
export interface JournalInput {
  mood: number;
  energy: number;
  stress: number;
  context: JournalContext;
  notes: string;
}

export interface ExistingEntry {
  id: string;
  mood: number;
  energy: number | null;
  stress: number | null;
  notes: string | null;
}

/** Sous-ensemble du client Supabase utilise ici (permet un faux client en test). */
export type JournalClient = { from: (table: string) => any };

const TABLE = 'ziko_journal_entries';

const rangeOk = (v: number) => Number.isInteger(v) && v >= 1 && v <= 5;

/**
 * Entree 'general' du jour : c'est l'humeur de l'accueil (Quick Log P8), 1 par jour,
 * modifiee sur place. Les autres moments creent des entrees distinctes.
 */
export async function getTodayGeneral(
  client: JournalClient,
  userId: string,
  date: string = localDateKey(),
): Promise<ExistingEntry | null> {
  const res = await client
    .from(TABLE)
    .select('id, mood, energy, stress, notes')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('context', 'general')
    .order('created_at', { ascending: false })
    .limit(1);
  if (res.error) throw res.error;
  const row = (res.data ?? [])[0];
  return row ?? null;
}

export async function saveJournalEntry(
  client: JournalClient,
  userId: string,
  input: JournalInput,
  date: string = localDateKey(),
): Promise<'inserted' | 'updated'> {
  if (!rangeOk(input.mood) || !rangeOk(input.energy) || !rangeOk(input.stress)) {
    throw new Error('valeur hors 1-5');
  }
  const context = normalizeContext(input.context);
  const notes = input.notes.trim();
  if (context === 'general') {
    const existing = await getTodayGeneral(client, userId, date);
    if (existing) {
      const res = await client
        .from(TABLE)
        .update({ mood: input.mood, energy: input.energy, stress: input.stress, notes })
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (res.error) throw res.error;
      return 'updated';
    }
  }
  const res = await client.from(TABLE).insert({
    user_id: userId,
    mood: input.mood,
    energy: input.energy,
    stress: input.stress,
    context,
    notes,
    date,
  });
  if (res.error) throw res.error;
  return 'inserted';
}

// ── Brouillon : survit a un aller-retour vers l'ecran de connexion (JR-6) ──
let draft: JournalInput | null = null;
export const getDraft = (): JournalInput | null => draft;
export const setDraft = (d: JournalInput): void => {
  draft = d;
};
export const clearDraft = (): void => {
  draft = null;
};
