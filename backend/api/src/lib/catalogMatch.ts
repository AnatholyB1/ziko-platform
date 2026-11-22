// Appariement nom d'exercice (programme IA, seance IA generee, saisie libre du program-builder) -> ligne du
// catalogue `ziko_exercises`. Module pur, sans React.
//
// run4 P24 : "Squat" absent du catalogue bloquait la seance. run5 : le catalogue reel (1318 lignes, source
// kaggle) n'a NI "Back Squat" NI "Squat" ; le squat "nu" y est "barbell full squat" (+ "barbell high bar squat",
// "barbell low bar squat", "weighted squat", "smith squat", "dumbbell squat", ...). Un alias fixe ne trouve rien.
// UAT phase 3 (rerun) : 1 exercice sur 4 apparie pour une seance IA ("Squat goblet" ex aequo haltere/kettlebell,
// "Developpe couche halteres" jamais pre-filtre : le motif `%developpe%` ne trouve pas l'anglais ni les accents).
//
// Regle :
//   0. normalisation : casse, accents, ponctuation, pluriel, ordre des mots ignore (ensembles de tokens) ;
//      les tokens FR sont traduits en tokens EN (alias : developpe couche = bench press, rowing = row, gainage = plank,
//      barre = barbell...) des DEUX cotes (requete ET libelles du catalogue) ;
//   1. egalite exacte des ensembles de tokens sur un libelle de la ligne : `name`, `name_fr`, traduction FR connue ;
//   2. sinon score par recouvrement : on garde les lignes dont un libelle contient TOUS les tokens de la requete, puis
//      on penalise les tokens EN PLUS du libelle : mouvement de base (barbell, full) ~ 0, autre materiel 3, variante
//      (jump, split, front, single, leg...) 10. Au-dela de MAX_APPROX_COST la ligne est trop eloignee : refusee ;
//   3. repli (requete d'au moins 4 tokens) : couverture partielle >= 75 % des tokens de la requete ;
//   4. meilleur score strictement meilleur que le second ; a egalite, preference de materiel (barre > haltere >
//      poids du corps > poulie > kettlebell...) si elle departage ; sinon ambigu -> null (l'exercice est ignore).

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

/**
 * Alias FR -> EN (cles = mots normalises, singulier ou pluriel). Valeur '' = mot vide ignore ; plusieurs mots
 * possibles ("traction" -> "pull up"). Applique aux libelles du catalogue comme aux requetes : les deux cotes vivent
 * dans le meme espace de tokens, donc une ligne FR "developpe couche barre" == "barbell bench press".
 */
const TOKEN_SYNONYMS: Record<string, string> = {
  barre: 'barbell',
  halteres: 'dumbbell',
  haltere: 'dumbbell',
  arriere: 'back',
  avant: 'front',
  poids: 'weighted',
  developpe: 'press',
  couche: 'bench',
  rowing: 'row',
  gainage: 'front plank',
  planche: 'front plank',
  souleve: 'deadlift',
  terre: '',
  de: '',
  du: '',
  des: '',
  la: '',
  le: '',
  au: '',
  a: '',
  et: '',
  traction: 'pull up',
  tractions: 'pull up',
  pompe: 'push up',
  pompes: 'push up',
  fente: 'lunge',
  fentes: 'lunge',
  poulie: 'cable',
  bras: 'arm',
  jambe: 'leg',
  jambes: 'leg',
  militaire: 'military',
  neutre: 'neutral',
  prise: 'grip',
  serree: 'close',
  large: 'wide',
  mollet: 'calf',
  mollets: 'calf',
  elevation: 'raise',
  elevations: 'raise',
  ecarte: 'fly',
  ecartes: 'fly',
  roumain: 'romanian',
};

function stem(w: string): string {
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokensOf(normalized: string): string[] {
  const out: string[] = [];
  for (const w of normalized.split(' ').filter(Boolean)) {
    const mapped = TOKEN_SYNONYMS[w] ?? TOKEN_SYNONYMS[stem(w)] ?? w;
    for (const m of mapped.split(' ').filter(Boolean)) {
      const t = stem(m);
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
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

/** Cout maximal d'un remplacement approximatif : au-dela, la ligne est un autre exercice (faux positif). */
export const MAX_APPROX_COST = 3;
/** Repli par couverture partielle : part minimale des tokens de la requete retrouves dans le libelle. */
export const MIN_PARTIAL_COVERAGE = 0.75;
const MIN_TOKENS_FOR_PARTIAL = 4;

function extraCost(token: string): number {
  if (BASE_TOKENS.has(token)) return 0;
  if (EQUIPMENT_TOKENS.has(token)) return token === 'weighted' ? 2 : 3;
  if (VARIATION_TOKENS.has(token)) return 10;
  return 2;
}

// Preference de materiel quand deux lignes sont a egalite de score (plus petit = prefere).
const EQUIPMENT_RANK: Record<string, number> = {
  barbell: 0, dumbbell: 1, bodyweight: 2, cable: 3, kettlebell: 4, lever: 5, smith: 6, band: 7, sled: 8,
};
function equipmentRank(labelTokens: string[]): number {
  let r = 99;
  for (const t of labelTokens) if (t in EQUIPMENT_RANK) r = Math.min(r, EQUIPMENT_RANK[t]);
  return r;
}

export function labelsOf(row: CatalogRow, frNames: Record<string, string>): string[] {
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

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t) => b.includes(t));
}

interface Scored { r: CatalogRow; cost: number; coverage: number; rank: number }

export function matchExercise(
  query: string,
  rows: CatalogRow[],
  frNames: Record<string, string> = {},
): ExerciseMatch | null {
  const q = normalizeExerciseName(query);
  if (!q || rows.length === 0) return null;
  const labelled = rows.map((r) => ({ r, labels: labelsOf(r, frNames) }));

  // 1. Egalite d'ensembles de tokens (ordre, casse, accents, pluriel, alias FR/EN ignores).
  const qAll = tokensOf(q);
  const direct = labelled.find((x) => x.labels.some((l) => l === q || sameSet(tokensOf(l), qAll)));
  if (direct) return { row: direct.r, kind: 'exact' };

  const qToks = queryTokens(q);
  if (qToks.length === 0) return null;
  const qSet = new Set(qToks);

  const score = (minCoverage: number): Scored[] => {
    const scored: Scored[] = [];
    for (const x of labelled) {
      let best: Scored | null = null;
      for (const l of x.labels) {
        const toks = tokensOf(l);
        const set = new Set(toks);
        const found = qToks.filter((t) => set.has(t)).length;
        const coverage = found / qToks.length;
        if (coverage < minCoverage) continue;
        // "back" n'est pas un surcout pour un squat : le squat nu EST le squat arriere.
        const cost = toks.filter((t) => !qSet.has(t) && !(t === 'back' && qSet.has('squat'))).reduce((n, t) => n + extraCost(t), 0);
        if (cost > MAX_APPROX_COST) continue;
        const cand: Scored = { r: x.r, cost, coverage, rank: equipmentRank(toks) };
        if (!best || cand.coverage > best.coverage || (cand.coverage === best.coverage && cand.cost < best.cost)) best = cand;
      }
      if (best) scored.push(best);
    }
    return scored;
  };

  // 2. Tous les tokens de la requete ; 3. repli par couverture partielle (requetes longues uniquement).
  let scored = score(1);
  if (scored.length === 0 && qToks.length >= MIN_TOKENS_FOR_PARTIAL) scored = score(MIN_PARTIAL_COVERAGE);
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.coverage - a.coverage || a.cost - b.cost || a.rank - b.rank);
  if (scored.length > 1) {
    const [a, b] = scored;
    if (a.coverage === b.coverage && a.cost === b.cost && a.rank === b.rank) return null; // ambigu : on ne devine pas
  }
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

/** Libelle a afficher pour une ligne du catalogue (francais d'abord). */
export function exerciseRowLabel(row: CatalogRow): string {
  return String(row.name_fr ?? row.name ?? '').trim();
}

/**
 * Suggestions pendant la frappe : lignes dont chaque token de la saisie est (le debut d') un token du libelle, les
 * plus proches du mouvement de base d'abord. Le dernier mot peut etre incomplet ("squ" -> squat).
 */
export function suggestExercises(
  query: string,
  rows: CatalogRow[],
  frNames: Record<string, string> = {},
  limit = 5,
): CatalogRow[] {
  const q = normalizeExerciseName(query);
  if (q.length < 2) return [];
  // Un mot FR incomplet ("dévelop") peut aussi etre le debut d'un alias ("developpe" -> press).
  const groups: string[][] = q.split(' ').filter(Boolean).map((w) => {
    const alts = new Set<string>(tokensOf(w));
    if (w.length >= 3) {
      for (const [k, v] of Object.entries(TOKEN_SYNONYMS)) {
        if (k.startsWith(w) && v) tokensOf(k).forEach((t) => alts.add(t));
      }
    }
    return [...alts];
  }).filter((g) => g.length > 0);
  if (groups.length === 0) return [];
  const flat = groups.flat();
  const out: Array<{ r: CatalogRow; cost: number; rank: number }> = [];
  for (const r of rows) {
    let best: { cost: number; rank: number } | null = null;
    for (const l of labelsOf(r, frNames)) {
      const toks = tokensOf(l);
      const ok = groups.every((g) => g.some((t) => toks.some((lt) => lt === t || (t.length >= 2 && lt.startsWith(t)))));
      if (!ok) continue;
      const cost = toks.filter((t) => !flat.some((qt) => t === qt || t.startsWith(qt))).reduce((n, t) => n + extraCost(t), 0);
      if (!best || cost < best.cost) best = { cost, rank: equipmentRank(toks) };
    }
    if (best) out.push({ r, ...best });
  }
  out.sort((a, b) => a.cost - b.cost || a.rank - b.rank);
  return out.slice(0, limit).map((x) => x.r);
}

/** Verdict sur une saisie libre du program-builder : un exercice doit exister dans le catalogue. */
export type WizardEntryCheck =
  | { status: 'empty' }
  | { status: 'resolved'; row: CatalogRow; label: string; kind: 'exact' | 'approx' }
  | { status: 'unresolved'; message: string };

export function checkWizardExerciseEntry(
  input: string,
  rows: CatalogRow[],
  frNames: Record<string, string> = {},
): WizardEntryCheck {
  const text = input.trim();
  if (!text) return { status: 'empty' };
  const m = matchExercise(text, rows, frNames);
  if (m) return { status: 'resolved', row: m.row, label: exerciseRowLabel(m.row) || text, kind: m.kind };
  return {
    status: 'unresolved',
    message: `« ${text} » n'est pas dans le catalogue. Choisis un exercice dans les suggestions.`,
  };
}

const GENERIC_PATTERN_TOKENS = new Set([...BASE_TOKENS, ...EQUIPMENT_TOKENS]);

/** Motifs ilike a envoyer au catalogue pour retrouver les candidats d'un nom (pre-filtre serveur). */
export function searchPatternsFor(query: string, frNames: Record<string, string> = {}): string[] {
  const q = normalizeExerciseName(query);
  if (!q) return [];
  const patterns = new Set<string>();
  // Tokens EN (alias traduits) : les colonnes `name` sont en anglais ; les 2 plus longs non generiques pre-filtrent
  // (le materiel seul ramenerait la moitie du catalogue). Le singulier couvre "squats".
  const toks = queryTokens(q).filter((t) => t.length >= 3);
  const specific = toks.filter((t) => !GENERIC_PATTERN_TOKENS.has(t));
  const chosen = (specific.length > 0 ? specific : toks).sort((a, b) => b.length - a.length).slice(0, 2);
  for (const t of chosen) patterns.add(`%${t}%`);
  // Mots saisis avec leurs accents : `name_fr` est accentue ("développé"), `%developpe%` ne le trouverait pas.
  const raw = String(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  for (const w of raw.sort((a, b) => b.length - a.length).slice(0, 2)) patterns.add(`%${w.replace(/[%,()]/g, ' ').trim()}%`);
  // Requete en francais : retrouver l'equivalent anglais par le dictionnaire (les colonnes name sont en anglais).
  for (const [en, fr] of Object.entries(frNames)) {
    if (normalizeExerciseName(fr) === q) patterns.add(`%${en.replace(/[%,()]/g, ' ').trim()}%`);
  }
  return [...patterns];
}
