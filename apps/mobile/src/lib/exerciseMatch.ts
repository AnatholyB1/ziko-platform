// Appariement nom d'exercice d'un programme IA -> ligne du catalogue `ziko_exercises` (run4 P24 :
// "Squat" absent du catalogue sous ce nom bloquait toute la seance). Module pur, sans React.
//
// Regle (meme esprit que backend/api/src/lib/exerciseMatch.ts) :
//   1. egalite exacte apres normalisation (casse, accents, ponctuation, espaces) sur l'un des libelles
//      de la ligne : `name`, `name_fr`, traduction FR connue de `name` (dictionnaire exerciseNames) ;
//   2. alias generiques (ex. "squat" -> "back squat", le squat "nu" etant le squat arriere) ;
//   3. sinon l'UNIQUE ligne dont un libelle contient tous les mots de la requete ; plusieurs -> aucune
//      (ambigu : on ne devine pas).

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

/** Alias generiques : requete normalisee -> libelle normalise du catalogue a essayer ensuite. */
const GENERIC_ALIASES: Record<string, string> = {
  squat: 'back squat',
  'barbell squat': 'back squat',
  'squat barre': 'back squat',
  'squat arriere': 'back squat',
};

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

/** Renvoie la ligne retenue ou null (introuvable / ambigu). */
export function resolveExercise(
  query: string,
  rows: CatalogRow[],
  frNames: Record<string, string> = {},
): CatalogRow | null {
  const q = normalizeExerciseName(query);
  if (!q || rows.length === 0) return null;
  const labelled = rows.map((r) => ({ r, labels: labelsOf(r, frNames) }));

  const exact = (target: string) => labelled.find((x) => x.labels.includes(target))?.r ?? null;
  const direct = exact(q);
  if (direct) return direct;
  const alias = GENERIC_ALIASES[q];
  if (alias) {
    const viaAlias = exact(alias);
    if (viaAlias) return viaAlias;
  }

  const qWords = q.split(' ');
  const near = labelled.filter((x) =>
    x.labels.some((l) => {
      const words = l.split(' ');
      return qWords.every((w) => words.includes(w));
    }),
  );
  return near.length === 1 ? near[0].r : null;
}

/** Motifs ilike a envoyer au catalogue pour retrouver les candidats d'un nom (pre-filtre serveur). */
export function searchPatternsFor(query: string, frNames: Record<string, string> = {}): string[] {
  const q = normalizeExerciseName(query);
  if (!q) return [];
  const patterns = new Set<string>();
  const longest = [...q.split(' ')].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length >= 3) patterns.add(`%${longest}%`);
  const alias = GENERIC_ALIASES[q];
  if (alias) patterns.add(`%${alias.split(' ').sort((a, b) => b.length - a.length)[0]}%`);
  // Requete en francais : retrouver l'equivalent anglais par le dictionnaire (les colonnes name sont en anglais).
  for (const [en, fr] of Object.entries(frNames)) {
    if (normalizeExerciseName(fr) === q) patterns.add(`%${en.replace(/[%,()]/g, ' ').trim()}%`);
  }
  return [...patterns];
}
