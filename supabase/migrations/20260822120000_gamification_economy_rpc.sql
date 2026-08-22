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
