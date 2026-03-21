-- ════════════════════════════════════════════════════════════
-- MIGRATION 010: PROFILE BANNERS + EQUIPPED BANNER SUPPORT
-- ════════════════════════════════════════════════════════════

-- 1. Extend shop_items category to include 'banner'
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_category_check
  CHECK (category IN ('title', 'badge', 'theme', 'banner'));

-- 2. Add equipped_banner to user_gamification
ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS equipped_banner_name TEXT DEFAULT NULL;

-- 3. Seed banner items
INSERT INTO public.shop_items (name, description, category, price, icon, level_required, metadata) VALUES
  ('Flamme Ardente',   'Anneau de flammes autour de ton avatar',      'banner',  100, '🔥', 2,  '{"colors":["#FF5C1A","#FF9800","#FFD54F"]}'::jsonb),
  ('Glace Éternelle',  'Anneau glacé bleu cristallin',                'banner',  100, '❄️', 2,  '{"colors":["#06B6D4","#3B82F6","#818CF8"]}'::jsonb),
  ('Néon Violet',      'Anneau néon violet-rose',                     'banner',  150, '💜', 3,  '{"colors":["#A855F7","#EC4899","#F43F5E"]}'::jsonb),
  ('Émeraude',         'Anneau vert émeraude luxueux',                'banner',  150, '💚', 3,  '{"colors":["#10B981","#34D399","#A7F3D0"]}'::jsonb),
  ('Or Massif',        'Anneau doré prestigieux',                     'banner',  300, '👑', 5,  '{"colors":["#D97706","#F59E0B","#FDE68A"]}'::jsonb),
  ('Sang Royal',       'Anneau rouge foncé royal',                    'banner',  300, '🩸', 6,  '{"colors":["#991B1B","#DC2626","#F87171"]}'::jsonb),
  ('Arc-en-ciel',      'Anneau multicolore spectaculaire',            'banner',  500, '🌈', 7,  '{"colors":["#EF4444","#F59E0B","#10B981","#3B82F6","#8B5CF6"]}'::jsonb),
  ('Diamant Noir',     'Anneau noir élite avec reflets argentés',     'banner',  750, '🖤', 9,  '{"colors":["#1C1A17","#525252","#D4D4D4"]}'::jsonb)
ON CONFLICT DO NOTHING;

-- 4. Add equipped_theme to user_gamification for theme tracking
ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS equipped_theme TEXT DEFAULT NULL;
