-- ============================================================
-- v1.20 Phase 21 (Social & Amis) - RPC d'amitie (SOC-01..05, G-02, G-03)
-- Fichier seulement. Toutes les fonctions : SECURITY DEFINER, search_path fige, identite de
-- l'appelant = auth.uid() (jamais un id passe en parametre), EXECUTE reserve a `authenticated`.
-- L'ancien ziko_search_users_fuzzy(search_query, calling_user_id, ...) est laisse en place
-- (compatibilite : il est executable par anon et prend l'id appelant en parametre, ne pas l'etendre).
-- Depend de 202612012101 (index unique de paire, RLS INSERT/UPDATE).
-- ============================================================

-- ---- ziko_send_friend_request : envoi atomique -------------------------------------------
CREATE OR REPLACE FUNCTION public.ziko_send_friend_request(p_addressee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_row public.ziko_friendships%ROWTYPE;
  v_id  uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_addressee IS NULL OR p_addressee = v_me THEN
    RAISE EXCEPTION 'cannot_befriend_self' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ziko_user_profiles WHERE id = p_addressee) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Serialise les envois concurrents sur la meme paire (A->B et B->A simultanes)
  PERFORM pg_advisory_xact_lock(
    hashtextextended(LEAST(v_me::text, p_addressee::text) || ':' || GREATEST(v_me::text, p_addressee::text), 0));

  SELECT * INTO v_row
  FROM public.ziko_friendships
  WHERE (requester_id = v_me AND addressee_id = p_addressee)
     OR (requester_id = p_addressee AND addressee_id = v_me)
  ORDER BY (status = 'accepted') DESC, created_at ASC
  LIMIT 1;

  IF FOUND THEN
    IF v_row.status = 'accepted' THEN
      RETURN jsonb_build_object('relation', 'friend', 'friendship_id', v_row.id, 'created', false);
    ELSIF v_row.status = 'pending' AND v_row.requester_id = v_me THEN
      -- deja envoyee : no-op
      RETURN jsonb_build_object('relation', 'sent', 'friendship_id', v_row.id, 'created', false);
    ELSIF v_row.status = 'pending' THEN
      -- demande inverse en attente (course) : accepte
      UPDATE public.ziko_friendships SET status = 'accepted', updated_at = now() WHERE id = v_row.id;
      RETURN jsonb_build_object('relation', 'friend', 'friendship_id', v_row.id, 'created', false, 'auto_accepted', true);
    ELSE
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.ziko_friendships (requester_id, addressee_id, status)
  VALUES (v_me, p_addressee, 'pending')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('relation', 'sent', 'friendship_id', v_id, 'created', true);
END;
$$;

-- ---- ziko_search_users_with_status : recherche + etat de relation calcule cote serveur ----
CREATE OR REPLACE FUNCTION public.ziko_search_users_with_status(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (
  id            uuid,
  name          text,
  handle        text,
  avatar_url    text,
  goal          text,
  relation      text,    -- none | sent | received | friend
  friendship_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_q   text := trim(coalesce(p_query, ''));
  v_pat text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  -- 2 caracteres minimum (D-01)
  IF char_length(v_q) < 2 THEN
    RETURN;
  END IF;
  -- echappe les jokers LIKE saisis par l'utilisateur
  v_pat := '%' || replace(replace(replace(unaccent(lower(v_q)), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  SELECT p.id, p.name, p.handle, p.avatar_url, p.goal,
         CASE
           WHEN fr.status = 'accepted' THEN 'friend'
           WHEN fr.status = 'pending' AND fr.requester_id = v_me THEN 'sent'
           WHEN fr.status = 'pending' THEN 'received'
           ELSE 'none'
         END AS relation,
         fr.id AS friendship_id
  FROM public.ziko_user_profiles p
  LEFT JOIN LATERAL (
    SELECT f.id, f.status, f.requester_id
    FROM public.ziko_friendships f
    WHERE (f.requester_id = v_me AND f.addressee_id = p.id)
       OR (f.requester_id = p.id AND f.addressee_id = v_me)
    ORDER BY (f.status = 'accepted') DESC, (f.requester_id <> v_me) DESC, f.created_at ASC
    LIMIT 1
  ) fr ON true
  WHERE p.id <> v_me
    AND p.name IS NOT NULL
    AND (unaccent(lower(p.name)) LIKE v_pat ESCAPE '\'
         OR (p.handle IS NOT NULL AND unaccent(lower(p.handle)) LIKE v_pat ESCAPE '\'))
  ORDER BY
    CASE WHEN unaccent(lower(p.name)) = unaccent(lower(v_q)) THEN 0 ELSE 1 END,
    CASE WHEN unaccent(lower(p.name)) LIKE unaccent(lower(v_q)) || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
END;
$$;

-- ---- ziko_list_friendships : amities de l'appelant AVEC le profil minimal de l'autre partie ---
-- ziko_user_profiles n'est lisible que par son proprietaire (users_own_profile) : sans ce RPC,
-- la liste d'amis et En attente ne peuvent pas afficher le nom des autres.
CREATE OR REPLACE FUNCTION public.ziko_list_friendships()
RETURNS TABLE (
  friendship_id uuid,
  other_id      uuid,
  name          text,
  handle        text,
  avatar_url    text,
  goal          text,
  status        text,      -- pending | accepted
  direction     text,      -- sent | received
  created_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  RETURN QUERY
  SELECT f.id,
         o.id,
         o.name,
         o.handle,
         o.avatar_url,
         o.goal,
         f.status,
         CASE WHEN f.requester_id = v_me THEN 'sent' ELSE 'received' END,
         f.created_at
  FROM public.ziko_friendships f
  JOIN public.ziko_user_profiles o
    ON o.id = CASE WHEN f.requester_id = v_me THEN f.addressee_id ELSE f.requester_id END
  WHERE (f.requester_id = v_me OR f.addressee_id = v_me)
    AND f.status IN ('pending', 'accepted')
  ORDER BY f.created_at DESC;
END;
$$;

-- ---- privileges : authenticated uniquement (jamais anon / PUBLIC) -------------------------
REVOKE ALL ON FUNCTION public.ziko_send_friend_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_search_users_with_status(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_list_friendships() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_send_friend_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_search_users_with_status(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_list_friendships() TO authenticated, service_role;
