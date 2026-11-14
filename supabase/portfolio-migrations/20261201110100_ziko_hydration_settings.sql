-- P11 (v1.20) : reglages d'hydratation persistes (HYDR-02..05). Fichier seul, non applique.
CREATE TABLE IF NOT EXISTS public.ziko_hydration_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reminders_enabled boolean NOT NULL DEFAULT false,
  reminder_interval_min integer NOT NULL DEFAULT 90 CHECK (reminder_interval_min IN (60, 90, 120, 180)),
  reminder_start_min integer NOT NULL DEFAULT 480 CHECK (reminder_start_min BETWEEN 0 AND 1410 AND reminder_start_min % 30 = 0),
  reminder_end_min integer NOT NULL DEFAULT 1260 CHECK (reminder_end_min BETWEEN 0 AND 1410 AND reminder_end_min % 30 = 0),
  glass_ml integer NOT NULL DEFAULT 250 CHECK (glass_ml IN (150, 200, 250, 300, 330, 500)),
  count_coffee_tea boolean NOT NULL DEFAULT true,
  coffee_tea_pct integer NOT NULL DEFAULT 50 CHECK (coffee_tea_pct IN (25, 50, 75, 100)),
  workout_bonus_ml integer NOT NULL DEFAULT 500 CHECK (workout_bonus_ml BETWEEN 0 AND 1500 AND workout_bonus_ml % 100 = 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_hydration_settings_range_check CHECK (reminder_end_min >= reminder_start_min)
);

ALTER TABLE public.ziko_hydration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ziko_hydration_settings_own" ON public.ziko_hydration_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
