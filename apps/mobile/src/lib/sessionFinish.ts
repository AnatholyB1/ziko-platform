/**
 * Fin de seance : l'ecriture des totaux (total_sets, total_volume_kg...) ne doit JAMAIS etre avalee.
 * Sans totaux, la seance est exclue de Recent / semaine (TRAIN-03) : l'utilisateur verrait le resume
 * alors que la seance est perdue (revue A #7).
 */
type SupabaseLike = { from: (table: string) => any };

/** UPDATE des totaux ; `.update()` de supabase-js ne leve pas : on transforme `error` en exception. */
export async function writeSessionTotals(
  client: SupabaseLike,
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.from('ziko_workout_sessions').update(patch).eq('id', sessionId);
  if (error) throw new Error(`session totals: ${error.message ?? String(error)}`);
}

/** Execute `save` jusqu'a `attempts` fois ; true si l'une reussit, false sinon (jamais d'exception). */
export async function saveWithRetry(
  save: () => Promise<void>,
  attempts = 2,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await save();
      return true;
    } catch {
      if (i < attempts - 1) await wait(600);
    }
  }
  return false;
}
