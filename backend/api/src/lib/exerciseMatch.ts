// Appariement de noms d'exercices (run3 P24 : "Squat" ne doit JAMAIS etre rapproche de "jump squat").
// Regle : 1) egalite exacte apres normalisation (casse, accents, ponctuation, espaces) ;
//         2) sinon, UN SEUL candidat dont les mots contiennent ceux de la requete ; plusieurs -> aucun
//            (ambigu : on ne devine pas). Module pur.

export function normalizeExerciseName(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Renvoie les candidats retenus : tous les exacts normalises, sinon l'unique plus proche, sinon []. */
export function matchExerciseNames(query: string, candidates: string[]): string[] {
  const q = normalizeExerciseName(query);
  if (!q) return [];
  const exact = candidates.filter((c) => normalizeExerciseName(c) === q);
  if (exact.length > 0) return exact;
  const qWords = q.split(' ');
  const near = candidates.filter((c) => {
    const words = normalizeExerciseName(c).split(' ');
    return qWords.every((w) => words.includes(w));
  });
  return near.length === 1 ? near : [];
}
