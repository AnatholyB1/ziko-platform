# Corrections Audit Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 19 findings de l'audit de code de `apps/mobile/` + `plugins/*` (2026-08-22), plus 1 bug additionnel découvert pendant la préparation de ce plan (perte de pièces dans `sendCoinGift`), classés par sévérité.

**Architecture:** La majorité des correctifs sont locaux et indépendants (un store, un écran, un manifest à la fois) — chaque tâche peut être exécutée et commit séparément. Trois tâches touchent la base de données via de nouvelles migrations Supabase (`SECURITY DEFINER` RPC, pattern déjà utilisé dans `20260519093000_earn_rpc.sql`) pour déplacer une logique économique actuellement côté client (et donc falsifiable) vers le serveur.

**Tech Stack:** Expo SDK 54 / React Native 0.81, Zustand v5, TanStack Query v5, Supabase (Postgres + RLS), Hono (backend), TypeScript.

---

## File Map

```
supabase/migrations/
  20260822120000_gamification_economy_rpc.sql   ← CRÉER (Tâche 2)
  20260822130000_community_gifts_rpc.sql        ← CRÉER (Tâche 3)
  20260822140000_session_sets_unique.sql        ← CRÉER (Tâche 10)

apps/mobile/src/
  lib/
    ai.ts                      ← MODIFIER (Tâches 1, 7)
    queryClient.ts              ← CRÉER (Tâche 4)
    storage.ts                  ← MODIFIER (Tâche 13)
    localDate.ts                ← CRÉER (Tâche 6)
    notificationRoutes.ts       ← CRÉER (Tâche 18)
  stores/
    aiStore.ts                  ← MODIFIER (Tâches 1, 19)
    authStore.ts                ← MODIFIER (Tâches 4, 12)
    workoutStore.ts              ← MODIFIER (Tâches 10, 17)
  hooks/
    useHomeData.ts               ← MODIFIER (Tâche 6)
  lib/PluginLoader.tsx           ← MODIFIER (Tâches 5, 15)
  components/ (aucun)

apps/mobile/app/
  _layout.tsx                   ← MODIFIER (Tâche 4)
  (app)/_layout.tsx              ← MODIFIER (Tâche 18)
  (app)/ai/chat.tsx               ← MODIFIER (Tâche 4)

packages/ai-client/src/AIBridge.ts ← MODIFIER (Tâches 1, 7, 19)

plugins/gamification/src/store.ts   ← MODIFIER (Tâche 2)
plugins/community/src/store.ts      ← MODIFIER (Tâche 3)
plugins/nutrition/src/manifest.ts   ← MODIFIER (Tâche 9)
plugins/timer/src/screens/TimerPlugin.tsx           ← MODIFIER (Tâche 4bis, scoping)
plugins/measurements/src/screens/MeasurementsPlugin.tsx ← MODIFIER (Tâche 4bis)
plugins/cardio/src/screens/CardioTracker.tsx        ← MODIFIER (Tâche 11)
plugins/community/src/screens/ConversationScreen.tsx ← MODIFIER (Tâche 16)
plugins/community/src/screens/GroupsScreen.tsx       ← MODIFIER (Tâche 16)

10 fichiers Alert.alert → showAlert (Tâche 8, liste complète dans la tâche)
```

---

## ⚠️ Correction par rapport au rapport d'audit initial

En préparant ce plan, deux points du rapport se sont révélés **inexacts** — je les corrige ici pour ne pas propager une fausse piste :

1. **Finding #3 (`sendXpGift`)** : contrairement à ce qui était affirmé, un gift d'XP **ne touche jamais** `user_gamification.xp` — j'ai vérifié qu'aucun trigger/RPC ne relie `xp_gifts` au système de niveaux. Ce n'est donc **pas** un vecteur pour miner des pièces gratuites via un level-up. C'est en revanche un compteur social non plafonné et cassé côté destinataire (RLS bloque silencieusement `incrementStat` sur la ligne d'un autre utilisateur) — corrigé dans la Tâche 3.
2. **Bug non détecté par l'audit, trouvé en préparant la Tâche 3** : `sendCoinGift` (`plugins/community/src/store.ts:697`) appelle `supabase.rpc('increment_coins', ...)` — **cette fonction n'existe dans aucune migration**. L'appel échoue systématiquement, tombe dans le `.catch()` de fallback, qui fait un `UPDATE` direct sur la ligne du **destinataire** — bloqué par la policy RLS `user_gamification_own` (`auth.uid() = user_id`) puisque l'appelant est l'expéditeur. Résultat : **les pièces sont déduites de l'expéditeur et ne sont jamais créditées au destinataire** — elles disparaissent purement et simplement à chaque don de pièces. C'est le bug le plus grave découvert dans ce plan ; il est corrigé dans la Tâche 3.

---

## Tâche 1 — Arrêter la double persistance des messages IA (Finding #1, CRITIQUE)

**Files:**
- Modify: `apps/mobile/src/stores/aiStore.ts:117-121, 162-170`
- Modify: `packages/ai-client/src/AIBridge.ts:123-150`

Le backend (`backend/api/src/routes/ai.ts:279-284`) est déjà l'unique responsable de la persistance en base (`appendMessages`) et du titre de conversation. Le client doit arrêter d'insérer lui-même dans `ai_messages`, et arrêter d'envoyer son historique local dans la requête (le backend préfixe déjà `convo.history`).

- [ ] **Étape 1 : Supprimer les deux inserts client dans `ai_messages`**

Dans `apps/mobile/src/stores/aiStore.ts`, supprimer le bloc lignes 116-121 :

```ts
    // Save user message to DB
    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content,
    });

```

Et remplacer le bloc lignes 156-184 :

```ts
    // Save assistant message to DB
    if (!fullResponse) {
      set({ isStreaming: false, streamingContent: '' });
      return;
    }

    const { data: savedMsg } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: fullResponse,
      })
      .select()
      .single();

    const assistantMsg: AIMessage = savedMsg as AIMessage ?? {
      id: `assistant-${Date.now()}`,
      conversation_id: conversationId,
      role: 'assistant',
      content: fullResponse,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, assistantMsg],
      isStreaming: false,
      streamingContent: '',
    }));
```

par (le message assistant n'est plus lu depuis un insert — juste construit localement pour l'affichage optimiste, le backend fait foi en base) :

```ts
    // Assistant message: optimistic local append only (backend persists to ai_messages)
    if (!fullResponse) {
      set({ isStreaming: false, streamingContent: '' });
      return;
    }

    const assistantMsg: AIMessage = {
      id: `assistant-${Date.now()}`,
      conversation_id: conversationId,
      role: 'assistant',
      content: fullResponse,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, assistantMsg],
      isStreaming: false,
      streamingContent: '',
    }));
```

- [ ] **Étape 2 : Ne plus envoyer l'historique local dans la requête IA**

Dans `packages/ai-client/src/AIBridge.ts`, la méthode `sendMessage` construit actuellement `messages` à partir de `history` (jusqu'à 20 messages) + le nouveau message. Le backend préfixe déjà tout l'historique DB (`convo.history`) — envoyer l'historique local le duplique. Remplacer la signature et le corps :

```ts
  async sendMessage(
    conversationId: string,
    message: string,
    userContext: AIRequestPayload['user_context'],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    onActions?: (actions: AIAction[]) => void,
    authToken?: string,
  ): Promise<void> {
    if (!authToken) {
      return Promise.reject(new Error('AIBridge.sendMessage: authToken is required'));
    }

    const systemPrompt = this.buildSystemPrompt(
      userContext.profile,
      Array.from(this.activePluginManifests.values()),
    );

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: message },
    ];

    const payload: AIRequestPayload = {
      system: systemPrompt,
      messages,
      user_context: userContext,
    };

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.agentUrl}/chat/stream`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
```

(le reste du corps de la méthode, de `xhr.setRequestHeader('X-Conversation-Id', ...)` jusqu'à la fin, ne change pas — seule la section ci-dessus change : suppression du paramètre `history`, construction de `messages` réduite au seul nouveau message, `authToken` obligatoire avec rejet explicite au lieu du fallback `this.apiKey`.)

- [ ] **Étape 3 : Mettre à jour l'appel dans `aiStore.ts`**

Dans `apps/mobile/src/stores/aiStore.ts`, le `sendMessage` du store appelle actuellement `aiBridge.sendMessage(conversationId, content, messages, {...}, onChunk, undefined, onActions, authToken)`. Retirer l'argument `messages` (3ème position) devenu obsolète :

```ts
    try {
      await aiBridge.sendMessage(
        conversationId,
        content,
        {
          profile,
          today_workout: null,
          active_plugins: Object.keys(activePluginContext),
          plugin_contexts: activePluginContext,
        },
        (chunk) => {
          fullResponse += chunk;
          set({ streamingContent: fullResponse });
        },
        undefined,
        (actions) => {
          set({ pendingActions: actions });
        },
        authToken,
      );
    } catch (err) {
      set({ isStreaming: false, streamingContent: '' });
      throw err;
    }
```

Noter que la déstructuration `const { currentConversationId, messages, activePluginContext } = get();` en haut de `sendMessage` référence toujours `messages` — c'est le state local du store affiché à l'écran, à ne PAS supprimer (encore utilisé pour l'affichage optimiste ailleurs dans le composant chat). Seul le passage de cette variable à `aiBridge.sendMessage` est retiré.

- [ ] **Étape 4 : Vérifier manuellement**

Lancer l'app mobile (`npm run mobile`), ouvrir le chat IA, envoyer 2 messages dans la même conversation. Vérifier en base (`select count(*) from ai_messages where conversation_id = '<id>'`) qu'il y a exactement 2 lignes après le tour 1 (pas 4), et que le titre de la conversation se génère bien au premier message (`ai_conversations.title` non nul).

- [ ] **Étape 5 : Commit**

```bash
git add apps/mobile/src/stores/aiStore.ts packages/ai-client/src/AIBridge.ts
git commit -m "fix(ai): stop double-persisting chat messages and duplicating history in requests"
```

---

## Tâche 2 — Déplacer l'économie XP/pièces vers des RPC serveur (Finding #2, ÉLEVÉ)

**Files:**
- Create: `supabase/migrations/20260822120000_gamification_economy_rpc.sql`
- Modify: `plugins/gamification/src/store.ts`

Actuellement `addXP`/`addCoins`/`purchaseItem` font un read-modify-write client-side sur des tables où la policy RLS `user_gamification_own` (`USING/WITH CHECK auth.uid() = user_id`, sans clause `FOR`, donc valable pour INSERT/UPDATE/DELETE) autorise n'importe quel utilisateur à modifier sa propre ligne — y compris `coins`/`xp`/`level` directement. Un client peut donc se fixer un solde arbitraire. Même sans triche, deux écritures concurrentes s'écrasent (streak + habitude complétés dans la même seconde).

- [ ] **Étape 1 : Créer la migration avec les RPC `SECURITY DEFINER`**

```sql
-- supabase/migrations/20260822120000_gamification_economy_rpc.sql
--
-- Problem: addXP/addCoins/purchaseItem in plugins/gamification/src/store.ts do a
-- client-side read-modify-write against user_gamification, which the blanket
-- "user_gamification_own" RLS policy lets any authenticated user UPDATE freely
-- (including coins/xp/level, not just cosmetic fields). This lets a client set
-- an arbitrary balance, and creates a lost-update race between concurrent awards.
--
-- Fix: move the economy to SECURITY DEFINER RPCs (same pattern as earn_ai_credits
-- in 20260519093000_earn_rpc.sql), then lock down direct client writes to
-- coins/xp/level via column-level GRANT/REVOKE (RLS is row-level only).

CREATE OR REPLACE FUNCTION public.ensure_gamification_profile(p_user_id UUID)
RETURNS public.user_gamification
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_gamification;
BEGIN
  SELECT * INTO v_profile FROM public.user_gamification WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN v_profile;
  END IF;

  INSERT INTO public.user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.user_gamification WHERE user_id = p_user_id;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_coins(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_source      TEXT,
  p_source_id   UUID,
  p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_gamification_profile(p_user_id);

  INSERT INTO public.coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  -- Atomic increment — no read-then-write race
  UPDATE public.user_gamification
  SET coins = coins + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_source      TEXT,
  p_source_id   UUID,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile      public.user_gamification;
  v_new_xp       INTEGER;
  v_new_level    INTEGER;
  v_leveled_up   BOOLEAN;
  v_level_title  TEXT;
  v_reward_coins INTEGER;
BEGIN
  v_profile := public.ensure_gamification_profile(p_user_id);

  INSERT INTO public.xp_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  v_new_xp := v_profile.xp + p_amount;

  SELECT level INTO v_new_level
  FROM public.level_definitions
  WHERE xp_required <= v_new_xp
  ORDER BY level DESC
  LIMIT 1;

  v_new_level := COALESCE(v_new_level, v_profile.level);
  v_leveled_up := v_new_level > v_profile.level;

  UPDATE public.user_gamification
  SET xp = v_new_xp, level = v_new_level, updated_at = NOW()
  WHERE user_id = p_user_id;

  IF v_leveled_up THEN
    SELECT reward_coins, title INTO v_reward_coins, v_level_title
    FROM public.level_definitions WHERE level = v_new_level;

    IF v_reward_coins > 0 THEN
      PERFORM public.award_coins(
        p_user_id, v_reward_coins, 'level_up', NULL,
        format('🎉 Niveau %s atteint : %s !', v_new_level, v_level_title)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('leveled_up', v_leveled_up, 'new_level', v_new_level);
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_user_id UUID, p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_gamification;
  v_item    public.shop_items;
  v_rows    INTEGER;
BEGIN
  v_profile := public.ensure_gamification_profile(p_user_id);

  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Article introuvable');
  END IF;

  IF v_profile.level < v_item.level_required THEN
    RETURN jsonb_build_object('success', false, 'error', format('Niveau %s requis', v_item.level_required));
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Déjà possédé');
  END IF;

  -- Atomic guarded deduction — fails (0 rows) if balance is insufficient,
  -- closing the race where two purchases could both pass a stale balance check.
  UPDATE public.user_gamification
  SET coins = coins - v_item.price, updated_at = NOW()
  WHERE user_id = p_user_id AND coins >= v_item.price;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pas assez de pièces');
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, -v_item.price, 'purchase', p_item_id, format('🛒 Achat : %s', v_item.name));

  INSERT INTO public.user_inventory (user_id, item_id)
  VALUES (p_user_id, p_item_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── Lock down direct client writes ──────────────────────────────────
-- RLS is row-level only; column-level restriction needs GRANT/REVOKE.
-- SECURITY DEFINER functions above bypass this (they run as the function
-- owner), so the RPCs keep working after the revoke.

REVOKE INSERT, UPDATE ON public.user_gamification FROM authenticated;
GRANT UPDATE (equipped_title, equipped_badge, equipped_banner_name, equipped_theme)
  ON public.user_gamification TO authenticated;

REVOKE INSERT ON public.xp_transactions FROM authenticated;
REVOKE INSERT ON public.coin_transactions FROM authenticated;
REVOKE INSERT ON public.user_inventory FROM authenticated;
-- user_inventory UPDATE (is_equipped toggling by equipItem) stays allowed —
-- no monetary value, RLS still scopes it to the caller's own rows.
```

- [ ] **Étape 2 : Appliquer la migration en local**

```bash
supabase db reset
```

Vérifier qu'elle s'applique sans erreur (les fonctions et les `REVOKE`/`GRANT` doivent passer).

- [ ] **Étape 3 : Remplacer la logique client dans `plugins/gamification/src/store.ts`**

Supprimer entièrement les fonctions `ensureProfile`, `addXP`, `addCoins` (lignes 135-151 et 238-320) et remplacer leurs appelants :

```ts
// ── Update streak ───────────────────────────────────────
async function updateStreak(supabase: any, userId: string, profile: GamificationProfile) {
  const today = new Date().toISOString().split('T')[0];
  if (profile.last_activity_date === today) return profile;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak = 1;
  if (profile.last_activity_date === yesterdayStr) {
    newStreak = profile.current_streak + 1;
  }

  const longestStreak = Math.max(profile.longest_streak, newStreak);

  const { data } = await supabase
    .from('user_gamification')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single();

  for (const milestone of STREAK_MILESTONES) {
    if (newStreak === milestone && profile.current_streak < milestone) {
      const xpKey = `streak_${milestone}` as keyof typeof XP_REWARDS;
      const coinKey = `streak_${milestone}` as keyof typeof COIN_REWARDS;
      const xpAmount = XP_REWARDS[xpKey] ?? 0;
      const coinAmount = COIN_REWARDS[coinKey] ?? 0;

      if (xpAmount > 0) {
        await supabase.rpc('award_xp', {
          p_user_id: userId, p_amount: xpAmount, p_source: 'streak_bonus',
          p_source_id: null, p_description: `🔥 Streak ${milestone} jours !`,
        });
      }
      if (coinAmount > 0) {
        await supabase.rpc('award_coins', {
          p_user_id: userId, p_amount: coinAmount, p_source: 'streak_bonus',
          p_source_id: null, p_description: `🔥 Bonus streak ${milestone} jours`,
        });
      }
    }
  }

  return data ?? profile;
}

// ── Ensure profile exists (server-side, bypasses the now-locked-down INSERT) ──
async function ensureProfile(supabase: any, userId: string): Promise<GamificationProfile> {
  const { data } = await supabase.rpc('ensure_gamification_profile', { p_user_id: userId });
  return data;
}
```

Remplacer `awardWorkoutXP` et `awardHabitXP` (les deux derniers appellent `addXP`/`addCoins`) :

```ts
// ── Award Workout Completion ────────────────────────────
export async function awardWorkoutXP(supabase: any, sessionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await ensureProfile(supabase, user.id);
  await updateStreak(supabase, user.id, profile);

  await supabase.rpc('award_xp', {
    p_user_id: user.id, p_amount: XP_REWARDS.workout, p_source: 'workout',
    p_source_id: sessionId, p_description: `💪 Séance terminée : +${XP_REWARDS.workout} XP`,
  });
  await supabase.rpc('award_coins', {
    p_user_id: user.id, p_amount: COIN_REWARDS.workout, p_source: 'workout',
    p_source_id: sessionId, p_description: `💰 Séance terminée : +${COIN_REWARDS.workout} pièces`,
  });
}

// ── Award Habit Completion ──────────────────────────────
export async function awardHabitXP(supabase: any, habitName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await ensureProfile(supabase, user.id);
  await updateStreak(supabase, user.id, profile);

  await supabase.rpc('award_xp', {
    p_user_id: user.id, p_amount: XP_REWARDS.habit, p_source: 'habit',
    p_source_id: null, p_description: `✅ ${habitName} : +${XP_REWARDS.habit} XP`,
  });
  await supabase.rpc('award_coins', {
    p_user_id: user.id, p_amount: COIN_REWARDS.habit, p_source: 'habit',
    p_source_id: null, p_description: `💰 ${habitName} : +${COIN_REWARDS.habit} pièces`,
  });
}
```

Remplacer `purchaseItem` (lignes 361-399) :

```ts
// ── Purchase Item ───────────────────────────────────────
export async function purchaseItem(supabase: any, itemId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non connecté' };

  const { data, error } = await supabase.rpc('purchase_shop_item', {
    p_user_id: user.id,
    p_item_id: itemId,
  });

  if (error) return { success: false, error: error.message };
  return data as { success: boolean; error?: string };
}
```

`equipItem` (lignes 402-494) n'a pas besoin de changer — il ne touche que des colonnes cosmétiques (`equipped_title`, `equipped_badge`, `equipped_banner_name`, `equipped_theme`), que le `GRANT UPDATE (...)` ci-dessus autorise toujours explicitement.

- [ ] **Étape 4 : Vérifier manuellement**

Dans l'app, compléter une habitude et terminer une séance dans la foulée. Vérifier que `xp`/`coins`/`level` montent correctement dans `user_gamification` (via Supabase Studio), et qu'un achat dans la boutique avec un solde insuffisant renvoie bien `{success:false, error:'Pas assez de pièces'}` sans modifier `coins`.

Vérifier aussi que le lockdown fonctionne : depuis le SQL editor Supabase, tenter `UPDATE user_gamification SET coins = 999999 WHERE user_id = '<un uid authentifié>'` avec le rôle `authenticated` (ou via un test RLS) doit échouer.

- [ ] **Étape 5 : Commit**

```bash
git add supabase/migrations/20260822120000_gamification_economy_rpc.sql plugins/gamification/src/store.ts
git commit -m "fix(gamification): move XP/coins economy to SECURITY DEFINER RPCs, lock down direct writes"
```

---

## Tâche 3 — Corriger les dons XP/pièces (Finding #3 + bug de perte de pièces découvert) (ÉLEVÉ)

**Files:**
- Create: `supabase/migrations/20260822130000_community_gifts_rpc.sql`
- Modify: `plugins/community/src/store.ts:661-780`

`sendCoinGift` référence une fonction `increment_coins` qui n'existe dans aucune migration — l'appel échoue, tombe dans le fallback, qui est bloqué par RLS pour la ligne du destinataire. Les pièces sont déduites de l'expéditeur et jamais créditées : **elles disparaissent**. `sendXpGift` n'a aucun plafond. Et `incrementStat()` fait un `UPDATE` sur la ligne du destinataire (`xp_received`, `coins_received`, `encouragements_received`) — bloqué par la policy `community_stats_update` (`USING auth.uid() = user_id`), donc silencieusement sans effet.

- [ ] **Étape 1 : Créer la migration**

```sql
-- supabase/migrations/20260822130000_community_gifts_rpc.sql
--
-- Problem 1: sendCoinGift calls supabase.rpc('increment_coins', ...) — this
-- function does not exist in any migration. The call fails, falls through to
-- a manual-update fallback that targets the RECEIVER's row, which the
-- "user_gamification_own" RLS policy blocks (caller is the sender, not the
-- receiver). Net effect: coins are deducted from the sender and never
-- credited to the receiver — they vanish on every coin gift.
--
-- Problem 2: sendXpGift has no upper bound on `amount`.
--
-- Problem 3: incrementStat() does a plain client UPDATE, which silently
-- no-ops when the target row belongs to someone else (xp_received,
-- coins_received, encouragements_received) — the "community_stats_update"
-- policy only allows updating your OWN row.
--
-- Fix: SECURITY DEFINER RPCs for both gifts (atomic sender debit + receiver
-- credit + stats, all server-validated) and a generic stat-increment RPC
-- that fixes the receiver-side no-op for every caller of incrementStat().

CREATE OR REPLACE FUNCTION public.increment_community_stat(
  p_user_id UUID,
  p_field   TEXT,
  p_amount  INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN (
    'messages_sent', 'gifs_sent', 'reactions_sent',
    'challenges_won', 'challenges_lost', 'challenges_tied',
    'xp_gifted', 'xp_received', 'coins_gifted', 'coins_received',
    'programs_shared', 'group_workouts_done',
    'encouragements_sent', 'encouragements_received',
    'invites_sent', 'invites_accepted'
  ) THEN
    RAISE EXCEPTION 'increment_community_stat: invalid field %', p_field;
  END IF;

  INSERT INTO public.community_user_stats (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  EXECUTE format(
    'UPDATE public.community_user_stats SET %I = %I + $1, updated_at = NOW() WHERE user_id = $2',
    p_field, p_field
  ) USING p_amount, p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_xp_gift(
  p_sender_id   UUID,
  p_receiver_id UUID,
  p_amount      INTEGER,
  p_message     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 OR p_amount > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide (1-5000)');
  END IF;
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de s''auto-offrir de l''XP');
  END IF;

  INSERT INTO public.xp_gifts (sender_id, receiver_id, amount, message)
  VALUES (p_sender_id, p_receiver_id, p_amount, p_message);

  PERFORM public.increment_community_stat(p_sender_id, 'xp_gifted', p_amount);
  PERFORM public.increment_community_stat(p_receiver_id, 'xp_received', p_amount);

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_coin_gift(
  p_sender_id   UUID,
  p_receiver_id UUID,
  p_amount      INTEGER,
  p_message     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_amount <= 0 OR p_amount > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide (1-1000)');
  END IF;
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de s''auto-offrir des pièces');
  END IF;

  PERFORM public.ensure_gamification_profile(p_sender_id);
  PERFORM public.ensure_gamification_profile(p_receiver_id);

  -- Atomic guarded debit — fails (0 rows) if balance is insufficient
  UPDATE public.user_gamification
  SET coins = coins - p_amount, updated_at = NOW()
  WHERE user_id = p_sender_id AND coins >= p_amount;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pas assez de pièces');
  END IF;

  UPDATE public.user_gamification
  SET coins = coins + p_amount, updated_at = NOW()
  WHERE user_id = p_receiver_id;

  INSERT INTO public.coin_gifts (sender_id, receiver_id, amount, message)
  VALUES (p_sender_id, p_receiver_id, p_amount, p_message);

  PERFORM public.increment_community_stat(p_sender_id, 'coins_gifted', p_amount);
  PERFORM public.increment_community_stat(p_receiver_id, 'coins_received', p_amount);

  RETURN jsonb_build_object('success', true);
END;
$$;
```

- [ ] **Étape 2 : Appliquer la migration en local**

```bash
supabase db reset
```

- [ ] **Étape 3 : Remplacer `incrementStat`, `sendXpGift`, `sendCoinGift` dans `plugins/community/src/store.ts`**

Remplacer `incrementStat` (lignes 762-780) :

```ts
// ── Stats helper ────────────────────────────────────────
async function incrementStat(supabase: any, userId: string, field: string, amount = 1) {
  await supabase.rpc('increment_community_stat', {
    p_user_id: userId,
    p_field: field,
    p_amount: amount,
  });
}
```

Remplacer `sendXpGift` (lignes 661-674) :

```ts
export async function sendXpGift(supabase: any, receiverId: string, amount: number, message?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase.rpc('send_xp_gift', {
    p_sender_id: user.id,
    p_receiver_id: receiverId,
    p_amount: amount,
    p_message: message ?? null,
  });

  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error);
}
```

Remplacer `sendCoinGift` (lignes 676-718) :

```ts
export async function sendCoinGift(supabase: any, receiverId: string, amount: number, message?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase.rpc('send_coin_gift', {
    p_sender_id: user.id,
    p_receiver_id: receiverId,
    p_amount: amount,
    p_message: message ?? null,
  });

  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error);
}
```

- [ ] **Étape 4 : Vérifier manuellement**

Avec deux comptes de test amis l'un de l'autre, envoyer un don de pièces depuis `InviteScreen`. Vérifier dans Supabase Studio que le solde du destinataire augmente réellement (`user_gamification.coins`) et que `community_user_stats.coins_received` du destinataire est incrémenté — ce qui échouait silencieusement avant ce correctif. Tenter un don supérieur au solde de l'expéditeur : doit afficher "Pas assez de pièces" sans toucher aux soldes.

- [ ] **Étape 5 : Commit**

```bash
git add supabase/migrations/20260822130000_community_gifts_rpc.sql plugins/community/src/store.ts
git commit -m "fix(community): fix coin gifts silently vanishing (increment_coins RPC never existed), add gift caps"
```

---

## Tâche 4 — Vider le cache TanStack Query au logout + scoper les clés sensibles (Finding #4, ÉLEVÉ)

**Files:**
- Create: `apps/mobile/src/lib/queryClient.ts`
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/src/stores/authStore.ts`
- Modify: `apps/mobile/app/(app)/ai/chat.tsx`

`signOut()` ne vide jamais le `QueryClient` — changer de compte sur le même appareil laisse les données en cache de l'ancien compte visibles jusqu'à expiration.

- [ ] **Étape 1 : Extraire le `QueryClient` dans un module partagé**

```ts
// apps/mobile/src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});
```

- [ ] **Étape 2 : Faire pointer `app/_layout.tsx` vers ce module**

Dans `apps/mobile/app/_layout.tsx`, supprimer la déclaration locale :

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});
```

et ajouter en haut du fichier :

```ts
import { queryClient } from '../src/lib/queryClient';
```

(`QueryClientProvider` plus bas dans le fichier référence déjà la variable `queryClient` — aucun autre changement nécessaire dans ce fichier.)

- [ ] **Étape 3 : Vider le cache dans `signOut`**

Dans `apps/mobile/src/stores/authStore.ts`, ajouter l'import en haut :

```ts
import { queryClient } from '../lib/queryClient';
```

Et modifier `signOut` :

```ts
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
    queryClient.clear();
  },
```

- [ ] **Étape 4 : Scoper la clé de crédits IA par utilisateur**

Dans `apps/mobile/app/(app)/ai/chat.tsx`, ajouter l'import :

```ts
import { useAuthStore } from '../../../src/stores/authStore';
```

Et modifier le hook (le composant doit lire `userId` avant le `useQuery`) :

```ts
  const userId = useAuthStore((s) => s.user?.id);

  // ── Credits query ─────────────────────────────────────────

  const { data: creditsData, isError: creditsError } = useQuery({
    queryKey: ['userCredits', userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('user_profiles')
        .select('ai_credits_balance')
        .eq('id', user.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
```

- [ ] **Étape 5 : Vérifier manuellement**

Se connecter avec le compte A, ouvrir l'écran de crédits IA (note le solde affiché), se déconnecter, se connecter avec le compte B sur le même appareil sans tuer l'app. Le solde affiché doit être celui de B dès l'arrivée sur l'écran, jamais un résidu de A.

- [ ] **Étape 6 : Commit**

```bash
git add apps/mobile/src/lib/queryClient.ts apps/mobile/app/_layout.tsx apps/mobile/src/stores/authStore.ts apps/mobile/app/\(app\)/ai/chat.tsx
git commit -m "fix(auth): clear TanStack Query cache on signOut, scope AI credits query by userId"
```

---

## Tâche 4bis — Corriger les clés de cache littérales `'user'` (complément Finding #4, ÉLEVÉ)

**Files:**
- Modify: `plugins/timer/src/screens/TimerPlugin.tsx:56`
- Modify: `plugins/measurements/src/screens/MeasurementsPlugin.tsx:108, 132`

Ces deux écrans utilisent la chaîne littérale `'user'` comme clé de cache au lieu du vrai `userId` — le cache ne distingue jamais deux comptes différents sur le même appareil.

- [ ] **Étape 1 : `TimerPlugin.tsx`**

Le composant doit d'abord obtenir `userId` de façon synchrone. Vérifier en haut du composant s'il existe déjà un `userId` dérivé (sinon l'ajouter via `useAuthStore` comme dans les autres écrans du plugin). Puis :

```ts
  const { data: dbPresets, isLoading: presetsLoading, isError: presetsError, refetch: presetsRefetch } = useQuery({
    queryKey: ['timer_presets', userId],
    queryFn: async () => {
```

- [ ] **Étape 2 : `MeasurementsPlugin.tsx`**

```ts
  const { data: latestMeasurement, isLoading: measurementsLoading, isError: measurementsError, refetch: measurementsRefetch } = useQuery({
    queryKey: ['latest_measurement', userId],
    queryFn: async () => {
```

```ts
  const { data: measurements6weeks } = useQuery({
    queryKey: ['measurements_6weeks', userId],
    queryFn: async () => {
```

(Dans les deux fichiers, si `userId` n'existe pas encore comme variable de composant, l'obtenir avec `const userId = useAuthStore((s) => s.user?.id);` en haut du composant, import `useAuthStore` depuis `../../../apps/mobile/src/stores/authStore` — vérifier le chemin relatif réel du plugin vers l'app, ou passer par le prop `supabase`/contexte déjà utilisé ailleurs dans le même fichier pour lire l'utilisateur courant de façon synchrone si un pattern existe déjà dans ce fichier.)

- [ ] **Étape 3 : Vérifier manuellement**

Mêmes étapes que Tâche 4 — changer de compte sur le même appareil, vérifier qu'aucun preset de timer ni mesure corporelle de l'ancien compte n'apparaît avant le prochain fetch réseau.

- [ ] **Étape 4 : Commit**

```bash
git add plugins/timer/src/screens/TimerPlugin.tsx plugins/measurements/src/screens/MeasurementsPlugin.tsx
git commit -m "fix(cache): scope timer presets and measurements query keys by userId instead of literal 'user'"
```

---

## Tâche 5 — Annuler le chargement des plugins lors d'un changement de compte (Finding #5, ÉLEVÉ)

**Files:**
- Modify: `apps/mobile/src/lib/PluginLoader.tsx:89-152`

- [ ] **Étape 1 : Ajouter un flag d'annulation vérifié après chaque `await`**

Remplacer le corps du `useEffect` :

```ts
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadInstalledPlugins() {
      if (!user) return;

      for (const pluginId of MANDATORY_PLUGIN_IDS) {
        if (cancelled) return;
        if (loadedRef.current.has(pluginId)) continue;
        const loader = PLUGIN_LOADERS[pluginId];
        if (!loader) continue;
        try {
          const mod = await loader();
          if (cancelled) return;
          let manifest: PluginManifest = mod.default;
          manifest = await applyPersonaDynamicPrompt(manifest, user.id);
          if (cancelled) return;
          registerPlugin(manifest);
          aiBridge.registerPlugin(manifest);
          loadedRef.current.add(pluginId);
        } catch (err) {
          console.warn(`[PluginLoader] Failed to load mandatory plugin "${pluginId}":`, err);
        }
      }

      if (cancelled) return;
      await autoInstallCoachPlugin(user.id);
      if (cancelled) return;

      const { data: userPlugins, error } = await supabase
        .from('user_plugins')
        .select('plugin_id, is_enabled')
        .eq('user_id', user.id)
        .eq('is_enabled', true);

      if (cancelled || error || !userPlugins) return;

      for (const up of userPlugins) {
        if (cancelled) return;
        const pluginId = up.plugin_id as string;
        if (loadedRef.current.has(pluginId)) continue;

        const loader = PLUGIN_LOADERS[pluginId];
        if (!loader) continue;

        try {
          const mod = await loader();
          if (cancelled) return;
          let manifest: PluginManifest = mod.default;
          manifest = await applyPersonaDynamicPrompt(manifest, user.id);
          if (cancelled) return;
          registerPlugin(manifest);
          aiBridge.registerPlugin(manifest);
          loadedRef.current.add(pluginId);
        } catch (err) {
          console.warn(`[PluginLoader] Failed to load plugin "${pluginId}":`, err);
        }
      }
    }

    loadInstalledPlugins();

    return () => {
      cancelled = true;
      for (const pluginId of loadedRef.current) {
        unregisterPlugin(pluginId);
        aiBridge.unregisterPlugin(pluginId);
      }
      loadedRef.current.clear();
    };
  }, [user?.id]);
```

(`MANDATORY_PLUGIN_IDS` est introduit par la Tâche 15 juste en dessous — si cette tâche est exécutée avant la 15, utiliser temporairement `Object.keys(PLUGIN_LOADERS)` à la place, la Tâche 15 remplacera cette ligne.)

- [ ] **Étape 2 : Vérifier manuellement**

Sur un réseau volontairement ralenti (throttling dans les devtools ou mode avion partiel), se déconnecter pendant le chargement des plugins puis se reconnecter immédiatement avec un autre compte. Les plugins du premier compte ne doivent plus apparaître dans la tab bar du second.

- [ ] **Étape 3 : Commit**

```bash
git add apps/mobile/src/lib/PluginLoader.tsx
git commit -m "fix(plugins): cancel in-flight plugin loading on account switch"
```

---

## Tâche 6 — Date "aujourd'hui" en heure locale, pas UTC (Finding #6, ÉLEVÉ)

**Files:**
- Create: `apps/mobile/src/lib/localDate.ts`
- Modify: `apps/mobile/src/hooks/useHomeData.ts`

- [ ] **Étape 1 : Créer le helper de date locale**

```ts
// apps/mobile/src/lib/localDate.ts

/** Returns YYYY-MM-DD for the device's local date, not UTC. */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

- [ ] **Étape 2 : Remplacer les 5 occurrences dans `useHomeData.ts`**

Import en haut du fichier :

```ts
import { localDateKey } from '../lib/localDate';
```

`useSessionStreak` (ligne 70) :

```ts
      while (uniqueDays.has(localDateKey(cursor))) {
        streak++;
        cursor.setTime(cursor.getTime() - 86400000);
      }
```

`useStreak` (ligne 106) :

```ts
      while (uniqueDays.has(localDateKey(cursor))) {
        streak++;
        cursor = new Date(cursor.getTime() - 86400000);
      }
```

`useSleepToday` (ligne 125) :

```ts
      const today = localDateKey();
```

`useHydrationToday` (ligne 148) :

```ts
      const today = localDateKey();
```

`useNutritionToday` (ligne 174) :

```ts
      const today = localDateKey();
```

- [ ] **Étape 3 : Vérifier manuellement**

Sur un appareil réglé sur le fuseau Paris (UTC+1 ou +2), changer l'heure système à 00:30, loguer un verre d'eau. Le rond d'hydratation sur l'écran d'accueil doit refléter l'apport immédiatement, pas rester à 0.

- [ ] **Étape 4 : Commit**

```bash
git add apps/mobile/src/lib/localDate.ts apps/mobile/src/hooks/useHomeData.ts
git commit -m "fix(dates): compute 'today' in local time instead of UTC for streaks and daily totals"
```

**Note de portée :** Le même pattern (`new Date().toISOString().split('T')[0]`) existe dans ~70 autres emplacements à travers les 19 plugins (chaque écran de plugin calcule sa propre date "aujourd'hui" localement). Cette tâche corrige le point d'entrée le plus visible (écran d'accueil). Un balayage complet plugin par plugin est un chantier séparé, à traiter dans un plan dédié plutôt qu'ajouté ici en dépassement de portée — chaque plugin a sa propre logique de streak/agrégation quotidienne à vérifier individuellement.

---

## Tâche 7 — Supprimer le fallback de clé API IA partagée (Finding #7, MOYEN-ÉLEVÉ)

**Files:**
- Modify: `apps/mobile/src/lib/ai.ts`
- Modify: `packages/ai-client/src/AIBridge.ts`

`EXPO_PUBLIC_AI_AGENT_API_KEY` est embarquée dans le bundle JS (donc extractible) et n'est définie nulle part — `sendMessageSync` (mort, jamais appelé) l'utilise sans condition. La Tâche 1 a déjà rendu `authToken` obligatoire dans `sendMessage`. Il reste à supprimer `apiKey` du constructeur et `sendMessageSync` entièrement.

- [ ] **Étape 1 : Supprimer `sendMessageSync` et `apiKey` dans `AIBridge.ts`**

Supprimer toute la méthode `sendMessageSync` (lignes 218-261, du commentaire `// ── Non-streaming fallback ────────────────────────────` jusqu'à la fermeture de la classe).

Modifier le constructeur :

```ts
export class AIBridge {
  private agentUrl: string;
  private skillsByPlugin: Map<string, AISkill[]> = new Map();
  private activePluginManifests: Map<string, PluginManifest> = new Map();

  constructor(agentUrl: string) {
    if (!agentUrl) throw new Error('AIBridge: agentUrl is required');
    this.agentUrl = agentUrl.replace(/\/$/, '');
  }
```

- [ ] **Étape 2 : Mettre à jour l'instanciation dans `apps/mobile/src/lib/ai.ts`**

```ts
import { AIBridge } from '@ziko/ai-client';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const agentUrl = `${apiUrl}/ai`;

export const aiBridge = new AIBridge(agentUrl);
```

- [ ] **Étape 3 : Vérifier la compilation**

```bash
npx tsc --noEmit -p apps/mobile
```

Aucune erreur ne doit référencer `apiKey` ou `sendMessageSync` (déjà confirmé qu'aucun autre appelant n'existe dans le repo).

- [ ] **Étape 4 : Commit**

```bash
git add apps/mobile/src/lib/ai.ts packages/ai-client/src/AIBridge.ts
git commit -m "fix(ai): remove unused shared API key fallback and dead sendMessageSync path"
```

---

## Tâche 8 — Remplacer `Alert.alert` par `showAlert` (Finding #8, MOYEN)

**Files:** 10 fichiers listés ci-dessous.

`showAlert` de `@ziko/plugin-sdk` a exactement la même signature que `Alert.alert` (`title, message?, buttons?`) — la migration est un remplacement mécanique `Alert.alert(` → `showAlert(` par fichier, plus l'ajustement de l'import.

- [ ] **Étape 1 : `plugins/cardio/src/screens/CardioLog.tsx`**

Remplacer les lignes 2-4 :

```tsx
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
} from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Puis remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` dans le fichier (1 occurrence, ligne 72).

- [ ] **Étape 2 : `plugins/sleep/src/screens/SleepLog.tsx`**

Remplacer la ligne 2 :

```tsx
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (1 occurrence, ligne 95).

- [ ] **Étape 3 : `plugins/community/src/screens/InviteScreen.tsx`**

Remplacer les lignes 2-5 :

```tsx
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Share, RefreshControl,
} from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (7 occurrences : lignes 46, 48, 57, 61, 68, 72, 87).

- [ ] **Étape 4 : `plugins/community/src/screens/ChallengeDetailScreen.tsx`**

Remplacer les lignes 2-4 :

```tsx
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (1 occurrence, ligne 106).

- [ ] **Étape 5 : `plugins/gamification/src/screens/ShopScreen.tsx`**

Remplacer les lignes 2-4 :

```tsx
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
```

Ajouter `showAlert` à l'import `@ziko/plugin-sdk` existant (le fichier importe déjà `useGamificationStore, loadGamification, purchaseItem, equipItem, type ShopItem` depuis un module local `../store` — vérifier séparément l'import réel de `@ziko/plugin-sdk` dans ce fichier et y ajouter `showAlert`, ou créer la ligne si absente : `import { showAlert } from '@ziko/plugin-sdk';`).

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (2 occurrences : lignes 54, 67).

- [ ] **Étape 6 : `plugins/journal/src/screens/JournalEntry.tsx`**

Remplacer les lignes 2-4 :

```tsx
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
} from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (1 occurrence, ligne 61).

- [ ] **Étape 7 : `plugins/timer/src/screens/TimerEditor.tsx`**

Remplacer les lignes 2-4 :

```tsx
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
} from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (2 occurrences : lignes 75, 147).

- [ ] **Étape 8 : `plugins/timer/src/screens/TimerManager.tsx`**

Remplacer la ligne 2 :

```tsx
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (2 occurrences : lignes 50, 67).

- [ ] **Étape 9 : `plugins/community/src/screens/InviteScreen.tsx`** *(déjà fait Étape 3 — ignorer ce doublon)*

- [ ] **Étape 10 : `plugins/supplements/src/screens/SupplementDetailScreen.tsx`**

Remplacer la ligne 3 :

```tsx
  View, Text, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

(le fichier importe déjà `useThemeStore, useTranslation` depuis `@ziko/plugin-sdk` en ligne 9 — fusionner l'import plutôt que d'en ajouter un second : `import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';` et supprimer la ligne ajoutée en double.)

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (1 occurrence, ligne 144).

- [ ] **Étape 11 : `plugins/stretching/src/screens/RoutineEditor.tsx`**

Remplacer la ligne 2 :

```tsx
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
```

Remplacer toutes les occurrences de `Alert.alert(` par `showAlert(` (4 occurrences : lignes 76, 77, 79, 117).

- [ ] **Étape 12 : Vérifier qu'il n'en reste plus**

```bash
rtk grep "Alert\.alert(" plugins/
```

Doit retourner 0 résultat.

- [ ] **Étape 13 : Commit**

```bash
git add plugins/cardio/src/screens/CardioLog.tsx plugins/sleep/src/screens/SleepLog.tsx plugins/community/src/screens/InviteScreen.tsx plugins/community/src/screens/ChallengeDetailScreen.tsx plugins/gamification/src/screens/ShopScreen.tsx plugins/journal/src/screens/JournalEntry.tsx plugins/timer/src/screens/TimerEditor.tsx plugins/timer/src/screens/TimerManager.tsx plugins/supplements/src/screens/SupplementDetailScreen.tsx plugins/stretching/src/screens/RoutineEditor.tsx
git commit -m "fix(plugins): replace native Alert.alert with themed showAlert across 10 screens"
```

---

## Tâche 9 — Icône Ionicons invalide dans le manifest Nutrition (Finding #9, MOYEN)

**Files:**
- Modify: `plugins/nutrition/src/manifest.ts:101`

- [ ] **Étape 1 : Corriger l'icône**

```ts
    {
      path: '/(plugins)/nutrition/log',
      title: 'Log Meal',
      icon: 'restaurant',
      showInTabBar: false,
    },
```

- [ ] **Étape 2 : Commit**

```bash
git add plugins/nutrition/src/manifest.ts
git commit -m "fix(nutrition): fix invalid 'fork-knife' Ionicons name breaking the log-meal route icon"
```

---

## Tâche 10 — Empêcher les doublons de sets complétés (Finding #10, MOYEN)

**Files:**
- Create: `supabase/migrations/20260822140000_session_sets_unique.sql`
- Modify: `apps/mobile/src/stores/workoutStore.ts:223-249`

`completeSet` fait un `INSERT` sans vérifier si le set est déjà complété, ni contrainte d'unicité en base — un double-tap insère deux lignes pour le même `(session_id, exercise_id, set_number)`, doublant le volume dans les stats.

- [ ] **Étape 1 : Ajouter la contrainte d'unicité**

```sql
-- supabase/migrations/20260822140000_session_sets_unique.sql
--
-- completeSet() in workoutStore.ts inserts a session_sets row with no guard
-- against re-completing the same set — a double-tap creates two rows for the
-- same (session_id, exercise_id, set_number), double-counting volume in the
-- stats plugin. Add a unique constraint so the client can upsert instead.

ALTER TABLE public.session_sets
  ADD CONSTRAINT session_sets_unique_set
  UNIQUE (session_id, exercise_id, set_number);
```

- [ ] **Étape 2 : Appliquer en local**

```bash
supabase db reset
```

Si la migration échoue à cause de doublons déjà existants en local, nettoyer les doublons de test avant de relancer (`DELETE FROM session_sets a USING session_sets b WHERE a.id > b.id AND a.session_id = b.session_id AND a.exercise_id = b.exercise_id AND a.set_number = b.set_number;`).

- [ ] **Étape 3 : Passer `completeSet` en upsert**

```ts
  completeSet: async (exerciseId, setNumber) => {
    const { currentSession, activeSets } = get();
    if (!currentSession) return;

    const setData = activeSets.find(
      (s) => s.exerciseId === exerciseId && s.setNumber === setNumber,
    );
    if (!setData) return;

    await supabase.from('session_sets').upsert(
      {
        session_id: currentSession.id,
        exercise_id: exerciseId,
        set_number: setNumber,
        reps: setData.reps,
        weight_kg: setData.weight_kg,
        duration_seconds: setData.duration_seconds,
        completed: true,
      },
      { onConflict: 'session_id,exercise_id,set_number' },
    );

    set((s) => ({
      activeSets: s.activeSets.map((a) =>
        a.exerciseId === exerciseId && a.setNumber === setNumber
          ? { ...a, completed: true }
          : a,
      ),
    }));
  },
```

- [ ] **Étape 4 : Vérifier manuellement**

Démarrer une séance, compléter un set, double-tap rapidement sur le bouton de validation du même set. Vérifier dans `session_sets` (Supabase Studio) qu'une seule ligne existe pour ce `(session_id, exercise_id, set_number)`.

- [ ] **Étape 5 : Commit**

```bash
git add supabase/migrations/20260822140000_session_sets_unique.sql apps/mobile/src/stores/workoutStore.ts
git commit -m "fix(workout): prevent duplicate session_sets rows on repeated set completion"
```

---

## Tâche 11 — CardioTracker : updater impur + fuite de souscription GPS (Finding #11, MOYEN)

**Files:**
- Modify: `plugins/cardio/src/screens/CardioTracker.tsx:100-182`

`setDistanceKm` est appelé à l'intérieur de l'updater de `setRoutePoints` (effet de bord dans une fonction censée être pure — React peut la ré-invoquer plusieurs fois). Et un double-tap sur reprise peut créer deux souscriptions GPS simultanées.

- [ ] **Étape 1 : Sortir `setDistanceKm`/pace de l'updater `setRoutePoints`**

Remplacer le callback de `watchPositionAsync` (lignes 114-151) :

```ts
      (loc) => {
        const point: RoutePoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp: loc.timestamp,
          altitude: loc.coords.altitude ?? undefined,
        };

        const last = lastPointRef.current;
        let isNoise = false;

        if (last) {
          const segDist = haversine(last.lat, last.lng, point.lat, point.lng);
          const timeDiff = (point.timestamp - last.timestamp) / 1000;
          isNoise = segDist > 0.05 && timeDiff < 3;

          if (!isNoise && segDist > 0.001) {
            setDistanceKm((d) => d + segDist);

            const now = point.timestamp;
            recentDistancesRef.current = [
              ...recentDistancesRef.current.filter((r) => now - r.time < 60000),
              { dist: segDist, time: now },
            ];
            const recentDist = recentDistancesRef.current.reduce((s, r) => s + r.dist, 0);
            const recentTime = (now - (recentDistancesRef.current[0]?.time ?? now)) / 1000;
            if (recentDist > 0.05 && recentTime > 5) {
              setCurrentPaceSecPerKm(recentTime / recentDist);
            }
          }
        }

        if (!isNoise) {
          setRoutePoints((prev) => [...prev, point]);
        }

        lastPointRef.current = point;
      }
```

- [ ] **Étape 2 : Empêcher deux souscriptions GPS simultanées**

Ajouter un ref de garde juste avant `startLocationTracking` :

```ts
  const isStartingTrackingRef = useRef(false);

  const startLocationTracking = useCallback(async () => {
    if (isStartingTrackingRef.current) return false;
    isStartingTrackingRef.current = true;
    try {
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission GPS refusée. Active la localisation dans les réglages.');
        return false;
      }
      setLocationError(null);

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 3000,
        },
        (loc) => {
          const point: RoutePoint = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            timestamp: loc.timestamp,
            altitude: loc.coords.altitude ?? undefined,
          };

          const last = lastPointRef.current;
          let isNoise = false;

          if (last) {
            const segDist = haversine(last.lat, last.lng, point.lat, point.lng);
            const timeDiff = (point.timestamp - last.timestamp) / 1000;
            isNoise = segDist > 0.05 && timeDiff < 3;

            if (!isNoise && segDist > 0.001) {
              setDistanceKm((d) => d + segDist);

              const now = point.timestamp;
              recentDistancesRef.current = [
                ...recentDistancesRef.current.filter((r) => now - r.time < 60000),
                { dist: segDist, time: now },
              ];
              const recentDist = recentDistancesRef.current.reduce((s, r) => s + r.dist, 0);
              const recentTime = (now - (recentDistancesRef.current[0]?.time ?? now)) / 1000;
              if (recentDist > 0.05 && recentTime > 5) {
                setCurrentPaceSecPerKm(recentTime / recentDist);
              }
            }
          }

          if (!isNoise) {
            setRoutePoints((prev) => [...prev, point]);
          }

          lastPointRef.current = point;
        }
      );
      return true;
    } finally {
      isStartingTrackingRef.current = false;
    }
  }, []);
```

Et rendre `handlePause` async pour attendre correctement la reprise :

```ts
  const handlePause = async () => {
    if (trackingState === 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (locationSubRef.current) locationSubRef.current.remove();
      locationSubRef.current = null;
      setTrackingState('paused');
      Vibration.vibrate(200);
    } else if (trackingState === 'paused') {
      const ok = await startLocationTracking();
      if (!ok) return;
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      setTrackingState('running');
      Vibration.vibrate(100);
    }
  };
```

(Vérifier l'appelant du bouton pause/reprise dans le JSX plus bas dans le fichier — `onPress={handlePause}` reste valide, React accepte un handler `async` en `onPress`.)

- [ ] **Étape 3 : Vérifier manuellement**

Démarrer une session cardio, mettre en pause, double-taper rapidement sur "reprendre". Vérifier dans les logs (`console.log` temporaire ou React DevTools) qu'une seule souscription GPS est active. Terminer une session normale et vérifier que la distance totale correspond au trajet réel (pas doublée).

- [ ] **Étape 4 : Commit**

```bash
git add plugins/cardio/src/screens/CardioTracker.tsx
git commit -m "fix(cardio): make routePoints updater pure, guard against duplicate GPS subscriptions on resume"
```

---

## Tâche 12 — Désabonnement `onAuthStateChange` + garde de ré-entrée (Finding #12, MOYEN)

**Files:**
- Modify: `apps/mobile/src/stores/authStore.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Étape 1 : Ajouter un désabonnement explicite et une garde de ré-entrée dans `authStore.ts`**

```ts
interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => () => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

let authListenerStarted = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  initialize: () => {
    if (authListenerStarted) {
      return () => {};
    }
    authListenerStarted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().refreshProfile();
      } else {
        set({ profile: null });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().refreshProfile();
      }
      set({ isLoading: false, isInitialized: true });
    });

    return () => {
      subscription.unsubscribe();
      authListenerStarted = false;
    };
  },

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
    queryClient.clear();
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      set({ profile: data as UserProfile });
    }
  },
}));
```

(`initialize` change de forme : elle n'est plus `async` et retourne maintenant la fonction de cleanup directement, exploitable par `useEffect`. La garde module-level `authListenerStarted` empêche un double abonnement si `initialize()` est appelée deux fois avant qu'un cleanup n'ait tourné — par exemple lors d'un Fast Refresh en dev.)

- [ ] **Étape 2 : Adapter l'appel dans `app/_layout.tsx`**

```ts
  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, []);
```

- [ ] **Étape 3 : Vérifier manuellement**

Lancer l'app, se connecter, déclencher un Fast Refresh (sauvegarder un fichier ouvert). Vérifier dans les logs qu'il n'y a pas de doublon d'appels à `refreshProfile` lors d'un changement d'état auth ultérieur (ajouter temporairement un `console.log` dans le listener pour compter les invocations si besoin).

- [ ] **Étape 4 : Commit**

```bash
git add apps/mobile/src/stores/authStore.ts apps/mobile/app/_layout.tsx
git commit -m "fix(auth): properly unsubscribe onAuthStateChange, guard against re-entrant initialize()"
```

---

## Tâche 13 — `storage.ts` : `clearAll()` ne doit plus effacer la session Supabase (Finding #13, MOYEN)

**Files:**
- Modify: `apps/mobile/src/lib/storage.ts`

`appStorage.clearAll()`/`pluginStorage.clearAll()` appellent `AsyncStorage.clear()` global — qui efface aussi la session Supabase (stockée dans le même `AsyncStorage` par `lib/supabase.ts`). Latent aujourd'hui (aucun appelant), mais le nom invite à l'erreur.

- [ ] **Étape 1 : Scoper `clearAll()` par namespace**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = (ns: string, key: string) => `${ns}:${key}`;

async function clearNamespace(ns: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const nsKeys = keys.filter((k) => k.startsWith(`${ns}:`));
  if (nsKeys.length > 0) await AsyncStorage.multiRemove(nsKeys);
}

/** General-purpose async storage for app preferences */
export const appStorage = {
  set: (key: string, value: string | number | boolean) =>
    AsyncStorage.setItem(prefix('app', key), String(value)),
  getString: (key: string) => AsyncStorage.getItem(prefix('app', key)),
  getBoolean: async (key: string) => {
    const v = await AsyncStorage.getItem(prefix('app', key));
    return v === null ? undefined : v === 'true';
  },
  getNumber: async (key: string) => {
    const v = await AsyncStorage.getItem(prefix('app', key));
    return v === null ? undefined : Number(v);
  },
  delete: (key: string) => AsyncStorage.removeItem(prefix('app', key)),
  clearAll: () => clearNamespace('app'),
};

/** Plugin-specific async storage */
export const pluginStorage = {
  set: (key: string, value: string | number | boolean) =>
    AsyncStorage.setItem(prefix('plugin', key), String(value)),
  getString: (key: string) => AsyncStorage.getItem(prefix('plugin', key)),
  delete: (key: string) => AsyncStorage.removeItem(prefix('plugin', key)),
  clearAll: () => clearNamespace('plugin'),
};

// Typed helpers (async)
export const storage = appStorage;
```

- [ ] **Étape 2 : Vérifier manuellement**

Se connecter, appeler `appStorage.clearAll()` depuis un breakpoint/console de debug, vérifier que la session Supabase (`supabase.auth.getSession()`) reste valide après l'appel.

- [ ] **Étape 3 : Commit**

```bash
git add apps/mobile/src/lib/storage.ts
git commit -m "fix(storage): scope clearAll() to its own namespace instead of wiping all AsyncStorage"
```

---

## Tâche 14 — Supprimer le pipeline persona/system-prompt côté client mort (Finding #14, MOYEN)

**Files:**
- Modify: `apps/mobile/src/lib/PluginLoader.tsx`

Le backend ignore `payload.system` et `payload.user_context` envoyés par le client (il reconstruit son propre prompt via `buildSystemPrompt(userCtx)` — voir `backend/api/src/routes/ai.ts:206`). `applyPersonaDynamicPrompt` fait une requête Supabase et construit un prompt qui ne sert jamais.

- [ ] **Étape 1 : Supprimer `applyPersonaDynamicPrompt` et ses appels**

Dans `apps/mobile/src/lib/PluginLoader.tsx`, supprimer la fonction (lignes 31-56) :

```ts
/** Load persona settings from Supabase and inject dynamic system prompt */
async function applyPersonaDynamicPrompt(manifest: PluginManifest, userId: string): Promise<PluginManifest> {
  ...
}
```

Et ses deux appels dans `loadInstalledPlugins` :

```ts
          const mod = await loader();
          if (mod.default.mandatory === true) {
            let manifest: PluginManifest = mod.default;
            registerPlugin(manifest);
            aiBridge.registerPlugin(manifest);
            loadedRef.current.add(pluginId);
          }
```

```ts
        try {
          const mod = await loader();
          let manifest: PluginManifest = mod.default;
          registerPlugin(manifest);
          aiBridge.registerPlugin(manifest);
          loadedRef.current.add(pluginId);
        } catch (err) {
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit -p apps/mobile
```

- [ ] **Étape 3 : Commit**

```bash
git add apps/mobile/src/lib/PluginLoader.tsx
git commit -m "chore(plugins): remove dead client-side persona prompt pipeline (backend never reads it)"
```

---

## Tâche 15 — Liste statique des plugins obligatoires (Finding #15, MOYEN)

**Files:**
- Modify: `apps/mobile/src/lib/PluginLoader.tsx`

Le "pre-load mandatory plugins" importe dynamiquement les 19 manifests à chaque connexion pour ne lire qu'un booléen — alors que `mandatory: true` n'existe (aujourd'hui) que sur le plugin `coach`.

- [ ] **Étape 1 : Remplacer la boucle par une liste statique**

Ajouter juste après `PLUGIN_LOADERS` :

```ts
// Plugins pre-loaded unconditionally regardless of user_plugins — keep in
// sync with any manifest.ts declaring `mandatory: true`.
const MANDATORY_PLUGIN_IDS: string[] = ['coach'];
```

Remplacer la boucle "Pre-load mandatory plugins" (à l'intérieur de `loadInstalledPlugins`, structure déjà posée par la Tâche 5) pour itérer sur `MANDATORY_PLUGIN_IDS` au lieu de `Object.entries(PLUGIN_LOADERS)` — déjà fait dans le code de la Tâche 5 ci-dessus si exécutée après. Si la Tâche 5 a été exécutée en premier avec le fallback `Object.keys(PLUGIN_LOADERS)`, remplacer cette ligne :

```ts
      for (const pluginId of Object.keys(PLUGIN_LOADERS)) {
```

par :

```ts
      for (const pluginId of MANDATORY_PLUGIN_IDS) {
```

- [ ] **Étape 2 : Vérifier manuellement**

Se connecter avec un compte neuf. Le plugin `coach` doit apparaître immédiatement ; le temps de démarrage de `PluginLoader` doit visiblement baisser (mesurer avec un `console.time`/`console.timeEnd` temporaire autour de `loadInstalledPlugins()` avant/après si un chiffre est nécessaire).

- [ ] **Étape 3 : Commit**

```bash
git add apps/mobile/src/lib/PluginLoader.tsx
git commit -m "perf(plugins): stop importing all 19 manifests at login just to check a boolean"
```

---

## Tâche 16 — `paddingBottom: 100` manquant sur 2 écrans (Finding #16, MOYEN)

**Files:**
- Modify: `plugins/community/src/screens/ConversationScreen.tsx:67`
- Modify: `plugins/community/src/screens/GroupsScreen.tsx:22`

`BarcodeScanner` et `StretchingSession` (également cités par l'audit) sont volontairement exclus de cette tâche : ce sont des écrans plein écran (caméra / séance active) où le tab bar n'a probablement pas vocation à rester visible — à confirmer visuellement avant de leur appliquer le même correctif, plutôt que de le faire à l'aveugle.

- [ ] **Étape 1 : `ConversationScreen.tsx`**

```tsx
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, paddingBottom: 100 }}>
```

- [ ] **Étape 2 : `GroupsScreen.tsx`**

```tsx
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
```

- [ ] **Étape 3 : Vérifier visuellement**

Ouvrir une conversation communautaire et l'écran des groupes, vérifier que le dernier élément (composer de message / dernière carte de groupe) n'est plus masqué par le tab bar.

- [ ] **Étape 4 : Commit**

```bash
git add plugins/community/src/screens/ConversationScreen.tsx plugins/community/src/screens/GroupsScreen.tsx
git commit -m "fix(community): add missing paddingBottom for tab bar clearance on 2 screens"
```

---

## Tâche 17 — Scoper la session d'entraînement active par utilisateur (Finding #17, FAIBLE-MOYEN)

**Files:**
- Modify: `apps/mobile/src/stores/workoutStore.ts`

- [ ] **Étape 1 : Rendre `SESSION_KEY` dépendant de l'utilisateur**

```ts
const sessionKey = (userId: string) => `workout:activeSession:${userId}`;
```

Remplacer les 3 usages :

```ts
  restoreSession: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const raw = await AsyncStorage.getItem(sessionKey(user.id));
      if (!raw) return;
      const session = JSON.parse(raw) as WorkoutSession;
      const { data } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', session.id)
        .is('ended_at', null)
        .single();
      if (data) {
        set({ currentSession: data as WorkoutSession });
      } else {
        await AsyncStorage.removeItem(sessionKey(user.id));
      }
    } catch {
      if (user) await AsyncStorage.removeItem(sessionKey(user.id));
    }
  },
```

```ts
    if (!error && data) {
      const session = data as WorkoutSession;
      set({ currentSession: session, activeSets: [], currentWorkoutExercises: workoutExercises, cycleConfig });
      AsyncStorage.setItem(sessionKey(user.id), JSON.stringify(session)).catch(() => {});
    }
```

```ts
  endSession: async () => {
    const { currentSession } = get();
    const user = useAuthStore.getState().user;
    if (!currentSession) return;

    if (!currentSession.ended_at) {
      await supabase
        .from('workout_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', currentSession.id);
    }

    callCreditsEarnWithResult(supabase, 'workout', currentSession.id).then((result) => {
      if (result.credited) {
        const { useCreditStore } = require('../stores/creditStore');
        useCreditStore.getState().showEarnToast();
      }
    });

    if (user) AsyncStorage.removeItem(sessionKey(user.id)).catch(() => {});
    set({ currentSession: null, activeSets: [], currentWorkoutExercises: [], cycleConfig: null });
  },
```

- [ ] **Étape 2 : Vérifier manuellement**

Démarrer une séance avec le compte A sans la terminer, se déconnecter, se connecter avec le compte B sur le même appareil. B ne doit voir aucune session en cours restaurée.

- [ ] **Étape 3 : Commit**

```bash
git add apps/mobile/src/stores/workoutStore.ts
git commit -m "fix(workout): scope the active-session AsyncStorage key by userId"
```

---

## Tâche 18 — Valider les URLs de deep-link des notifications push (Finding #18, FAIBLE-MOYEN)

**Files:**
- Create: `apps/mobile/src/lib/notificationRoutes.ts`
- Modify: `apps/mobile/app/(app)/_layout.tsx:34-39`

- [ ] **Étape 1 : Créer l'allowlist de préfixes de routes**

```ts
// apps/mobile/src/lib/notificationRoutes.ts

// Prefixes a push-notification deep link is allowed to navigate to.
// Keep in sync with apps/mobile/app/(app)/ route segments.
const ALLOWED_ROUTE_PREFIXES = [
  '/(app)/ai',
  '/(app)/notifications',
  '/(app)/workout',
  '/(app)/profile',
  '/(app)/(plugins)/',
];

export function isAllowedNotificationRoute(url: string): boolean {
  if (!url.startsWith('/')) return false;
  return ALLOWED_ROUTE_PREFIXES.some((prefix) => url.startsWith(prefix));
}
```

- [ ] **Étape 2 : Valider avant `router.push` dans `(app)/_layout.tsx`**

```ts
import { isAllowedNotificationRoute } from '../../src/lib/notificationRoutes';

function handleNotificationResponse(response: NotificationsType.NotificationResponse) {
  const url = response.notification.request.content.data?.url as string | undefined;
  if (url && isAllowedNotificationRoute(url)) {
    router.push(url as any);
  } else if (url) {
    console.warn('[Notifications] Blocked navigation to disallowed route:', url);
  }
}
```

- [ ] **Étape 3 : Vérifier manuellement**

Envoyer une notification de test (via le endpoint `/notifications` backend ou Expo push tool) avec `data.url` pointant vers une route légitime (`/(app)/workout`) — doit naviguer. Avec une URL hors-liste (`https://evil.example.com` ou une route absente de la liste) — doit logguer un warning et ne pas naviguer.

- [ ] **Étape 4 : Commit**

```bash
git add apps/mobile/src/lib/notificationRoutes.ts apps/mobile/app/\(app\)/_layout.tsx
git commit -m "fix(notifications): validate push notification deep-link URLs against an allowlist"
```

---

## Tâche 19 — Fuite du listener `abort` dans `AIBridge.sendMessage` (Finding #19, FAIBLE)

**Files:**
- Modify: `packages/ai-client/src/AIBridge.ts`

Le listener `abort` n'est jamais retiré et peut rejeter une promesse déjà réglée si le signal est déclenché après la fin de la requête.

- [ ] **Étape 1 : Ajouter `{ once: true }` et un garde de promesse déjà réglée**

Dans `sendMessage` (après les modifications de la Tâche 1), remplacer :

```ts
      if (signal) {
        signal.addEventListener('abort', () => { xhr.abort(); reject(new Error('Aborted')); });
      }
```

par :

```ts
      let settled = false;
      const originalResolve = resolve;
      const originalReject = reject;
      resolve = ((...args: Parameters<typeof originalResolve>) => {
        settled = true;
        originalResolve(...args);
      }) as typeof resolve;
      reject = ((...args: Parameters<typeof originalReject>) => {
        settled = true;
        originalReject(...args);
      }) as typeof reject;

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (settled) return;
            xhr.abort();
            reject(new Error('Aborted'));
          },
          { once: true },
        );
      }
```

(Note : `resolve`/`reject` sont les paramètres du `Promise` executor — les réaffecter localement dans le même scope fonctionne en JS mais est inhabituel à lire. Alternative plus lisible, à préférer si le reviewer la juge plus claire : introduire un simple booléen `settled` mis à `true` au début de `xhr.onload` et dans le `catch` de `xhr.onerror`/`ontimeout`, et vérifier `if (settled) return;` en première ligne du handler `abort` — sans réaffecter `resolve`/`reject`. Choisir cette seconde forme si le wrapping ci-dessus complique la lecture du diff.)

Version recommandée (plus simple, à utiliser) :

```ts
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;
      xhr.open('POST', `${this.agentUrl}/chat/stream`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('X-Conversation-Id', conversationId);

      let processedLength = 0;
      let buffer = '';
      let done = false;

      const processChunk = (text: string) => {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data) as AIStreamChunk;
            if (chunk.type === 'chunk' && chunk.content) {
              onChunk(chunk.content);
            } else if (chunk.type === 'actions' && chunk.actions && onActions) {
              onActions(chunk.actions);
            } else if (chunk.type === 'error') {
              settled = true;
              reject(new Error(chunk.error ?? 'Stream error'));
            }
          } catch {
            // Ignore JSON parse errors for partial chunks
          }
        }
      };

      xhr.onprogress = () => {
        if (done) return;
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        if (newText) processChunk(newText);
      };

      xhr.onload = () => {
        done = true;
        settled = true;
        const remaining = xhr.responseText.slice(processedLength);
        if (remaining) processChunk(remaining);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`AI API error ${xhr.status}: ${xhr.responseText.slice(0, 500)}`));
        }
      };

      xhr.onerror = () => { settled = true; reject(new Error('Network error')); };
      xhr.ontimeout = () => { settled = true; reject(new Error('Request timeout')); };

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (settled) return;
            settled = true;
            xhr.abort();
            reject(new Error('Aborted'));
          },
          { once: true },
        );
      }

      xhr.send(JSON.stringify(payload));
    });
```

(Remplace tout le corps du `new Promise<void>((resolve, reject) => { ... })` de `sendMessage`.)

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit -p packages/ai-client
```

- [ ] **Étape 3 : Commit**

```bash
git add packages/ai-client/src/AIBridge.ts
git commit -m "fix(ai-client): guard abort listener against firing on an already-settled request"
```

**Note de portée :** Aucun appelant ne passe de `signal` aujourd'hui (`aiStore.sendMessage` passe `undefined`) — ce correctif rend le code sûr mais ne câble pas encore l'annulation réelle d'un stream IA en cours (quitter l'écran de chat ne coupe ni la requête ni la dépense de crédit). Câbler un `AbortController` réel dans `aiStore` est un chantier de fonctionnalité séparé, pas un simple correctif de bug, et donc hors de ce plan.

---

## Ordre d'exécution recommandé

Les tâches sont indépendantes sauf :
- **Tâche 5 et 15** modifient toutes deux `PluginLoader.tsx` — exécuter 5 puis 15 dans cet ordre (15 s'appuie sur la structure posée par 5), ou fusionner leur exécution dans une seule session pour éviter un conflit de merge trivial.
- **Tâche 14** modifie aussi `PluginLoader.tsx` — l'exécuter après 5 et 15 pour la même raison.
- **Tâche 4 et 12** modifient toutes deux `authStore.ts` (`queryClient.clear()` dans `signOut`) — exécuter 4 avant 12, ou vérifier que le `signOut` réécrit en Tâche 12 conserve bien la ligne `queryClient.clear()` ajoutée en Tâche 4.

Priorité suggérée si les tâches ne sont pas toutes traitées d'un coup : **1 → 3 → 2 → 6 → 4 → 4bis → 5 → 15 → 14 → le reste**, en plaçant la Tâche 3 avant la 2 malgré la numérotation, car elle corrige une perte réelle de monnaie utilisateur découverte pendant ce travail de planification.
