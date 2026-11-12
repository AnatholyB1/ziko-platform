// v1.20 Phase 14 (QUEST-03) - outils de l'agent pour les quetes. Logique dans ../quests/service.ts.
// Pas de calcul de credit ici : l'appel vient du chat (creditCheck/creditDeduct('chat') de la route).
// Aucun outil de suppression / refus : l'utilisateur ne peut pas refuser une quete (QUEST-06).
import { createQuestFromChat, listQuestsForChat } from '../quests/service.js';

export async function quests_get(_params: Record<string, unknown>, userId: string): Promise<unknown> {
  return listQuestsForChat(userId);
}

export async function quests_create(params: Record<string, unknown>, userId: string): Promise<unknown> {
  return createQuestFromChat(userId, params);
}
