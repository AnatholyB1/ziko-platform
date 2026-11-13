// Revue B (M4 / M5) : plafond de cout journalier RESERVE AVANT l'appel modele.
//
// Avant : le plafond comptait les lignes de ziko_ai_cost_log ecrites APRES un appel reussi, en fire-and-forget. Des appels
// paralleles passaient tous sous le plafond, et un appel en echec (qui peut avoir ete facture) n'etait pas compte.
// Maintenant : on INSERE d'abord une ligne de reservation (jetons a 0), puis on compte les lignes du jour dans l'ordre
// (created_at, id) : l'appel n'a lieu que si NOTRE ligne est dans les `cap` premieres. Les appels simultanes se
// departagent donc sur le meme ordre (au plus `cap` passent) ; une reservation refusee est supprimee (au mieux) ; un echec
// du modele laisse la ligne reservee (le plafond est consomme). A la fin, `settleCostSlot` ecrit les jetons reels.
// Echec d'ecriture de la reservation => refus (on ne depense pas sans pouvoir compter).

export interface ReserveDb {
  from(table: string): any;
}

export interface CostUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

export type ReserveResult = { ok: true; id: string } | { ok: false; reason: 'daily_cap' | 'error' };

/** Debut du jour UTC (meme convention que les plafonds P23 / P24). */
export function utcDayStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function reserveCostSlot(
  db: ReserveDb,
  p: { userId: string; source: string; model: string; dailyCap: number; now?: Date },
): Promise<ReserveResult> {
  const now = p.now ?? new Date();
  try {
    const ins = await db
      .from('ziko_ai_cost_log')
      .insert({ user_id: p.userId, model: p.model, input_tokens: 0, output_tokens: 0, source: p.source, created_at: now.toISOString() })
      .select('id')
      .single();
    const id: string | undefined = ins?.data?.id;
    if (ins?.error || !id) {
      console.error(`[CostReservation:${p.source}] reserve failed:`, ins?.error?.message ?? 'no id');
      return { ok: false, reason: 'error' };
    }
    const { data, error } = await db
      .from('ziko_ai_cost_log')
      .select('id, created_at')
      .eq('user_id', p.userId)
      .eq('source', p.source)
      .gte('created_at', utcDayStart(now));
    if (error) {
      await release(db, id);
      return { ok: false, reason: 'error' };
    }
    const rows = ((data ?? []) as Array<{ id?: string; created_at?: string }>).slice().sort((a, b) => {
      const ca = String(a.created_at ?? '');
      const cb = String(b.created_at ?? '');
      if (ca !== cb) return ca < cb ? -1 : 1;
      const ia = String(a.id ?? '');
      const ib = String(b.id ?? '');
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
    const rank = rows.findIndex((r) => r.id === id);
    if (rank < 0 || rank >= p.dailyCap) {
      await release(db, id);
      return { ok: false, reason: 'daily_cap' };
    }
    return { ok: true, id };
  } catch (err) {
    console.error(`[CostReservation:${p.source}] reserve threw:`, err instanceof Error ? err.message : err);
    return { ok: false, reason: 'error' };
  }
}

async function release(db: ReserveDb, id: string): Promise<void> {
  try {
    await db.from('ziko_ai_cost_log').delete().eq('id', id);
  } catch {
    /* au mieux : une reservation refusee qui reste n'altere pas le classement (elle est apres les `cap` premieres) */
  }
}

/** Ecrit les jetons reels sur la ligne reservee. Ne leve jamais ; sans effet si la mise a jour echoue (la ligne compte deja). */
export async function settleCostSlot(db: ReserveDb, id: string, usage: CostUsage | undefined | null): Promise<void> {
  try {
    const res = await db
      .from('ziko_ai_cost_log')
      .update({ input_tokens: usage?.inputTokens ?? 0, output_tokens: usage?.outputTokens ?? 0 })
      .eq('id', id);
    if (res?.error) console.error('[CostReservation] settle failed:', res.error.message);
  } catch (err) {
    console.error('[CostReservation] settle threw:', err instanceof Error ? err.message : err);
  }
}
