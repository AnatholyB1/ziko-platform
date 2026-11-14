-- v1.20 phase 12 (REWD-06, R-8) : equipement atomique d'un objet de la boutique.
-- Avant : le client enchainait N updates non atomiques sur ziko_user_inventory (+ copie sur
-- ziko_user_gamification.equipped_*) ; un echec au milieu laissait 0 ou 2 objets `EQUIPE`.
-- Maintenant : une seule transaction cote base, identite lue dans auth.uid() (aucun parametre user).
-- Fichier SEUL : jamais applique par l'agent.

CREATE OR REPLACE FUNCTION public.ziko_equip_item(p_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_item public.ziko_shop_items;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non connecté');
  END IF;

  SELECT * INTO v_item FROM public.ziko_shop_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Article introuvable');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ziko_user_inventory WHERE user_id = v_user AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Objet non possédé');
  END IF;

  PERFORM public.ziko_ensure_gamification_profile(v_user);

  -- Deselectionne toute la categorie, puis equipe la cible (meme transaction).
  UPDATE public.ziko_user_inventory ui
  SET is_equipped = false
  FROM public.ziko_shop_items si
  WHERE ui.user_id = v_user
    AND ui.item_id = si.id
    AND si.category = v_item.category
    AND ui.is_equipped;

  UPDATE public.ziko_user_inventory
  SET is_equipped = true
  WHERE user_id = v_user AND item_id = p_item_id;

  UPDATE public.ziko_user_gamification
  SET equipped_title       = CASE WHEN v_item.category = 'title'  THEN v_item.name ELSE equipped_title END,
      equipped_badge       = CASE WHEN v_item.category = 'badge'  THEN v_item.icon ELSE equipped_badge END,
      equipped_banner_name = CASE WHEN v_item.category = 'banner' THEN v_item.name ELSE equipped_banner_name END,
      equipped_theme       = CASE WHEN v_item.category = 'theme'  THEN v_item.name ELSE equipped_theme END,
      updated_at           = now()
  WHERE user_id = v_user;

  RETURN jsonb_build_object('success', true, 'category', v_item.category, 'name', v_item.name);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_equip_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_equip_item(uuid) TO authenticated, service_role;
