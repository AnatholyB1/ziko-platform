-- v1.20 UAT run2 (defaut 6) : plus d'emoji dans ziko_coin_transactions.description.
--
-- Les fonctions SQL ziko_award_xp (recompense de niveau) et ziko_purchase_shop_item (achat) ecrivaient
-- un emoji en tete de description (l'UI le masquait via stripEmoji). Corrige a la source :
-- CREATE OR REPLACE des deux fonctions (corps identiques a 20261001101853, seul le format change ;
-- les privileges existants sont conserves par CREATE OR REPLACE), puis nettoyage des lignes existantes.
-- Fichier uniquement, non applique. Idempotent. Sans emoji dans le fichier (regex par code points).

CREATE OR REPLACE FUNCTION public.ziko_award_xp(p_user_id uuid, p_amount integer, p_source text, p_source_id uuid, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile      public.ziko_user_gamification;
  v_new_xp       INTEGER;
  v_new_level    INTEGER;
  v_leveled_up   BOOLEAN;
  v_level_title  TEXT;
  v_reward_coins INTEGER;
BEGIN
  v_profile := public.ziko_ensure_gamification_profile(p_user_id);

  INSERT INTO public.ziko_xp_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  v_new_xp := v_profile.xp + p_amount;

  SELECT level INTO v_new_level
  FROM public.ziko_level_definitions
  WHERE xp_required <= v_new_xp
  ORDER BY level DESC
  LIMIT 1;

  v_new_level := COALESCE(v_new_level, v_profile.level);
  v_leveled_up := v_new_level > v_profile.level;

  UPDATE public.ziko_user_gamification
  SET xp = v_new_xp, level = v_new_level, updated_at = NOW()
  WHERE user_id = p_user_id;

  IF v_leveled_up THEN
    SELECT reward_coins, title INTO v_reward_coins, v_level_title
    FROM public.ziko_level_definitions WHERE level = v_new_level;

    IF v_reward_coins > 0 THEN
      PERFORM public.ziko_award_coins(
        p_user_id, v_reward_coins, 'level_up', NULL,
        format('Niveau %s atteint : %s !', v_new_level, v_level_title)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('leveled_up', v_leveled_up, 'new_level', v_new_level);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ziko_purchase_shop_item(p_user_id uuid, p_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.ziko_user_gamification;
  v_item    public.ziko_shop_items;
  v_rows    INTEGER;
BEGIN
  v_profile := public.ziko_ensure_gamification_profile(p_user_id);

  SELECT * INTO v_item FROM public.ziko_shop_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Article introuvable');
  END IF;

  IF v_profile.level < v_item.level_required THEN
    RETURN jsonb_build_object('success', false, 'error', format('Niveau %s requis', v_item.level_required));
  END IF;

  IF EXISTS (SELECT 1 FROM public.ziko_user_inventory WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Déjà possédé');
  END IF;

  -- Atomic guarded deduction — fails (0 rows) if balance is insufficient,
  -- closing the race where two purchases could both pass a stale balance check.
  UPDATE public.ziko_user_gamification
  SET coins = coins - v_item.price, updated_at = NOW()
  WHERE user_id = p_user_id AND coins >= v_item.price;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pas assez de pièces');
  END IF;

  INSERT INTO public.ziko_coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, -v_item.price, 'purchase', p_item_id, format('Achat : %s', v_item.name));

  INSERT INTO public.ziko_user_inventory (user_id, item_id)
  VALUES (p_user_id, p_item_id);

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Nettoyage des descriptions existantes : retire les emoji / pictogrammes / selecteurs de variation en tete.
UPDATE public.ziko_coin_transactions
SET description = btrim(regexp_replace(description, '^[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50\u2B06\uFE0F\u200D\s]+', ''))
WHERE description ~ '^[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50\u2B06\uFE0F\u200D]';
