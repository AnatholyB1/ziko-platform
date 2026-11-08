-- ziko: shopping list for the pantry plugin (NOT YET APPLIED - apply only after approval).
--
-- WHY
--   The pantry plugin reads/writes a shopping list table that was never carried into the portfolio
--   project (legacy supabase/migrations/023_shopping_list.sql created un-prefixed `shopping_list_items`).
--   This recreates it with the ziko_ prefix, matching plugins/pantry/src/types/shopping.ts.
--
-- Client privileges follow 20261107170000_ziko_revoke_client_dml.sql: authenticated gets
-- SELECT/INSERT/UPDATE/DELETE (RLS-scoped), anon and PUBLIC get nothing, no TRUNCATE/REFERENCES/
-- TRIGGER/MAINTAIN for any client role.

CREATE TYPE public.ziko_shopping_item_source AS ENUM ('low_stock', 'recipe');

CREATE TABLE public.ziko_shopping_list_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  quantity       numeric,
  unit           text,
  pantry_item_id uuid REFERENCES public.ziko_pantry_items(id) ON DELETE SET NULL,
  source         public.ziko_shopping_item_source NOT NULL DEFAULT 'low_stock',
  recipe_name    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ziko_idx_shopping_list_items_user ON public.ziko_shopping_list_items (user_id);

ALTER TABLE public.ziko_shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ziko_shopping_list_items_own" ON public.ziko_shopping_list_items
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.ziko_shopping_list_items FROM PUBLIC;
REVOKE ALL ON TABLE public.ziko_shopping_list_items FROM anon;
REVOKE ALL ON TABLE public.ziko_shopping_list_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_shopping_list_items TO authenticated;
