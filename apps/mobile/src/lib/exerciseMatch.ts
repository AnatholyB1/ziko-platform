// Appariement nom d'exercice d'un programme IA -> ligne du catalogue `ziko_exercises`.
// Module pur, sans React.
//
// run4 P24 : "Squat" absent du catalogue bloquait la seance. run5 : le catalogue reel (1318 lignes, source
// kaggle) n'a NI "Back Squat" NI "Squat" ; le squat "nu" y est "barbell full squat" (+ "barbell high bar squat",
// "barbell low bar squat", "weighted squat", "smith squat", "dumbbell squat", ...). Un alias fixe ne trouve rien.
//
// Regle :
//   1. egalite exacte apres normalisation (casse, accents, ponctuation, pluriel) sur un libelle de la ligne :
//      `name`, `name_fr`, traduction FR connue de `name` (dictionnaire exerciseNames) ;
//   2. sinon score par recouvrement de tokens : on garde les lignes dont un libelle contient TOUS les tokens de la
//      requete (synonymes FR/EN : barre -> barbell, arriere -> back...), puis on penalise les tokens EN PLUS du
//      libelle : mouvement de base (barbell, full) ~ 0, autre materiel 3, variante (jump, split, front, single,
//      leg...) 10. La meilleure ligne gagne si elle est strictement meilleure que la seconde ;
//   3. egalite au meilleur score -> ambigu -> null (le demarrage de seance ne bloque pas, l'exercice est ignore).

export interface CatalogRow {
  id: string;
  name?: string | null;
  name_fr?: string | null;
  [k: string]: any;
}

export function normalizeExerciseName(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Synonymes FR -> EN (tokens normalises) pour comparer a des libelles de catalogue anglais. */
const TOKEN_SYNONYMS: Record<string, string> = {
  barre: 'barbell',
  halteres: 'dumbbell',
  haltere: 'dumbbell',
  arriere: 'back',
  avant: 'front',
  poids: 'weighted',
};

function stem(w: string): string {
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function tokensOf(normalized: string): string[] {
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((w) => stem(TOKEN_SYNONYMS[w] ?? w));
}

// Tokens EN PLUS dans un libelle candidat : cout (plus bas = plus proche du mouvement de base).
const BASE_TOKENS = new Set(['barbell', 'full', 'bar']);
const EQUIPMENT_TOKENS = new Set(['dumbbell', 'smith', 'kettlebell', 'band', 'cable', 'sled', 'lever', 'weighted', 'bodyweight']);
const VARIATION_TOKENS = new Set([
  'single', 'leg', 'split', 'jump', 'row', 'curl', 'front', 'overhead', 'zercher', 'jefferson', 'sissy', 'hack',
  'pistol', 'side', 'plyo', 'step', 'lunge', 'pov', 'v', '2', 'male', 'calf', 'raise', 'bosu', 'ball', 'reach',
  'twist', 'jerk', 'drop', 'kneeling', 'knee', 'on', 'cossack', 'curtsey', 'frankenstein', 'potty', 'support',
  'supported', 'speed', 'closer', 'lying', 'chair', 'sumo', 'bench', 'goblet', 'narrow', 'wide', 'stance', 'one',
  'arm', 'back', 'seated', 'chest', 'suspended', 'get', 'up', 'turkish', 'style', 'semi', 'to', 'with',
]);

function extraCost(token: string): number {
  if (BASE_TOKENS.has(token)) return 0;
  if (EQUIPMENT_TOKENS.has(token)) return token === 'weighted' ? 2 : 3;
  if (VARIATION_TOKENS.has(token)) return 10;
  return 2;
}

function labelsOf(row: CatalogRow, frNames: Record<string, string>): string[] {
  const out: string[] = [];
  const name = String(row.name ?? '');
  if (name) {
    out.push(name);
    const fr = frNames[name] ?? Object.entries(frNames).find(([k]) => normalizeExerciseName(k) === normalizeExerciseName(name))?.[1];
    if (fr) out.push(fr);
  }
  if (row.name_fr) out.push(String(row.name_fr));
  return out.map(normalizeExerciseName).filter(Boolean);
}

export interface ExerciseMatch {
  row: CatalogRow;
  /** 'exact' : meme libelle ; 'approx' : ligne la plus proche (a signaler par un toast "remplace par"). */
  kind: 'exact' | 'approx';
}

/** Tokens de la requete, "back"/"arriere" ignores pour un squat (le squat nu EST le squat arriere). */
function queryTokens(q: string): string[] {
  const toks = tokensOf(q);
  return toks.includes('squat') ? toks.filter((t) => t !== 'back') : toks;
}

export function matchExercise(
  query: string,
  rows: CatalogRow[],
  frNames: Record<string, string> = {},
): ExerciseMatch | null {
  const q = normalizeExerciseName(query);
  if (!q || rows.length === 0) return null;
  const labelled = rows.map((r) => ({ r, labels: labelsOf(r, frNames) }));

  const qStem = tokensOf(q).join(' ');
  const direct = labelled.find((x) => x.labels.some((l) => l === q || tokensOf(l).join(' ') === qStem));
  if (direct) return { row: direct.r, kind: 'exact' };

  const qToks = queryTokens(q);
  if (qToks.length === 0) return null;
  const qSet = new Set(qToks);
  const scored: Array<{ r: CatalogRow; cost: number }> = [];
  for (const x of labelled) {
    let best = Infinity;
    for (const l of x.labels) {
      const toks = tokensOf(l);
      const set = new Set(toks);
      if (!qToks.every((t) => set.has(t))) continue;
      const cost = toks.filter((t) => !qSet.has(t)).reduce((n, t) => n + extraCost(t), 0);
      if (cost < best) best = cost;
    }
    if (best !== Infinity) scored.push({ r: x.r, cost: best });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.cost - b.cost);
  if (scored.length > 1 && scored[1].cost === scored[0].cost) return null; // ambigu : on ne devine pas
  return { row: scored[0].r, kind: 'approx' };
}

/** Renvoie la ligne retenue ou null (introuvable / ambigu). */
export function resolveExercise(
  query: string,
  rows: CatalogRow[],
  frNames: Record<string, string> = {},
): CatalogRow | null {
  return matchExercise(query, rows, frNames)?.row ?? null;
}

/** Motifs ilike a envoyer au catalogue pour retrouver les candidats d'un nom (pre-filtre serveur). */
export function searchPatternsFor(query: string, frNames: Record<string, string> = {}): string[] {
  const q = normalizeExerciseName(query);
  if (!q) return [];
  const patterns = new Set<string>();
  const toks = queryTokens(q);
  // Le token le plus long (hors synonymes FR deja traduits) pre-filtre le catalogue ; le singulier couvre "squats".
  const longest = [...toks].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length >= 3) patterns.add(`%${longest}%`);
  // Requete en francais : retrouver l'equivalent anglais par le dictionnaire (les colonnes name sont en anglais).
  for (const [en, fr] of Object.entries(frNames)) {
    if (normalizeExerciseName(fr) === q) patterns.add(`%${en.replace(/[%,()]/g, ' ').trim()}%`);
  }
  return [...patterns];
}
