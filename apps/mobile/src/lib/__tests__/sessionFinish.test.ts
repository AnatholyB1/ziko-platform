/**
 * Revue A #7 : l'echec d'ecriture des totaux de seance n'est plus avale.
 * `.update()` de supabase-js ne leve pas : writeSessionTotals doit transformer `error` en exception.
 */
import { describe, it, expect, vi } from 'vitest';
import { writeSessionTotals, saveWithRetry } from '../sessionFinish';

function client(result: { error: { message: string } | null }) {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn(() => ({ eq }));
  return { c: { from: vi.fn(() => ({ update })) }, update, eq };
}

describe('writeSessionTotals', () => {
  it('ecrit les totaux sur la bonne seance', async () => {
    const { c, update, eq } = client({ error: null });
    await writeSessionTotals(c, 's1', { total_sets: 4 });
    expect(c.from).toHaveBeenCalledWith('ziko_workout_sessions');
    expect(update).toHaveBeenCalledWith({ total_sets: 4 });
    expect(eq).toHaveBeenCalledWith('id', 's1');
  });
  it('leve si la base renvoie une erreur (RLS, reseau...)', async () => {
    const { c } = client({ error: { message: 'network down' } });
    await expect(writeSessionTotals(c, 's1', {})).rejects.toThrow(/network down/);
  });
});

describe('saveWithRetry', () => {
  const noWait = async () => undefined;
  it('true des le premier succes, sans retry', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    expect(await saveWithRetry(save, 2, noWait)).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('reussit au second essai apres un echec transitoire', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    expect(await saveWithRetry(save, 2, noWait)).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });
  it('false (jamais d\'exception) quand tous les essais echouent : l\'ecran doit alors rester ouvert', async () => {
    const save = vi.fn().mockRejectedValue(new Error('x'));
    expect(await saveWithRetry(save, 3, noWait)).toBe(false);
    expect(save).toHaveBeenCalledTimes(3);
  });
});
