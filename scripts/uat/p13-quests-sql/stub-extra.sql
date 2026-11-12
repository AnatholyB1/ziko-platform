-- Complement MINIMAL du stub P12 (colonnes copiees de supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql)
-- pour rejouer 202612011301/1302 sur un Postgres LOCAL jetable. Jamais sur le projet portfolio.
CREATE TABLE public.ziko_hydration_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml integer NOT NULL, date date DEFAULT CURRENT_DATE NOT NULL, created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.ziko_nutrition_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL, meal_type text NOT NULL, food_name text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.ziko_habit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, habit_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE NOT NULL, value integer DEFAULT 1 NOT NULL, created_at timestamptz DEFAULT now() NOT NULL
);
