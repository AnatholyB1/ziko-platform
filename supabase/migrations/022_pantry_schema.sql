-- ============================================================
-- ZIKO PANTRY PLUGIN — Database Schema
-- Migration: 022_pantry_schema.sql
-- Tables: pantry_items
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  quantity            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit                TEXT NOT NULL DEFAULT 'pieces'
                        CHECK (unit IN ('g', 'kg', 'ml', 'L', 'pieces', 'can', 'box', 'bag')),
  storage_location    TEXT NOT NULL DEFAULT 'pantry'
                        CHECK (storage_location IN ('fridge', 'freezer', 'pantry')),
  food_category       TEXT NOT NULL DEFAULT 'other'
                        CHECK (food_category IN ('fruits', 'vegetables', 'meat', 'fish_seafood',
                                                  'dairy', 'eggs', 'grains_pasta', 'snacks',
                                                  'drinks', 'other')),
  expiration_date     DATE,
  low_stock_threshold NUMERIC(10, 2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pantry_items_user ON public.pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_location ON public.pantry_items(user_id, storage_location);

-- Row Level Security
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pantry_items_own" ON public.pantry_items
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Register pantry plugin
INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES
(
  'pantry',
  '{
    "id": "pantry",
    "name": "Garde-Manger",
    "version": "1.0.0",
    "description": "Inventaire intelligent de votre cuisine : suivez vos stocks, dates d''expiration, et recevez des suggestions de recettes IA basées sur ce que vous avez.",
    "icon": "storefront-outline",
    "category": "nutrition",
    "price": "free",
    "requiredPermissions": ["read_profile"],
    "userDataKeys": ["pantry"],
    "aiSkills": [
      {"name": "pantry_management", "description": "Manage pantry inventory and suggest recipes based on available ingredients", "triggerKeywords": ["garde-manger", "frigo", "stock", "pantry", "ingredients", "ingrediens", "aliments"]}
    ],
    "routes": [
      {"path": "/(plugins)/pantry/dashboard", "title": "Garde-Manger", "icon": "storefront-outline", "showInTabBar": true},
      {"path": "/(plugins)/pantry/add", "title": "Ajouter", "icon": "add-circle-outline", "showInTabBar": false},
      {"path": "/(plugins)/pantry/edit", "title": "Modifier", "icon": "create-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
)
ON CONFLICT (plugin_id) DO UPDATE
  SET manifest = EXCLUDED.manifest,
      version  = EXCLUDED.version;
