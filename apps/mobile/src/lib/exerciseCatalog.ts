// Recherche des candidats du catalogue `ziko_exercises` pour une saisie (program-builder : suggestions + validation).
// Le pre-filtre serveur (searchPatternsFor) ramene quelques dizaines de lignes ; matchExercise / suggestExercises
// font ensuite le tri cote client. Le client Supabase est injecte (testable sans reseau).
import { searchPatternsFor, type CatalogRow } from './exerciseMatch';

type CatalogClient = { from: (table: string) => any };

export async function fetchCatalogCandidates(
  client: CatalogClient,
  text: string,
  frNames: Record<string, string> = {},
): Promise<CatalogRow[]> {
  const patterns = searchPatternsFor(text, frNames);
  if (patterns.length === 0) return [];
  const { data, error } = await client
    .from('ziko_exercises')
    .select('id,name,name_fr')
    .or(patterns.flatMap((p) => [`name.ilike.${p}`, `name_fr.ilike.${p}`]).join(','))
    .limit(600);
  if (error) throw error;
  return (data ?? []) as CatalogRow[];
}
