// Phase 23 (v1.20) - ATEL-10 : journal des tokens d'un tour d'atelier (ziko_ai_cost_log, source par defaut
// 'user_chat' : depense initiee par l'utilisateur et debitee via creditDeduct). Fire-and-forget.
export function logTokenUsageRow(
  db: { from(t: string): any },
  userId: string,
  model: string,
  usage: { inputTokens?: number | undefined; outputTokens?: number | undefined } | undefined,
): void {
  try {
    Promise.resolve(
      db.from('ziko_ai_cost_log').insert({
        user_id: userId,
        model,
        input_tokens: usage?.inputTokens ?? 0,
        output_tokens: usage?.outputTokens ?? 0,
      }),
    ).catch((err: unknown) => console.error('[workshop token log] insert failed:', err));
  } catch (err) {
    console.error('[workshop token log] insert failed:', err);
  }
}
