-- 024: Food products catalogue + nutrition_logs barcode enrichment columns
-- CRITICAL: food_products is a SHARED catalogue — no user_id column.
-- RLS uses auth.role() = 'authenticated', NOT the per-user uid pattern used in other tables.

CREATE TABLE IF NOT EXISTS public.food_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode         TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  brand           TEXT,
  energy_kcal     INTEGER NOT NULL DEFAULT 0,
  proteins_g      NUMERIC(6, 2) NOT NULL DEFAULT 0,
  carbs_g         NUMERIC(6, 2) NOT NULL DEFAULT 0,
  fat_g           NUMERIC(6, 2) NOT NULL DEFAULT 0,
  nutriscore_grade TEXT,
  ecoscore_grade   TEXT,
  image_url        TEXT,
  serving_size_g   INTEGER NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared catalogue RLS — any authenticated user can read and insert
ALTER TABLE public.food_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_products_read" ON public.food_products
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "food_products_insert" ON public.food_products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Extend nutrition_logs with nullable barcode-enrichment columns
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS food_product_id UUID REFERENCES public.food_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nutriscore_grade TEXT,
  ADD COLUMN IF NOT EXISTS ecoscore_grade TEXT;
