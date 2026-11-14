// v1.20 Phase 26 - logique PURE de la Ligue cote mobile (aucune I/O, aucun React). Teste dans rules.test.ts.
// Le score, les paliers et la transition sont calcules EN BASE (migrations 2603/2604) : ce fichier ne fait que
// presenter l'etat recu (libelles, vues, regles d'affichage de vie privee). Il ne recalcule jamais un score.

export const LEAGUE_UNLOCK_TIER = 3;

export type FactionKey = 'powerlifting' | 'hyrox' | 'running' | 'bodybuilding' | 'weight_loss' | 'wellness';
export type LeagueTrack = 'habits' | 'performance';

export interface FactionDef {
  key: FactionKey;
  label: string;
  /** Nom Ionicons (jamais d'emoji). */
  icon: string;
}

/** Miroir de ziko_factions (seed 2601) : taxonomie sport v1.8 + faction de repli. */
export const FACTIONS: readonly FactionDef[] = [
  { key: 'powerlifting', label: 'Powerlifting', icon: 'barbell' },
  { key: 'hyrox', label: 'Hyrox', icon: 'flame' },
  { key: 'running', label: 'Running', icon: 'walk' },
  { key: 'bodybuilding', label: 'Bodybuilding', icon: 'body' },
  { key: 'weight_loss', label: 'Perte de poids', icon: 'trending-down' },
  { key: 'wellness', label: 'Forme et bien-être', icon: 'leaf' },
];

export function factionByKey(key: string | null | undefined): FactionDef | null {
  return FACTIONS.find((f) => f.key === key) ?? null;
}

/** Faction suggeree d'apres l'objectif du profil (D-02). Hyrox n'est jamais suggeree : aucun objectif equivalent. */
export function suggestFaction(goal: string | null | undefined): FactionKey {
  switch ((goal ?? '').toLowerCase()) {
    case 'strength':
      return 'powerlifting';
    case 'endurance':
      return 'running';
    case 'muscle_gain':
    case 'body_comp':
      return 'bodybuilding';
    case 'fat_loss':
    case 'weight_loss':
      return 'weight_loss';
    default:
      return 'wellness';
  }
}

export const DIVISIONS = ['Bronze', 'Argent', 'Or', 'Platine', 'Diamant'] as const;
export const DIVISION_COUNT = DIVISIONS.length;

export function divisionName(n: number): string {
  const i = Math.min(DIVISION_COUNT, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1))) - 1;
  return DIVISIONS[i];
}

export const TRACK_LABEL: Record<LeagueTrack, string> = {
  habits: 'Piste Habitudes',
  performance: 'Piste Performance',
};

export const TRACK_UNIT: Record<LeagueTrack, string> = { habits: 'habitudes', performance: 'séances' };

export interface LeagueState {
  unlocked: boolean;
  tier?: number;
  required_tier?: number;
  track?: LeagueTrack;
  division?: number;
  start_division?: number;
  peak_division?: number;
  faction?: string | null;
  current_week?: { week_start: string; asked: number; done: number };
  recent_weeks?: Array<{ week_start: string; score: number; outcome: string }>;
  history_weeks?: { habits: number; performance: number };
  pending_celebration?: { id: string; to_track: LeagueTrack; reason: string; created_at: string } | null;
}

/** Normalise la reponse de ziko_league_sync (forme inconnue -> null : l'ecran affiche l'etat d'erreur). */
export function parseLeagueState(raw: unknown): LeagueState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.unlocked !== 'boolean') return null;
  if (!r.unlocked) return { unlocked: false, tier: Number(r.tier ?? 1), required_tier: Number(r.required_tier ?? LEAGUE_UNLOCK_TIER) };
  const track = r.track === 'performance' ? 'performance' : r.track === 'habits' ? 'habits' : null;
  if (!track) return null;
  const cw = (r.current_week ?? {}) as Record<string, unknown>;
  const hw = (r.history_weeks ?? {}) as Record<string, unknown>;
  const weeks = Array.isArray(r.recent_weeks) ? r.recent_weeks : [];
  const pc = r.pending_celebration as Record<string, unknown> | null | undefined;
  return {
    unlocked: true,
    tier: Number(r.tier ?? LEAGUE_UNLOCK_TIER),
    track,
    division: Math.min(DIVISION_COUNT, Math.max(1, Number(r.division ?? 1))),
    start_division: Number(r.start_division ?? 1),
    peak_division: Number(r.peak_division ?? 1),
    faction: typeof r.faction === 'string' ? r.faction : null,
    current_week: { week_start: String(cw.week_start ?? ''), asked: Number(cw.asked ?? 0), done: Number(cw.done ?? 0) },
    recent_weeks: weeks
      .map((w) => w as Record<string, unknown>)
      .filter((w) => typeof w.week_start === 'string')
      .map((w) => ({ week_start: String(w.week_start), score: Number(w.score ?? 0), outcome: String(w.outcome ?? 'hold') }))
      .slice(0, 4),
    history_weeks: { habits: Number(hw.habits ?? 0), performance: Number(hw.performance ?? 0) },
    pending_celebration:
      pc && typeof pc.id === 'string'
        ? { id: pc.id, to_track: pc.to_track === 'habits' ? 'habits' : 'performance', reason: String(pc.reason ?? ''), created_at: String(pc.created_at ?? '') }
        : null,
  };
}

// ── Carte d'entree (E3/E4 de 26-UI-SPEC) ───────────────────────────────

export interface EntryView {
  subtitle: string;
  badge: string | null;
}

/** Sous-titre de la carte d'entree. Jamais de score chiffre, de rang ni de nom d'une autre personne (E4). */
export function entryView(state: LeagueState | null): EntryView {
  if (!state) return { subtitle: 'Ta régularité, à ton rythme', badge: null };
  if (!state.unlocked) return { subtitle: `Se débloque au palier ${state.required_tier ?? LEAGUE_UNLOCK_TIER}`, badge: null };
  const badge = state.pending_celebration ? 'Nouveau' : null;
  const f = factionByKey(state.faction);
  if (!f) return { subtitle: 'Choisis ta faction', badge };
  return { subtitle: `${f.label} · ${divisionName(state.division ?? 1)}`, badge };
}

// ── Cette semaine (S7) ─────────────────────────────────────────────────

export interface WeekView {
  label: string;
  /** 0..1 pour la barre. */
  ratio: number;
}

export function weekView(state: LeagueState): WeekView {
  const w = state.current_week ?? { asked: 0, done: 0, week_start: '' };
  const asked = Math.max(0, w.asked);
  const done = Math.min(Math.max(0, w.done), asked);
  const unit = TRACK_UNIT[state.track ?? 'habits'];
  return { label: `Cette semaine : ${done} sur ${asked} ${unit}`, ratio: asked > 0 ? done / asked : 0 };
}

/** Pastille d'une semaine cloturee : coche si score >= 80, sinon cercle neutre (jamais de couleur d'alerte, S7). */
export function weekDot(score: number): { icon: 'checkmark-circle' | 'ellipse'; tone: 'success' | 'muted' } {
  return score >= 80 ? { icon: 'checkmark-circle', tone: 'success' } : { icon: 'ellipse', tone: 'muted' };
}

// ── Vie privee (D-12) ──────────────────────────────────────────────────

/** Le compteur de faction n'est affiche que si l'API renvoie un entier (>= 10 adultes cote base). */
export function memberCountLabel(count: unknown): string | null {
  return typeof count === 'number' && Number.isInteger(count) && count >= 10 ? `${count} membres` : null;
}

// ── Defis de groupe (S9) ───────────────────────────────────────────────

export type CollectiveMetric = 'workout_sessions' | 'habit_logs' | 'hydration_ml';
export const COLLECTIVE_UNIT: Record<CollectiveMetric, string> = {
  workout_sessions: 'séances',
  habit_logs: 'habitudes',
  hydration_ml: 'ml',
};

export interface CollectiveProgress {
  id: string;
  title: string;
  metric: CollectiveMetric;
  target_total: number;
  total: number;
  /** true sous 3 participants : le backend renvoie total = null (confidentialite), jamais 0. */
  total_hidden?: boolean;
  joined_count: number;
  my_contribution: number | null;
  my_status: 'invited' | 'joined' | 'declined' | null;
  role: 'coach' | 'athlete';
  end_date: string;
}

export interface CollectiveView {
  groupLine: string;
  /** Total masque : ne pas afficher de barre de progression ni de pourcentage. */
  hidden: boolean;
  ratio: number;
  participantsLine: string;
  mineLine: string | null;
}

export function collectiveView(p: CollectiveProgress): CollectiveView {
  const unit = COLLECTIVE_UNIT[p.metric] ?? '';
  const target = Math.max(0, p.target_total);
  const total = Math.max(0, p.total ?? 0);
  const hidden = p.total_hidden === true;
  return {
    groupLine: hidden ? 'Total masqué (moins de 3 participants)' : `Groupe : ${total} / ${target} ${unit}`,
    hidden,
    ratio: !hidden && target > 0 ? Math.min(1, total / target) : 0,
    participantsLine: `${p.joined_count} participant${p.joined_count > 1 ? 's' : ''}`,
    mineLine: p.my_status === 'joined' && p.my_contribution !== null ? `Ma contribution : ${p.my_contribution}` : null,
  };
}

export function parseCollective(raw: unknown): CollectiveProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.title !== 'string') return null;
  const metric = (['workout_sessions', 'habit_logs', 'hydration_ml'] as const).find((m) => m === r.metric);
  if (!metric) return null;
  const status = (['invited', 'joined', 'declined'] as const).find((s) => s === r.my_status) ?? null;
  return {
    id: r.id,
    title: r.title,
    metric,
    target_total: Number(r.target_total ?? 0),
    total: Number(r.total ?? 0),
    total_hidden: r.total_hidden === true || r.total === null || r.total === undefined,
    joined_count: Number(r.joined_count ?? 0),
    my_contribution: r.my_contribution === null || r.my_contribution === undefined ? null : Number(r.my_contribution),
    my_status: status,
    role: r.role === 'coach' ? 'coach' : 'athlete',
    end_date: String(r.end_date ?? ''),
  };
}

// ── Changement de faction ──────────────────────────────────────────────

/** Date lisible (jj/mm) d'une echeance ISO ; chaine vide si invalide. */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type FactionChange = { allowed: true } | { allowed: false; message: string };

export function factionChangeState(canChangeAt: string | null | undefined, now: Date = new Date()): FactionChange {
  if (!canChangeAt) return { allowed: true };
  const t = new Date(canChangeAt).getTime();
  if (Number.isNaN(t) || t <= now.getTime()) return { allowed: true };
  return { allowed: false, message: `Tu pourras changer le ${formatDayMonth(canChangeAt)}.` };
}

// ── Copie (testee : aucun mot punitif, S1) ─────────────────────────────

export const FORBIDDEN_WORDS = ['perdu', 'chute', 'relégation', 'relegation', 'descente', 'échec', 'echec', 'éliminé', 'elimine', 'dernier'] as const;

export const COPY = {
  title: 'Ligue',
  subtitle: 'Ta régularité, à ton rythme',
  lockedTitle: 'Ligue verrouillée',
  lockedBody: "Elle s'ouvre au palier 3. Continue à ton rythme.",
  errorTitle: 'Impossible de charger la Ligue',
  retry: 'Réessayer',
  pickFaction: 'Choisis une faction pour commencer',
  suggested: 'Suggérée',
  change: 'Changer',
  trackHelp: 'Ton palier monte avec ta régularité et ne descend jamais de plus d\'un cran par rapport à ton meilleur.',
  noCollective: 'Aucun défi de groupe pour l\'instant',
  join: 'Rejoindre',
  decline: 'Pas cette fois',
  leave: 'Quitter ce défi',
  celebrationTitle: 'Nouvelle piste : Performance',
  celebrationBody: 'Ziko a vu ta régularité. Tu passes en piste Performance. Ta piste Habitudes reste dans ton historique.',
  continue: 'Continuer',
  offline: 'Hors ligne',
  actionFailed: 'Action non enregistrée',
  openLeague: 'Ouvrir la Ligue',
} as const;

export function historyLine(state: LeagueState): string | null {
  const h = state.history_weeks;
  if (!h || !state.track) return null;
  const other: LeagueTrack = state.track === 'habits' ? 'performance' : 'habits';
  const n = h[other];
  if (!n) return null;
  return `Historique ${other === 'habits' ? 'Habitudes' : 'Performance'} : ${n} semaine${n > 1 ? 's' : ''}`;
}
