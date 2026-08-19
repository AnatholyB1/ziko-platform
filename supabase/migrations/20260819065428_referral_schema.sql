-- 053 — Referral & promo schema

-- 1. Personal referral code per user
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate code on insert if not set
CREATE OR REPLACE FUNCTION generate_referral_code(user_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  handle TEXT;
  code TEXT;
BEGIN
  SELECT UPPER(COALESCE(SUBSTRING(COALESCE(u.handle, u.name, 'USER'), 1, 4), 'USER'))
  INTO handle FROM public.user_profiles u WHERE id = user_id;
  LOOP
    code := handle || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Back-fill existing users
UPDATE public.user_profiles
SET referral_code = generate_referral_code(id)
WHERE referral_code IS NULL;

-- 2. Extend app_invites (check if table exists first)
-- Add columns if table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_invites') THEN
    ALTER TABLE public.app_invites
      ADD COLUMN IF NOT EXISTS invitee_email TEXT,
      ADD COLUMN IF NOT EXISTS invitee_name  TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'reward_pending', 'rewarded'));
  ELSE
    CREATE TABLE IF NOT EXISTS public.app_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      invite_code TEXT NOT NULL,
      used_by UUID REFERENCES auth.users(id),
      invitee_email TEXT,
      invitee_name TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'reward_pending', 'rewarded')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.app_invites ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "app_invites_own" ON public.app_invites
      FOR ALL USING (auth.uid() = inviter_id OR auth.uid() = used_by);
  END IF;
END $$;

-- 3. Add used_referral_code flag to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS used_referral_code BOOLEAN DEFAULT false;

-- 4. Promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_pct INTEGER CHECK (discount_pct BETWEEN 1 AND 100),
  max_uses    INTEGER,
  uses_count  INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_read" ON public.promo_codes
  FOR SELECT TO authenticated USING (is_active = true);

-- 5. Track promo code usage per user
CREATE TABLE IF NOT EXISTS public.user_promo_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_id    UUID NOT NULL REFERENCES public.promo_codes(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, promo_id)
);
ALTER TABLE public.user_promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_redemptions_own" ON public.user_promo_redemptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
