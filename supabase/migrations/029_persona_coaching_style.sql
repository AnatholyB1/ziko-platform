-- Add coaching_style column to persona_settings
-- Fixes: "Could not find the 'coaching_style' column" error on save

ALTER TABLE public.persona_settings
  ADD COLUMN IF NOT EXISTS coaching_style TEXT NOT NULL DEFAULT 'motivational'
    CHECK (coaching_style IN ('motivational', 'analytical', 'friendly', 'strict'));
