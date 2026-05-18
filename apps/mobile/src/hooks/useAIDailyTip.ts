import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { appStorage } from '../lib/storage';
import { supabase } from '../lib/supabase';

export interface DailyTip {
  tag: string;
  text: string;
  conversationId?: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'dismissed' | 'error';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const CACHE_KEY = `ai_tip_${TODAY}`;
const DISMISSED_KEY = `ai_tip_dismissed_${TODAY}`;
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// Compact context string ~60 tokens
function buildPrompt(ctx: {
  sleepPct: number; waterPct: number; nutritionPct: number;
  weeklyCount: number; weeklyGoal: number;
}) {
  return (
    `Données: sommeil ${ctx.sleepPct}%, eau ${ctx.waterPct}%, nutrition ${ctx.nutritionPct}%, ` +
    `séances semaine ${ctx.weeklyCount}/${ctx.weeklyGoal}. ` +
    `Réponds UNIQUEMENT avec du JSON valide sans markdown: {"tag":"string","text":"string"} ` +
    `(tag = domaine en 1 mot, text = 1 conseil motivant max 25 mots)`
  );
}

export function useAIDailyTip(ctx: {
  sleepPct: number; waterPct: number; nutritionPct: number;
  weeklyCount: number; weeklyGoal: number;
}) {
  const [tip, setTip] = useState<DailyTip | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    load();
  }, []);

  const load = useCallback(async () => {
    // Already dismissed today?
    const dismissed = await appStorage.getBoolean(DISMISSED_KEY);
    if (dismissed) { setStatus('dismissed'); return; }

    // Cached tip?
    const cached = await appStorage.getString(CACHE_KEY);
    if (cached) {
      try { setTip(JSON.parse(cached)); setStatus('ready'); return; } catch {}
    }

    // Fetch fresh tip
    setStatus('loading');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: buildPrompt(ctx) }],
        }),
      });

      if (!res.ok) throw new Error(`${res.status}`);

      const body = await res.json();
      // Response may be { content, conversation_id } or { message }
      const raw: string = body.content ?? body.message ?? '';
      const conversationId: string | undefined = body.conversation_id;

      // Parse JSON from model response (strip possible markdown fences)
      const jsonStr = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr) as { tag: string; text: string };
      const result: DailyTip = { ...parsed, conversationId };

      await appStorage.set(CACHE_KEY, JSON.stringify(result));
      setTip(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [ctx.sleepPct, ctx.waterPct, ctx.nutritionPct, ctx.weeklyCount]);

  const dismiss = useCallback(async () => {
    await appStorage.set(DISMISSED_KEY, 'true');
    setStatus('dismissed');
  }, []);

  return { tip, status, dismiss, retry: load };
}
