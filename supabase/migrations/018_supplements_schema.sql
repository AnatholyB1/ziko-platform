-- ═══════════════════════════════════════════════════════════
-- 018 — Supplements Catalog & Price Comparison
-- ═══════════════════════════════════════════════════════════

-- Supplement brands
CREATE TABLE IF NOT EXISTS public.supplement_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supplement categories
CREATE TABLE IF NOT EXISTS public.supplement_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT, -- Ionicons name
  display_order INTEGER DEFAULT 0
);

-- Supplements (products)
CREATE TABLE IF NOT EXISTS public.supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.supplement_brands(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.supplement_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  ingredients TEXT, -- comma-separated or raw
  nutrition_per_serving JSONB, -- { calories, protein_g, carbs_g, fat_g, ... }
  serving_size TEXT, -- e.g. "30g", "1 capsule"
  servings_per_container INTEGER,
  flavors TEXT[], -- available flavors
  source_url TEXT, -- original product page
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, slug)
);

-- Price entries (one per source/date to track history)
CREATE TABLE IF NOT EXISTS public.supplement_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id UUID NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  price DECIMAL(8,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  source TEXT NOT NULL, -- e.g. 'nutrimuscle.com', 'myprotein.fr'
  source_url TEXT,
  in_stock BOOLEAN DEFAULT true,
  price_per_serving DECIMAL(8,4),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast price lookups
CREATE INDEX IF NOT EXISTS idx_supplement_prices_supplement ON public.supplement_prices(supplement_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplements_category ON public.supplements(category_id);
CREATE INDEX IF NOT EXISTS idx_supplements_brand ON public.supplements(brand_id);

-- User favorites
CREATE TABLE IF NOT EXISTS public.user_supplement_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, supplement_id)
);

-- RLS
ALTER TABLE public.supplement_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_supplement_favorites ENABLE ROW LEVEL SECURITY;

-- Everyone can read catalog
CREATE POLICY "brands_read" ON public.supplement_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_read" ON public.supplement_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplements_read" ON public.supplements FOR SELECT TO authenticated USING (true);
CREATE POLICY "prices_read" ON public.supplement_prices FOR SELECT TO authenticated USING (true);

-- Favorites: users own their rows
CREATE POLICY "favorites_own" ON public.user_supplement_favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Seed categories ──────────────────────────────────────
INSERT INTO public.supplement_categories (name, slug, icon, display_order) VALUES
  ('Protéines', 'protein', 'fitness', 1),
  ('Créatine', 'creatine', 'flash', 2),
  ('BCAA & EAA', 'bcaa-eaa', 'leaf', 3),
  ('Pré-workout', 'pre-workout', 'rocket', 4),
  ('Vitamines & Minéraux', 'vitamins', 'medkit', 5),
  ('Oméga & Acides gras', 'omega', 'water', 6),
  ('Collagène', 'collagen', 'body', 7),
  ('Gainers', 'gainer', 'trending-up', 8),
  ('Brûleurs de graisses', 'fat-burner', 'flame', 9),
  ('Articulations', 'joints', 'accessibility', 10),
  ('Sommeil & Récupération', 'sleep-recovery', 'moon', 11),
  ('Super Greens', 'greens', 'nutrition', 12)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed brands ──────────────────────────────────────────
INSERT INTO public.supplement_brands (name, slug, website_url, country) VALUES
  ('Optimum Nutrition', 'optimum-nutrition', 'https://www.optimumnutrition.com', 'US'),
  ('MyProtein', 'myprotein', 'https://www.myprotein.fr', 'UK'),
  ('Nutrimuscle', 'nutrimuscle', 'https://www.nutrimuscle.com', 'FR'),
  ('Eric Favre', 'eric-favre', 'https://www.ericfavre.com', 'FR'),
  ('Eafit', 'eafit', 'https://www.eafit.com', 'FR'),
  ('Nutri&Co', 'nutri-co', 'https://www.nutri.co', 'FR'),
  ('NOW Foods', 'now-foods', 'https://www.nowfoods.com', 'US'),
  ('Scitec Nutrition', 'scitec', 'https://www.scitecnutrition.com', 'HU'),
  ('BioTech USA', 'biotech-usa', 'https://www.biotechusa.com', 'HU'),
  ('Dymatize', 'dymatize', 'https://www.dymatize.com', 'US'),
  ('BSN', 'bsn', 'https://www.bsn.com', 'US'),
  ('MuscleTech', 'muscletech', 'https://www.muscletech.com', 'US'),
  ('Applied Nutrition', 'applied-nutrition', 'https://www.appliednutrition.uk', 'UK'),
  ('Bulk', 'bulk', 'https://www.bulk.com', 'UK'),
  ('Prozis', 'prozis', 'https://www.prozis.com', 'PT')
ON CONFLICT (slug) DO NOTHING;
