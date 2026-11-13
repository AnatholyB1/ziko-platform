// Phase 23 (v1.20) - ATEL-02 / D-05 : recherche web de l'atelier.
// Sous-appel Anthropic avec l'outil natif web_search (meme cle, aucun nouveau secret). Appel ABSORBE :
// pas de credit supplementaire, journalise dans ziko_ai_cost_log (source 'workshop_web_search') et
// plafonne par jour et par message. Le modele de generation est injectable (tests / faux Anthropic).
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { AGENT_MODEL } from '../config/models.js';
import { reserveCostSlot, settleCostSlot } from '../lib/costReservation.js';
import { WORKSHOP_WEB_SEARCH_DAILY_CAP, WORKSHOP_WEB_SEARCH_SOURCE } from './limits.js';

export interface WebSearchResult {
  ok: boolean;
  summary: string;
  sources: Array<{ title: string; url: string }>;
  reason?: 'daily_cap' | 'error';
}

export type SearchRunner = (query: string) => Promise<{ text: string; sources: Array<{ title?: string; url: string }>; usage?: { inputTokens?: number; outputTokens?: number } }>;

/** Runner reel : generateText + outil natif Anthropic web_search (max 2 recherches par sous-appel). */
export const defaultSearchRunner: SearchRunner = async (query) => {
  const res: any = await generateText({
    model: AGENT_MODEL,
    tools: { web_search: (anthropic.tools as any).webSearch_20250305({ maxUses: 2 }) },
    prompt: `Search the web and answer concisely (max 220 words, facts only, with the source names) for a strength-training programming question: ${query.slice(0, 300)}`,
    maxOutputTokens: 700,
  });
  const sources = Array.isArray(res.sources)
    ? res.sources.filter((s: any) => s?.url).map((s: any) => ({ title: s.title, url: s.url }))
    : [];
  return { text: String(res.text ?? ''), sources, usage: res.totalUsage ?? res.usage };
};

export async function countWebSearchesToday(db: any, userId: string, now = new Date()): Promise<number> {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count } = await db
    .from('ziko_ai_cost_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', WORKSHOP_WEB_SEARCH_SOURCE)
    .gte('created_at', day);
  return typeof count === 'number' ? count : 0;
}

export async function runWebSearch(
  db: any,
  userId: string,
  query: string,
  runner: SearchRunner = defaultSearchRunner,
  now = new Date(),
): Promise<WebSearchResult> {
  if (!query || query.trim().length < 3) return { ok: false, summary: 'query too short', sources: [], reason: 'error' };
  // Revue B (M5) : slot reserve AVANT l'appel (insert atomique + rang du jour) ; un echec du runner le consomme aussi
  // (l'API de recherche a pu etre facturee), et des tours paralleles ne depassent pas le plafond.
  const slot = await reserveCostSlot(db, {
    userId,
    source: WORKSHOP_WEB_SEARCH_SOURCE,
    model: AGENT_MODEL.modelId,
    dailyCap: WORKSHOP_WEB_SEARCH_DAILY_CAP,
    now,
  });
  if (!slot.ok) {
    return {
      ok: false,
      summary:
        slot.reason === 'daily_cap'
          ? 'Daily web search limit reached. Continue without the web and say so to the user.'
          : 'Web search unavailable. Continue without the web and say so to the user.',
      sources: [],
      reason: slot.reason === 'daily_cap' ? 'daily_cap' : 'error',
    };
  }
  try {
    const out = await runner(query.trim());
    await settleCostSlot(db, slot.id, out.usage);
    return {
      ok: true,
      summary: out.text.slice(0, 2500),
      sources: out.sources.slice(0, 5).map((s) => ({ title: s.title ?? s.url, url: s.url })),
    };
  } catch (err) {
    console.error('[workshop web search] failed:', err instanceof Error ? err.message : err);
    return { ok: false, summary: 'Web search failed. Continue without the web and say so to the user.', sources: [], reason: 'error' };
  }
}
