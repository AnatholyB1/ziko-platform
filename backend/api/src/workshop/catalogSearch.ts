// Outil `workshop_find_exercises` : le modele cherche ses exercices DANS le catalogue `ziko_exercises` au lieu de les
// inventer (les noms libres ne sont retrouves qu'a ~40 % par l'app : catalogue source EN, libelles FR specifiques).
import type { WorkshopDb } from './context.js';
import { labelsOf, matchExercise, normalizeExerciseName, searchPatternsFor, tokensOf, type CatalogRow } from '../lib/catalogMatch.js';
import { cleanExerciseName } from './catalogIds.js';

export interface CatalogHit {
  id: string;
  name: string;
}

export const MAX_FIND_QUERIES = 40;

export async function findCatalogExercises(db: WorkshopDb, queries: string[]): Promise<Array<{ query: string; results: CatalogHit[] }>> {
  const qs = [...new Set(queries.map((q) => String(q ?? '').trim()).filter(Boolean))].slice(0, MAX_FIND_QUERIES);
  return Promise.all(
    qs.map(async (query) => {
      const cleaned = cleanExerciseName(query);
      const patterns = searchPatternsFor(cleaned);
      if (patterns.length === 0) return { query, results: [] };
      let rows: CatalogRow[] = [];
      try {
        const { data } = await (db as any)
          .from('ziko_exercises')
          .select('id,name,name_fr')
          .or(patterns.flatMap((p) => [`name.ilike.${p}`, `name_fr.ilike.${p}`]).join(','))
          .limit(600);
        rows = (data ?? []) as CatalogRow[];
      } catch {
        return { query, results: [] };
      }
      const qTok = tokensOf(normalizeExerciseName(cleaned));
      if (qTok.length === 0) return { query, results: [] };
      const scored = rows
        .map((r) => {
          let best = -1;
          for (const l of labelsOf(r, {})) {
            const toks = tokensOf(l);
            const found = qTok.filter((t) => toks.includes(t)).length;
            const coverage = found / qTok.length;
            if (coverage < 0.5) continue;
            const s = coverage * 10 - (toks.length - found) * 0.5;
            if (s > best) best = s;
          }
          return { r, s: best };
        })
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 5);
      // Le meilleur rapprochement de l'app (celui qu'elle retrouvera au demarrage de la seance) passe en tete.
      const best = matchExercise(cleaned, rows)?.row;
      const ordered = best ? [best, ...scored.map((x) => x.r).filter((r) => r.id !== best.id)] : scored.map((x) => x.r);
      return { query, results: ordered.slice(0, 5).map((r) => ({ id: r.id, name: String(r.name_fr ?? r.name ?? '') })) };
    }),
  );
}
