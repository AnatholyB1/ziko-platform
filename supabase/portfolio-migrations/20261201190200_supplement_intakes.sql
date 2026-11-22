-- Phase 19 (SUPP-04/05) : prises quotidiennes cochees dans l'onglet "Aujourd'hui".
-- Remplace le stockage local AsyncStorage (non multi-appareil). `date` = jour LOCAL de l'athlete (AAAA-MM-JJ).

CREATE TABLE public.ziko_supplement_intakes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES public.ziko_supplements(id) ON DELETE CASCADE,
  moment        text NOT NULL CHECK (moment IN ('morning', 'noon', 'evening')),
  date          date NOT NULL,
  taken_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplement_id, moment, date)
);

CREATE INDEX ziko_idx_supplement_intakes_user_date ON public.ziko_supplement_intakes (user_id, date);

ALTER TABLE public.ziko_supplement_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ziko_supplement_intakes_own" ON public.ziko_supplement_intakes
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.ziko_supplement_intakes FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_intakes FROM authenticated, service_role;

COMMENT ON TABLE public.ziko_supplement_intakes IS
  'Prise cochee d''un complement du stack, pour un moment et un jour local donnes.';
