-- ============================================================
-- 007 — Gamification system
-- Adds: XP, levels, coins, streaks, shop, inventory
-- Purpose: Gamify workouts & habits with rewards
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. LEVEL DEFINITIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.level_definitions (
  level           INTEGER PRIMARY KEY,
  xp_required     INTEGER NOT NULL,
  title           TEXT NOT NULL,
  reward_coins    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.level_definitions (level, xp_required, title, reward_coins) VALUES
  (1,     0,    'Débutant',     0),
  (2,   100,    'Initié',      25),
  (3,   250,    'Régulier',    50),
  (4,   500,    'Sportif',     75),
  (5,  1000,    'Athlète',    100),
  (6,  1750,    'Guerrier',   150),
  (7,  2800,    'Champion',   200),
  (8,  4200,    'Élite',      300),
  (9,  6000,    'Légende',    400),
  (10, 8500,    'Titan',      500),
  (11,12000,    'Dieu du Sport',750),
  (12,16000,    'Immortel',  1000)
ON CONFLICT (level) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. USER GAMIFICATION PROFILE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_gamification (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp                INTEGER NOT NULL DEFAULT 0,
  level             INTEGER NOT NULL DEFAULT 1,
  coins             INTEGER NOT NULL DEFAULT 0,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  equipped_title    TEXT DEFAULT 'Débutant',
  equipped_badge    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_gamification_own" ON public.user_gamification
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. XP TRANSACTIONS (audit trail)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('workout', 'habit', 'streak_bonus', 'level_up', 'achievement')),
  source_id     UUID,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xp_tx_user ON public.xp_transactions(user_id, created_at DESC);

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_transactions_own" ON public.xp_transactions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. COIN TRANSACTIONS (audit trail)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,  -- positive = earn, negative = spend
  source        TEXT NOT NULL CHECK (source IN ('workout', 'habit', 'streak_bonus', 'level_up', 'purchase', 'refund')),
  source_id     UUID,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coin_tx_user ON public.coin_transactions(user_id, created_at DESC);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coin_transactions_own" ON public.coin_transactions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 5. SHOP ITEMS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL CHECK (category IN ('title', 'badge', 'theme')),
  price           INTEGER NOT NULL,
  icon            TEXT,
  level_required  INTEGER NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shop items are readable by all authenticated users
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_items_read" ON public.shop_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed default shop items
INSERT INTO public.shop_items (name, description, category, price, icon, level_required) VALUES
  -- Titles
  ('Machine',       'Tu es une machine à entraînement',     'title',   50, '⚙️', 2),
  ('Beast Mode',    'Mode bête activé',                     'title',  100, '🦁', 3),
  ('Iron Will',     'Volonté de fer',                       'title',  150, '🔩', 4),
  ('No Pain No Gain','La douleur est temporaire',           'title',  200, '💥', 5),
  ('Spartan',       'Entraîné comme un Spartiate',          'title',  300, '🛡️', 6),
  ('Hercule',       'Force légendaire',                     'title',  500, '⚡', 7),
  ('Terminator',    'Rien ne t''arrête',                    'title',  750, '🤖', 8),
  ('Dragon Slayer', 'Tu terrasses les dragons',             'title', 1000, '🐉', 9),
  ('Dieu de la Salle','Le gym est ton temple',              'title', 1500, '👑', 10),

  -- Badges
  ('Flamme',        'Badge flamme pour ton profil',         'badge',   30, '🔥', 1),
  ('Muscle',        'Badge muscle',                         'badge',   30, '💪', 1),
  ('Étoile',        'Badge étoile dorée',                   'badge',   50, '⭐', 2),
  ('Trophée',       'Badge trophée',                        'badge',   75, '🏆', 3),
  ('Médaille d''or','Badge médaille d''or',                 'badge',  100, '🥇', 4),
  ('Diamant',       'Badge diamant rare',                   'badge',  200, '💎', 6),
  ('Couronne',      'Badge couronne royale',                'badge',  400, '👑', 8),
  ('Éclair',        'Badge éclair de puissance',            'badge',   60, '⚡', 2),
  ('Cœur',          'Badge détermination',                  'badge',   40, '❤️‍🔥', 1),
  ('Dragon',        'Badge dragon mythique',                'badge',  500, '🐲', 9),

  -- Themes
  ('Bleu Océan',    'Thème bleu apaisant',                  'theme',  150, '🌊', 3),
  ('Violet Royal',  'Thème violet élégant',                 'theme',  150, '🟣', 3),
  ('Vert Forêt',    'Thème vert naturel',                   'theme',  150, '🌲', 3),
  ('Rouge Feu',     'Thème rouge intense',                  'theme',  200, '🔴', 5),
  ('Or Prestige',   'Thème doré premium',                   'theme',  400, '✨', 7),
  ('Noir Carbone',  'Thème sombre élite',                   'theme',  500, '🖤', 8)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. USER INVENTORY (purchased items)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  is_equipped   BOOLEAN NOT NULL DEFAULT false,
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX idx_inventory_user ON public.user_inventory(user_id);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_inventory_own" ON public.user_inventory
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
