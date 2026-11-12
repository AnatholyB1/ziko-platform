// Phase 23 (v1.20) - Atelier IA : logique pure de l'ecran (A10-A15). Aucune dependance React/RN.
// Testee dans __tests__/atelier.test.ts. Le serveur reste la source de verite du brouillon (revision).

export interface AtelierExercise {
  name: string;
  sets: number;
  reps: string | number;
  rest_seconds?: number;
  pct_1rm?: number;
  rpe?: number;
  tempo?: string;
  note?: string;
}
export interface AtelierSession {
  name: string;
  day_of_week: number;
  focus?: string;
  exercises: AtelierExercise[];
}
export interface AtelierWeek {
  w: number;
  label?: string;
  sessions: AtelierSession[];
}
export interface AtelierProgram {
  name: string;
  goal: string;
  split_type: string;
  days_per_week: number;
  weeks_count: number;
  weeks: AtelierWeek[];
  notes?: string;
}

// ── Libelles FR (microcopy du contrat lot A, mot pour mot) ───────────────────────────

export const ATELIER_COPY = {
  title: 'Atelier IA',
  inputPlaceholderInitial: 'Décris ton objectif',
  inputPlaceholderEdit: 'Demande une modification…',
  inputPlaceholderBusy: "L'IA répond…",
  errorTitle: "La réponse n'est pas arrivée.",
  errorBody: "Ton message est conservé et aucun crédit n'a été retiré.",
  retry: 'Réessayer',
  creditsOut: "Plus de crédits IA. Tu en gagnes en t'entraînant, ou tu peux en obtenir.",
  getCredits: 'Obtenir des crédits',
  saveDraft: 'Enregistrer le brouillon',
  manualEditHint: 'Tu peux toujours modifier et enregistrer ce programme à la main.',
  askAi: "Demander à l'IA",
  save: 'Enregistrer',
  draftBadge: 'BROUILLON',
  initialTitle: 'Construis ton programme, point par point',
  initialBody: "Décris ton objectif. L'IA connaît tes séances et tes programmes passés, et peut chercher sur le web.",
  knows: "Ce que l'IA sait de toi",
  start: 'Pour démarrer',
} as const;

export const STARTER_PROMPTS: Array<{ icon: string; label: string; message: string }> = [
  { icon: 'trophy', label: 'Préparer une compétition de powerlifting', message: 'Je prépare une compétition de powerlifting. Construis-moi un bloc de pic de force.' },
  { icon: 'fitness', label: 'Prise de masse en 4 jours par semaine', message: 'Je veux un programme de prise de masse en 4 jours par semaine.' },
  { icon: 'repeat', label: 'Reprendre après une pause', message: "Je reprends l'entraînement après une pause. Construis-moi une reprise progressive." },
];

export const QUICK_REQUESTS = ['Plus de volume squat', 'Semaine de décharge', 'Moins de séances'];

const DAY_FR = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const dayLabel = (d: number): string => DAY_FR[Math.round(d)] ?? '';

/** "14 crédits" / "1 crédit" / "0 crédit" (barre du haut, A10 / A15). */
export function creditBarLabel(balance: number): string {
  const n = Math.max(0, Math.round(balance));
  return n > 1 ? `${n} crédits` : `${n} crédit`;
}

/** Sous la saisie : le cout REEL lu sur le serveur (D-08), jamais "1 credit" en dur. */
export function costLabel(cost: number | null | undefined, freeLeft: number | null | undefined): string {
  if (!cost || cost < 1) return 'Consomme des crédits IA';
  const credits = cost > 1 ? `${cost} crédits` : '1 crédit';
  if (freeLeft && freeLeft > 0) {
    return freeLeft > 1 ? `${freeLeft} messages gratuits aujourd'hui, puis ${credits} par message` : `1 message gratuit aujourd'hui, puis ${credits} par message`;
  }
  return `${credits} par message`;
}

export function contextBanner(c: { sessions: number; programs: number } | null | undefined): string {
  if (!c) return 'Contexte : chargement…';
  const s = c.sessions > 1 ? `${c.sessions} séances` : `${c.sessions} séance`;
  const p = c.programs > 1 ? `${c.programs} programmes` : `${c.programs} programme`;
  return `Contexte : ${s}, ${p}`;
}

// ── Brouillon : lignes de liste ──────────────────────────────────────────────────────

/** "Squat 5x3 à 85 %" (A10). */
export function exerciseLine(e: AtelierExercise): string {
  const pct = e.pct_1rm ? ` à ${Math.round(e.pct_1rm * 10) / 10} %` : '';
  return `${e.name} ${e.sets}x${e.reps}${pct}`;
}

export function sessionLine(s: AtelierSession, max = 2): string {
  const shown = s.exercises.slice(0, max).map(exerciseLine);
  const more = s.exercises.length > max ? ` +${s.exercises.length - max}` : '';
  return shown.join(', ') + more;
}

export function sessionTitle(s: AtelierSession): string {
  return `${dayLabel(s.day_of_week)} · ${s.name}`.replace(/^ · /, '');
}

export function weekChipLabel(w: AtelierWeek): string {
  return `S${w.w}`;
}

export function draftSubtitle(p: AtelierProgram): string {
  const s = p.days_per_week > 1 ? `${p.days_per_week} séances par semaine` : '1 séance par semaine';
  return `${s} · ${p.weeks_count} semaine${p.weeks_count > 1 ? 's' : ''}`;
}

// ── Edition manuelle (A12) : steppers 44 dp, jamais de credit ────────────────────────

export type StepField = 'sets' | 'reps' | 'pct_1rm';

const STEP_RULES: Record<StepField, { min: number; max: number; step: number }> = {
  sets: { min: 1, max: 20, step: 1 },
  reps: { min: 1, max: 30, step: 1 },
  pct_1rm: { min: 1, max: 120, step: 2.5 },
};

export function readRepsNumber(reps: string | number): number {
  if (typeof reps === 'number') return reps;
  const m = String(reps).match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

/** Valeur du champ apres un tap +/- (borne, pas de NaN). Pour reps en plage ("8-12"), on part de la borne basse. */
export function stepValue(field: StepField, ex: AtelierExercise, dir: 1 | -1): number {
  const r = STEP_RULES[field];
  const cur = field === 'reps' ? readRepsNumber(ex.reps) : field === 'sets' ? ex.sets : ex.pct_1rm ?? 70;
  const next = Math.round((cur + dir * r.step) * 10) / 10;
  return Math.min(r.max, Math.max(r.min, next));
}

export const REST_CHOICES = [
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
] as const;

export interface ExercisePatch {
  sets?: number;
  reps?: number;
  pct_1rm?: number;
  rest_seconds?: number;
}

export type AtelierOp =
  | { op: 'update_exercise'; week: number | 'all'; session: number; index: number; patch: Record<string, unknown> };

/** Operations envoyees a PATCH /ai/workshop/drafts/:id (week 1-based ou 'all', session/index 0-based). */
export function buildEditOps(args: { week: number; allWeeks: boolean; session: number; index: number; patch: ExercisePatch }): AtelierOp[] {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args.patch)) if (v !== undefined) patch[k] = v;
  if (Object.keys(patch).length === 0) return [];
  return [{ op: 'update_exercise', week: args.allWeeks ? 'all' : args.week, session: args.session, index: args.index, patch }];
}

// ── Flux SSE ─────────────────────────────────────────────────────────────────────────

export type AtelierEvent =
  | { type: 'meta'; draft_id: string; conversation_id: string; cost?: number }
  | { type: 'chunk'; content: string }
  | { type: 'tool'; id: string; name: string; state: 'start' | 'done' | 'error'; label: string }
  | { type: 'draft'; revision: number; program: AtelierProgram | null }
  | { type: 'error'; error: string }
  | { type: 'done' };

/** Decoupe un tampon SSE en evenements complets ; renvoie le reste partiel. Ignore [DONE] et le JSON invalide. */
export function parseSseBuffer(buffer: string): { events: AtelierEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: AtelierEvent[] = [];
  for (const block of parts) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        if (ev && typeof ev.type === 'string') events.push(ev as AtelierEvent);
      } catch {
        /* partial or malformed */
      }
    }
  }
  return { events, rest };
}

export interface ToolChip {
  id: string;
  name: string;
  label: string;
  state: 'start' | 'done' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tools: ToolChip[];
}

export type TurnStatus = 'idle' | 'streaming' | 'error' | 'credits';

export interface AtelierState {
  messages: ChatMessage[];
  draftId: string | null;
  draft: { revision: number; program: AtelierProgram } | null;
  status: TurnStatus;
  /** Message du dernier tour en echec, conserve pour Reessayer (A14). */
  failedMessage: string | null;
}

export const initialAtelierState: AtelierState = { messages: [], draftId: null, draft: null, status: 'idle', failedMessage: null };

let seq = 0;
const nextId = () => `m${++seq}`;

export function startTurn(state: AtelierState, message: string): AtelierState {
  return {
    ...state,
    status: 'streaming',
    failedMessage: null,
    messages: [
      ...state.messages,
      { id: nextId(), role: 'user', text: message, tools: [] },
      { id: nextId(), role: 'assistant', text: '', tools: [] },
    ],
  };
}

function updateLastAssistant(state: AtelierState, fn: (m: ChatMessage) => ChatMessage): AtelierState {
  const idx = state.messages.length - 1;
  if (idx < 0 || state.messages[idx].role !== 'assistant') return state;
  const messages = state.messages.slice();
  messages[idx] = fn(messages[idx]);
  return { ...state, messages };
}

export function applyEvent(state: AtelierState, ev: AtelierEvent): AtelierState {
  switch (ev.type) {
    case 'meta':
      return { ...state, draftId: ev.draft_id };
    case 'chunk':
      return updateLastAssistant(state, (m) => ({ ...m, text: m.text + ev.content }));
    case 'tool':
      return updateLastAssistant(state, (m) => {
        const i = m.tools.findIndex((t) => t.id === ev.id);
        const chip: ToolChip = { id: ev.id, name: ev.name, label: ev.label, state: ev.state };
        const tools = m.tools.slice();
        if (i >= 0) tools[i] = chip;
        else tools.push(chip);
        return { ...m, tools };
      });
    case 'draft':
      // Le serveur renvoie la revision : on n'accepte jamais une revision plus ancienne que celle affichee.
      if (!ev.program) return state;
      if (state.draft && ev.revision < state.draft.revision) return state;
      return { ...state, draft: { revision: ev.revision, program: ev.program } };
    case 'error':
      return failTurn(state);
    case 'done':
      return { ...state, status: state.status === 'streaming' ? 'idle' : state.status };
    default:
      return state;
  }
}

/** Echec : on retire la reponse vide, on garde le message utilisateur et on le memorise pour Reessayer. */
export function failTurn(state: AtelierState, kind: 'error' | 'credits' = 'error'): AtelierState {
  const msgs = state.messages.slice();
  const last = msgs[msgs.length - 1];
  const hadOutput = !!last && last.role === 'assistant' && (last.text.length > 0 || last.tools.length > 0);
  if (!hadOutput && last?.role === 'assistant') msgs.pop();
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
  if (kind === 'credits') {
    // Le message n'a pas ete envoye au modele : on le retire et on le rend a la saisie.
    if (lastUser && msgs[msgs.length - 1]?.id === lastUser.id) msgs.pop();
    return { ...state, messages: msgs, status: 'credits', failedMessage: lastUser?.text ?? null };
  }
  return {
    ...state,
    messages: hadOutput ? state.messages : msgs,
    status: 'error',
    failedMessage: hadOutput ? null : lastUser?.text ?? null,
  };
}

/** Reessayer : retire le message utilisateur en echec (il sera renvoye par startTurn). */
export function prepareRetry(state: AtelierState): { state: AtelierState; message: string | null } {
  if (!state.failedMessage) return { state, message: null };
  const msgs = state.messages.slice();
  const last = msgs[msgs.length - 1];
  if (last?.role === 'user' && last.text === state.failedMessage) msgs.pop();
  return { state: { ...state, messages: msgs, status: 'idle', failedMessage: null }, message: state.failedMessage };
}

export type TurnErrorKind = 'credits' | 'network';
export function classifyHttpStatus(status: number): TurnErrorKind {
  return status === 402 ? 'credits' : 'network';
}

/** Saisie desactivee : pendant un tour, ou credits epuises (A13, A15). */
export function inputDisabled(status: TurnStatus): boolean {
  return status === 'streaming' || status === 'credits';
}

export function placeholderFor(status: TurnStatus, hasDraft: boolean): string {
  if (status === 'streaming') return ATELIER_COPY.inputPlaceholderBusy;
  return hasDraft ? ATELIER_COPY.inputPlaceholderEdit : ATELIER_COPY.inputPlaceholderInitial;
}
