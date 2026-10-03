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
--
-- Note: send_coin_gift calls public.ensure_gamification_profile(), created in
-- migration 20260822120000_gamification_economy_rpc.sql (Task 2). That
-- migration must be applied before this one for send_coin_gift to work.

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
