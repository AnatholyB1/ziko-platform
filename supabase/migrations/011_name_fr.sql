-- Add name_fr column for French translations
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS name_fr TEXT;
ALTER TABLE public.food_database ADD COLUMN IF NOT EXISTS name_fr TEXT;
CREATE INDEX IF NOT EXISTS idx_food_name_fr ON public.food_database(name_fr);
