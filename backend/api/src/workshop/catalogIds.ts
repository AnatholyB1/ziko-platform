// Publication d'un brouillon : rattache chaque exercice libre du modele a une ligne du catalogue `ziko_exercises`
// (exercise_id). Sans cela l'app doit apparier les noms au demarrage de la seance et les exercices non reconnus sont
// ignores (FK). Meme appariement que l'app (catalogMatch = copie de apps/mobile/src/lib/exerciseMatch.ts).
import type { WorkshopDb } from './context.js';
import type { DraftProgram } from './draft.js';
import { matchExercise, searchPatternsFor, type CatalogRow } from '../lib/catalogMatch.js';

/** "Squat barre (avec ceinture)" -> "Squat barre" : les precisions entre parentheses ne sont pas dans le catalogue. */
export function cleanExerciseName(name: string): string {
  const cleaned = String(name ?? '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || String(name ?? '').trim();
}

/** Renvoie une copie du programme ou chaque exercice sans exercise_id reconnu recoit celui du catalogue. */
export async function withCatalogIds(db: WorkshopDb, program: DraftProgram): Promise<DraftProgram> {
  const names = new Set<string>();
  program.weeks.forEach((w) => w.sessions.forEach((s) => s.exercises.forEach((e) => names.add(cleanExerciseName(e.name)))));
  const patterns = [...new Set([...names].flatMap((n) => searchPatternsFor(n)))];
  if (patterns.length === 0) return program;

  let candidates: CatalogRow[] = [];
  try {
    const { data } = await (db as any)
      .from('ziko_exercises')
      .select('id,name,name_fr')
      .or(patterns.flatMap((p) => [`name.ilike.${p}`, `name_fr.ilike.${p}`]).join(','))
      .limit(1000);
    candidates = (data ?? []) as CatalogRow[];
  } catch {
    return program; // best effort : la publication ne doit jamais echouer pour cela
  }
  if (candidates.length === 0) return program;

  const cache = new Map<string, string | null>();
  const idFor = (raw: string): string | null => {
    const key = cleanExerciseName(raw);
    if (!cache.has(key)) cache.set(key, matchExercise(key, candidates)?.row.id ?? matchExercise(raw, candidates)?.row.id ?? null);
    return cache.get(key)!;
  };
  return {
    ...program,
    weeks: program.weeks.map((w) => ({
      ...w,
      sessions: w.sessions.map((s) => ({
        ...s,
        exercises: s.exercises.map((e) => {
          if ((e as any).exercise_id) return e;
          const id = idFor(e.name);
          return id ? ({ ...e, exercise_id: id } as typeof e) : e;
        }),
      })),
    })),
  };
}
