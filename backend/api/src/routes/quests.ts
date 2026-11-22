// v1.20 Phase 14 (QUEST-04) - POST /quests/refresh : generation AUTOMATIQUE de quetes IA.
// Appelee par l'app (ouverture de l'onglet Quetes / apres un gain de niveau). Le declenchement est decide
// cote serveur : sans raison de generer, la reponse est `skipped` et aucun appel IA n'a lieu.
// Pas de creditCheck : cout absorbe par la plateforme, plafonne par jour (ziko_quest_ai_claim) et journalise
// dans ziko_ai_cost_log (source quest_generation).
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { userRateLimit } from '../middleware/userRateLimit.js';
import { refreshQuestsAuto } from '../quests/service.js';

export const questsRouter = new Hono();
questsRouter.use('*', authMiddleware);

// Anti-spam (audit securite v1.20) : 6 appels / minute / utilisateur ; les plafonds en base restent la vraie borne de cout.
questsRouter.post('/refresh', userRateLimit(6, '1 m', 'quests-refresh'), async (c) => {
  const { userId } = c.get('auth');
  const out = await refreshQuestsAuto(userId);
  if (out.status === 'error') return c.json(out, 502);
  return c.json(out);
});
