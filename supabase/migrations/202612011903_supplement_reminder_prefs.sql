-- Phase 19 (SUPP-07, D-06) : rappels par creneau Matin/Midi/Soir (un interrupteur + une heure par creneau).
-- Pas de seed : le client cree les lignes par defaut (08:00 / 13:00 / 21:30) a la premiere ouverture.

CREATE TABLE public.ziko_supplement_reminder_prefs (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moment      text NOT NULL CHECK (moment IN ('morning', 'noon', 'evening')),
  enabled     boolean NOT NULL DEFAULT false,
  remind_time time NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, moment)
);

ALTER TABLE public.ziko_supplement_reminder_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ziko_supplement_reminder_prefs_own" ON public.ziko_supplement_reminder_prefs
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.ziko_supplement_reminder_prefs FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_reminder_prefs FROM authenticated, service_role;

COMMENT ON TABLE public.ziko_supplement_reminder_prefs IS
  'Preference de rappel local par creneau (heure + actif). Les notifications sont locales a l''appareil (expo-notifications).';
