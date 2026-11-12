// ============================================================
// displayLabels — libelles d'affichage communs (XCUT-01/02/06)
// Fonctions pures, sans dependance native, testables sous vitest.
// ============================================================

// ── Objectifs (XCUT-01) ──────────────────────────────────────

const GOAL_LABELS_FR: Record<string, string> = {
  muscle_gain: 'Prise de muscle',
  fat_loss: 'Perte de gras',
  weight_loss: 'Perte de poids',
  body_comp: 'Recomposition corporelle',
  recomposition: 'Recomposition corporelle',
  maintenance: 'Maintien',
  endurance: 'Endurance',
  strength: 'Force',
  hypertrophy: 'Hypertrophie',
  performance: 'Performance',
  health: 'Santé générale',
  wellness: 'Bien-être',
  general_fitness: 'Forme générale',
  flexibility: 'Souplesse',
  mobility: 'Mobilité',
  toning: 'Tonification',
};

const SLUG_RE = /^[a-z0-9]+(?:[_-][a-z0-9]+)+$|^[a-z]+$/;

/**
 * Libelle francais d'un slug d'objectif (`muscle_gain` -> `Prise de muscle`).
 * Un texte deja lisible (espaces, majuscules, accents) est renvoye tel quel ;
 * un slug inconnu est humanise (`some_new_goal` -> `Some new goal`) plutot
 * qu'affiche brut. Valeur vide -> `fallback`.
 */
export function goalLabel(slug: string | null | undefined, fallback = ''): string {
  if (!slug) return fallback;
  const raw = String(slug).trim();
  if (!raw) return fallback;
  const key = raw.toLowerCase();
  if (GOAL_LABELS_FR[key]) return GOAL_LABELS_FR[key];
  if (SLUG_RE.test(raw)) return capitalizeFirst(raw.replace(/[_-]+/g, ' '));
  return raw;
}

// ── Casse ────────────────────────────────────────────────────

/** Majuscule sur la premiere lettre, reste inchange ("developpe couche" -> "Developpe couche"). */
export function capitalizeFirst(text: string | null | undefined): string {
  if (!text) return '';
  const s = String(text).trim();
  return s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);
}

/**
 * Nom d'exercice a afficher (XCUT-06) : nom FR de la base si present, sinon
 * table de traduction fournie, sinon nom d'origine ; toujours avec majuscule
 * initiale. Les noms tout en majuscules sont ramenes en casse de phrase.
 */
export function exerciseDisplayName(
  name: string | null | undefined,
  nameFr?: string | null,
  dict?: Record<string, string>,
): string {
  const picked = (nameFr && nameFr.trim()) || (name && dict?.[name]) || name || '';
  let s = String(picked).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length > 3 && letters === letters.toLocaleUpperCase('fr-FR')) {
    s = s.toLocaleLowerCase('fr-FR');
  }
  return capitalizeFirst(s);
}

// ── Dates francaises, sans dependance a Intl (XCUT-02) ───────
// Hermes/Android peut retomber sur "May" si la locale fr manque : tables fixes.

export const MONTHS_FR_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
export const MONTHS_FR_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];
export const WEEKDAYS_FR_LONG = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
];
export const WEEKDAYS_FR_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export interface FormatDateFrOptions {
  weekday?: 'long' | 'short';
  day?: 'numeric' | '2-digit';
  month?: 'long' | 'short' | '2-digit' | 'numeric';
  year?: 'numeric' | '2-digit';
}

/**
 * Equivalent deterministe de `toLocaleDateString('fr-FR', opts)`.
 * Ex. {day:'numeric', month:'short'} -> "12 nov." ; {month:'long'} -> "novembre".
 */
export function formatDateFr(
  input: Date | string | number | null | undefined,
  opts: FormatDateFrOptions = { day: 'numeric', month: 'numeric', year: 'numeric' },
): string {
  if (input === null || input === undefined || input === '') return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = opts.day ? (opts.day === '2-digit' ? pad(d.getDate()) : String(d.getDate())) : '';
  const year = opts.year ? (opts.year === '2-digit' ? pad(d.getFullYear() % 100) : String(d.getFullYear())) : '';
  const weekday = opts.weekday
    ? (opts.weekday === 'long' ? WEEKDAYS_FR_LONG : WEEKDAYS_FR_SHORT)[d.getDay()]
    : '';

  // Mois numerique : format JJ/MM/AAAA a la francaise
  if (opts.month === '2-digit' || opts.month === 'numeric') {
    const m = opts.month === '2-digit' ? pad(d.getMonth() + 1) : String(d.getMonth() + 1);
    const parts = [day, m, year].filter(Boolean).join('/');
    return [weekday, parts].filter(Boolean).join(' ');
  }

  const month = opts.month
    ? (opts.month === 'long' ? MONTHS_FR_LONG : MONTHS_FR_SHORT)[d.getMonth()]
    : '';
  return [weekday, day, month, year].filter(Boolean).join(' ');
}

// ── Safe-area (XCUT-03) ──────────────────────────────────────

/**
 * Padding haut a ajouter pour qu'un en-tete place a `windowY` (px ecran) ne
 * passe pas sous la barre de statut (`insetTop`). 0 si deja degage : evite le
 * double padding quand l'ecran est deja dans un SafeAreaView.
 */
export function topInsetShortfall(windowY: number, insetTop: number): number {
  if (!Number.isFinite(windowY) || !Number.isFinite(insetTop)) return 0;
  return Math.max(0, Math.ceil(insetTop - windowY));
}

// ── Bouton bug flottant (XCUT-04) ────────────────────────────

export interface FabBounds {
  screenW: number;
  screenH: number;
  size: number;
  insetTop: number;
  insetBottom: number;
  /** Hauteur reservee en bas pour la barre d'onglets. */
  tabBarH: number;
  gutter: number;
}

/** Contraint la position (coin haut-gauche) du FAB dans la zone utile de l'ecran. */
export function clampFabPosition(x: number, y: number, b: FabBounds): { x: number; y: number } {
  const minX = b.gutter;
  const maxX = Math.max(minX, b.screenW - b.size - b.gutter);
  const minY = b.insetTop + b.gutter;
  const maxY = Math.max(minY, b.screenH - b.size - b.insetBottom - b.tabBarH - b.gutter);
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

/** Accroche le FAB au bord gauche ou droit le plus proche. */
export function snapFabX(x: number, b: FabBounds): number {
  const left = b.gutter;
  const right = Math.max(left, b.screenW - b.size - b.gutter);
  return x + b.size / 2 < b.screenW / 2 ? left : right;
}
