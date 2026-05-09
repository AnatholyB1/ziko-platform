-- ============================================================
-- 022 — Default theme auto-unlock
-- Ensures all users own 'Sport Orange' (default) theme so
-- the shop UI shows it as unlocked from the start.
-- ============================================================

-- 1. Insert 'Sport Orange' as a free shop item (idempotent)
INSERT INTO public.shop_items (name, description, category, price, icon, level_required)
VALUES ('Sport Orange', 'Thème par défaut', 'theme', 0, '🟠', 1)
ON CONFLICT DO NOTHING;

-- 2. Auto-unlock for all existing users who don't already have it
INSERT INTO public.user_inventory (user_id, item_id)
SELECT up.id, si.id
FROM public.user_profiles up
CROSS JOIN public.shop_items si
WHERE si.name = 'Sport Orange'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_inventory ui
    WHERE ui.user_id = up.id AND ui.item_id = si.id
  );

-- 3. Function: auto-unlock default theme on new user creation
CREATE OR REPLACE FUNCTION public.unlock_default_theme()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item_id UUID;
BEGIN
  SELECT id INTO v_item_id
  FROM public.shop_items
  WHERE name = 'Sport Orange'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    INSERT INTO public.user_inventory (user_id, item_id)
    VALUES (NEW.id, v_item_id)
    ON CONFLICT (user_id, item_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Trigger: fires after a user_profiles row is inserted
DROP TRIGGER IF EXISTS trg_unlock_default_theme ON public.user_profiles;
CREATE TRIGGER trg_unlock_default_theme
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.unlock_default_theme();
