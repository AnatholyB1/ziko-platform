-- Phase 19 (SUPP-04/05, G-02) : stack de complements de l'athlete = uniquement les produits choisis.
-- Un produit = une ligne (dose + un ou plusieurs moments). 0 ligne preinstallee sur un compte neuf (SU-5).
-- Ne remplace pas ziko_user_supplement_favorites (table conservee, plus utilisee par l'UI : pas de conversion).

CREATE TABLE public.ziko_user_supplement_stack (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES public.ziko_supplements(id) ON DELETE CASCADE,
  dose          numeric(8,2) NOT NULL CHECK (dose > 0),
  dose_unit     text,
  moments       text[] NOT NULL
                CHECK (cardinality(moments) >= 1 AND moments <@ ARRAY['morning', 'noon', 'evening']::text[]),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplement_id)
);

CREATE INDEX ziko_idx_user_supplement_stack_user ON public.ziko_user_supplement_stack (user_id);

ALTER TABLE public.ziko_user_supplement_stack ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ziko_user_supplement_stack_own" ON public.ziko_user_supplement_stack
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Privileges : rien pour anon ; pas de privilege de structure pour les autres roles.
REVOKE ALL ON TABLE public.ziko_user_supplement_stack FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_supplement_stack FROM authenticated, service_role;

COMMENT ON TABLE public.ziko_user_supplement_stack IS
  'Stack de complements choisi par l''athlete : dose + moments (morning/noon/evening). Une ligne par produit.';
