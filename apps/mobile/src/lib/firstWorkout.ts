// v1.21 Phase 2 - carte d'accueil "Crée ton premier entraînement" : logique pure (aucune dependance React/RN).
// Visibilite (FWKO-01/06), etats de credit (FWKO-02/07), microcopy du contrat de design.
// Aucun montant de credit n'existe ici : les couts viennent du serveur (GET /ai/workshop/info (cout du chat cote serveur),
// utilise par /ai/session/generate ET par l'atelier), sinon repli "Consomme des crédits IA".

export type CardVisibility = 'show' | 'loading' | 'hide';

export interface ReadState {
  isLoading: boolean;
  isError: boolean;
}

/**
 * R1 : aucun programme actif ET zero seance terminee.
 * R4 : une lecture du PROGRAMME en erreur ne montre jamais la carte comme si le compte etait vide.
 * Idem pour une lecture des SEANCES en erreur (audit phase 2) : un veteran dont le programme est en pause ou archive ne
 * doit jamais voir "premier entrainement" sur un incident reseau. Le compte neuf retrouve la carte au retry.
 */
export function firstWorkoutVisibility(args: {
  program: ReadState & { hasActive: boolean };
  sessions: ReadState & { finishedCount: number | null | undefined };
}): CardVisibility {
  const { program, sessions } = args;
  if (program.isError || sessions.isError) return 'hide';
  if (program.hasActive) return 'hide';
  if (!sessions.isLoading && (sessions.finishedCount ?? 0) > 0) return 'hide';
  if (program.isLoading) return 'loading';
  if (sessions.isLoading) return 'loading';
  return 'show';
}

/** R5 : la variante vide de Mission du jour est masquee tant que la carte occupe la place (affichee ou en chargement). */
export function hideEmptyMissionVariant(v: CardVisibility): boolean {
  return v !== 'hide';
}

/**
 * Ordre vertical UNIQUE de l'accueil, dans tous les etats (UAT phase 3 : l'ordre variait selon la carte) :
 * [carte "Crée ton premier entraînement" quand visible] > Mission du jour > Quetes du jour > Forme du jour.
 * Decision produit : "Forme du jour" passe aussi sous les Quetes pour un compte avec programme actif.
 */
export const HOME_BLOCK_ORDER = ['first-workout-card', 'mission', 'quests', 'forme-du-jour'] as const;

// ── Etats de credit ───────────────────────────────────────────────────────────────────

export interface CreditInfoLike {
  cost?: number | null;
  balance?: number | null;
  free_left?: number | null;
}

export const FIRST_WORKOUT_COPY = {
  eyebrow: 'Premier entraînement',
  title: 'Crée ton premier entraînement',
  subtitle: 'Trois façons de commencer.',
  groupLabel: 'Crée ton premier entraînement',
  free: 'Gratuit',
  exhausted: 'Crédits épuisés',
  unknownCost: 'Consomme des crédits IA',
  exhaustedBanner: 'Tes crédits IA sont épuisés. Le parcours manuel reste gratuit.',
  recommended: 'Conseillé',
  loadingLabel: 'Chargement de ton premier entraînement',
} as const;

export type PathId = 'manual' | 'ai-simple' | 'atelier';

export interface PathDef {
  id: PathId;
  name: string;
  deliverable: 'Programme' | 'Séance';
  sentence: string;
  route: string;
  icon: string; // Ionicons
  isAI: boolean;
}

// Ordre fixe du contrat (FWKO-03, 04, 05).
export const FIRST_WORKOUT_PATHS: readonly PathDef[] = [
  {
    id: 'manual', name: 'Manuel', deliverable: 'Programme',
    sentence: 'Tu construis ton programme en 4 étapes.',
    route: '/(app)/workout/program-builder', icon: 'list-outline', isAI: false,
  },
  {
    id: 'ai-simple', name: 'IA simple', deliverable: 'Séance',
    sentence: 'L’IA prépare une séance unique en quelques secondes.',
    route: '/(app)/workout/ai-generate', icon: 'sparkles-outline', isAI: true,
  },
  {
    id: 'atelier', name: 'Atelier IA', deliverable: 'Programme',
    sentence: 'Tu discutes, l’IA construit un programme complet.',
    route: '/(app)/workout/atelier', icon: 'chatbubbles-outline', isAI: true,
  },
] as const;

function validCost(c: number | null | undefined): number | null {
  return typeof c === 'number' && Number.isFinite(c) && c >= 1 ? Math.round(c) : null;
}
function validBalance(b: number | null | undefined): number | null {
  return typeof b === 'number' && Number.isFinite(b) ? Math.max(0, Math.round(b)) : null;
}

/** Libelle de solde, singulier pour 0 et 1. */
export function creditsWord(n: number): string {
  return n > 1 ? `${n} crédits` : `${n} crédit`;
}

export type CostTone = 'cost' | 'free' | 'exhausted' | 'unknown';

export interface CreditView {
  cost: number | null;
  balance: number | null;
  /** Solde < cout ET aucun quota gratuit restant (D-03). Faux si solde ou cout inconnu : jamais bloquant a l'aveugle. */
  exhausted: boolean;
  balanceLabel: string; // pastille ("—" si inconnu)
  balanceA11y: string;
  aiSimple: { label: string; tone: CostTone };
  atelier: { label: string; tone: CostTone };
}

export function computeCreditView(info: CreditInfoLike | null | undefined): CreditView {
  const cost = validCost(info?.cost);
  const balance = validBalance(info?.balance);
  const freeLeft = typeof info?.free_left === 'number' && info.free_left > 0 ? Math.floor(info.free_left) : 0;
  const exhausted = cost != null && balance != null && balance < cost && freeLeft === 0;
  const balanceLabel = balance == null ? '—' : creditsWord(balance);
  const balanceA11y = balance == null ? 'Solde indisponible' : `Solde : ${creditsWord(balance)}`;

  if (exhausted) {
    const ex = { label: FIRST_WORKOUT_COPY.exhausted, tone: 'exhausted' as CostTone };
    return { cost, balance, exhausted, balanceLabel, balanceA11y, aiSimple: ex, atelier: ex };
  }
  if (cost == null) {
    const un = { label: FIRST_WORKOUT_COPY.unknownCost, tone: 'unknown' as CostTone };
    return { cost, balance, exhausted, balanceLabel, balanceA11y, aiSimple: un, atelier: un };
  }
  const aiSimple = freeLeft > 0
    ? { label: freeLeft > 1 ? `${freeLeft} gratuites aujourd’hui` : '1 gratuite aujourd’hui', tone: 'free' as CostTone }
    : { label: creditsWord(cost), tone: 'cost' as CostTone };
  const atelier = freeLeft > 0
    ? { label: freeLeft > 1 ? `${freeLeft} messages gratuits aujourd’hui` : '1 message gratuit aujourd’hui', tone: 'free' as CostTone }
    : { label: `${creditsWord(cost)} par message`, tone: 'cost' as CostTone };
  return { cost, balance, exhausted, balanceLabel, balanceA11y, aiSimple, atelier };
}

export type PathAction =
  | { type: 'navigate'; route: string }
  | { type: 'exhausted'; balance: number; required: number };

/** Tap d'une rangee : Manuel navigue toujours ; une rangee IA epuisee ouvre l'ecran d'epuisement (D-03). */
export function pathAction(path: PathDef, view: CreditView): PathAction {
  if (path.isAI && view.exhausted && view.cost != null && view.balance != null) {
    return { type: 'exhausted', balance: view.balance, required: view.cost };
  }
  return { type: 'navigate', route: path.route };
}

export function pathCostView(path: PathDef, view: CreditView): { label: string; tone: CostTone } {
  if (path.id === 'manual') return { label: FIRST_WORKOUT_COPY.free, tone: 'free' };
  return path.id === 'ai-simple' ? view.aiSimple : view.atelier;
}

export function pathA11yLabel(path: PathDef, view: CreditView, badge?: string): string {
  const cost = pathCostView(path, view);
  const base = `${path.name}, ${path.deliverable.toLowerCase()}.${badge ? ` ${badge}.` : ''} ${path.sentence}`;
  if (path.isAI && view.exhausted) return `${base} ${FIRST_WORKOUT_COPY.exhausted}. Ouvre l’explication.`;
  return `${base} ${cost.label}.`;
}

// ── Onglet Entrainement (CLAR-01) ─────────────────────────────────────────────────────

export const TRAINING_EMPTY_COPY = {
  title: 'Aucun programme actif',
  body: 'Un programme organise tes séances sur plusieurs semaines. Tu préfères une seule séance ? Lance-la avec l’IA.',
  primary: 'Créer un programme',
  secondary: 'Générer une séance IA',
  secondaryExhausted: 'Séance IA, crédits épuisés',
  exhaustedHint: 'Reviens demain ou gagne des crédits en restant actif.',
  myPrograms: 'Mes programmes',
  plusLabel: 'Créer un entraînement',
  sheetTitle: 'Créer un programme',
  sheetSubtitle: 'Plusieurs séances organisées sur des semaines.',
  sheetManualName: 'Assistant en 4 étapes',
  sheetManualSentence: 'Objectif, durée, jours, exercices. Environ 2 minutes.',
  sheetAtelierSentence: 'Discute avec l’IA pour un programme très précis.',
  groupProgram: 'Programme',
  groupSession: 'Séance seule',
  cancel: 'Annuler',
} as const;

/** Pastille a cote de "Générer une séance IA" : cout serveur, quota gratuit, ou rien si inconnu ou epuise. */
export function sessionButtonBadge(view: CreditView): string | null {
  if (view.exhausted) return null;
  if (view.aiSimple.tone === 'free') return view.aiSimple.label;
  if (view.cost == null) return null;
  return creditsWord(view.cost);
}
