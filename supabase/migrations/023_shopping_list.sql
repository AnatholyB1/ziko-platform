-- 023_shopping_list.sql
-- Shopping list items for the Smart Shopping List feature (Phase 9)

-- Source enum
CREATE TYPE public.shopping_item_source AS ENUM ('low_stock', 'recipe');

-- Main table
CREATE TABLE public.shopping_list_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  quantity      NUMERIC,
  unit          TEXT,
  pantry_item_id UUID REFERENCES public.pantry_items(id) ON DELETE SET NULL,
  source        public.shopping_item_source NOT NULL DEFAULT 'low_stock',
  recipe_name   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common access pattern
CREATE INDEX shopping_list_items_user_id_idx ON public.shopping_list_items(user_id);

-- RLS
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_list_items_own" ON public.shopping_list_items
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
