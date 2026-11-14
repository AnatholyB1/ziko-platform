-- Phase 18 (STRE-01/02, G-01) : bibliotheque d'exercices de stretching.
-- Catalogue = lignes user_id IS NULL (seed ci-dessous, lecture seule pour les clients) ;
-- exercices perso = user_id = auth.uid() (CRUD par leur proprietaire).

CREATE TABLE public.ziko_stretching_exercises (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  muscle_group     text NOT NULL CHECK (muscle_group IN ('back', 'legs', 'shoulders', 'hips')),
  measure          text NOT NULL DEFAULT 'duration' CHECK (measure IN ('duration', 'reps')),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 5 AND 600),
  reps             integer CHECK (reps IS NULL OR reps BETWEEN 1 AND 100),
  sides            smallint NOT NULL DEFAULT 1 CHECK (sides IN (1, 2)),
  instructions     text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_stretching_exercises_measure_value CHECK (
    (measure = 'duration' AND duration_seconds IS NOT NULL)
    OR (measure = 'reps' AND reps IS NOT NULL)
  )
);

CREATE INDEX ziko_idx_stretching_exercises_user ON public.ziko_stretching_exercises (user_id);
-- Seed idempotent : un nom de catalogue est unique.
CREATE UNIQUE INDEX ziko_uq_stretching_exercises_catalog_name
  ON public.ziko_stretching_exercises (name) WHERE user_id IS NULL;

ALTER TABLE public.ziko_stretching_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ziko_stretching_exercises_select" ON public.ziko_stretching_exercises
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR (SELECT auth.uid()) = user_id);

-- Ecriture client : uniquement ses propres lignes (user_id NULL = catalogue, jamais inscriptible).
CREATE POLICY "ziko_stretching_exercises_insert_own" ON public.ziko_stretching_exercises
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "ziko_stretching_exercises_update_own" ON public.ziko_stretching_exercises
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "ziko_stretching_exercises_delete_own" ON public.ziko_stretching_exercises
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Privileges : rien pour anon ; pas de privilege de structure pour les autres roles.
REVOKE ALL ON TABLE public.ziko_stretching_exercises FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_stretching_exercises FROM authenticated, service_role;

COMMENT ON TABLE public.ziko_stretching_exercises IS
  'Exercices de stretching : catalogue (user_id NULL, lecture seule) + exercices perso (user_id = auth.uid()).';

-- Catalogue (24 exercices, 6 par zone). Zones : back, legs, shoulders, hips.
INSERT INTO public.ziko_stretching_exercises (user_id, name, muscle_group, measure, duration_seconds, reps, sides, instructions) VALUES
  (NULL, 'Posture de l''enfant',           'back',      'duration', 45,   NULL, 1, 'À genoux, fesses sur les talons, bras tendus devant toi. Relâche le dos et respire profondément.'),
  (NULL, 'Chat-vache',                     'back',      'reps',     NULL, 10,   1, 'À quatre pattes, alterne dos rond et dos creux en suivant ta respiration.'),
  (NULL, 'Rotation du tronc allongé',      'back',      'duration', 30,   NULL, 2, 'Allongé, genou fléchi ramené de l''autre côté, épaules au sol.'),
  (NULL, 'Cobra',                          'back',      'duration', 30,   NULL, 1, 'Allongé sur le ventre, pousse sur les mains pour ouvrir la poitrine sans cambrer à l''excès.'),
  (NULL, 'Étirement du grand dorsal',      'back',      'duration', 30,   NULL, 2, 'Mains sur un support à hauteur de hanches, recule les fesses et creuse le dos.'),
  (NULL, 'Enroulement vertébral debout',   'back',      'reps',     NULL, 8,    1, 'Debout, enroule la colonne vertèbre par vertèbre vers le sol puis remonte lentement.'),
  (NULL, 'Ischio-jambiers allongé',        'legs',      'duration', 45,   NULL, 2, 'Allongé sur le dos, jambe tendue tirée vers toi avec une sangle ou les mains.'),
  (NULL, 'Quadriceps debout',              'legs',      'duration', 30,   NULL, 2, 'Debout, talon vers la fesse, genoux joints, bassin sous le buste.'),
  (NULL, 'Mollets contre le mur',          'legs',      'duration', 30,   NULL, 2, 'Mains au mur, jambe arrière tendue, talon au sol.'),
  (NULL, 'Fente basse des adducteurs',     'legs',      'duration', 30,   NULL, 2, 'Grande fente latérale, jambe tendue, buste droit.'),
  (NULL, 'Flexion avant jambes tendues',   'legs',      'duration', 40,   NULL, 1, 'Debout, penche-toi en avant, genoux légèrement fléchis, nuque relâchée.'),
  (NULL, 'Papillon assis',                 'legs',      'duration', 40,   NULL, 1, 'Assis, plantes de pieds jointes, genoux vers le sol, dos long.'),
  (NULL, 'Cercles d''épaules',             'shoulders', 'reps',     NULL, 12,   1, 'Debout, trace de grands cercles avec les épaules, vers l''arrière puis vers l''avant.'),
  (NULL, 'Bras croisé devant la poitrine', 'shoulders', 'duration', 30,   NULL, 2, 'Ramène un bras tendu en travers de la poitrine avec l''autre main.'),
  (NULL, 'Étirement du triceps',           'shoulders', 'duration', 30,   NULL, 2, 'Coude levé derrière la tête, l''autre main pousse doucement dessus.'),
  (NULL, 'Ouverture de la poitrine au mur','shoulders', 'duration', 30,   NULL, 2, 'Avant-bras contre un mur, tourne le buste à l''opposé.'),
  (NULL, 'Fil dans l''aiguille',           'shoulders', 'duration', 30,   NULL, 2, 'À quatre pattes, glisse un bras sous le buste, épaule et tempe au sol.'),
  (NULL, 'Rotations de nuque',             'shoulders', 'reps',     NULL, 8,    2, 'Assis droit, incline puis tourne la tête doucement, sans forcer.'),
  (NULL, 'Fente du psoas',                 'hips',      'duration', 30,   NULL, 2, 'Genou au sol, bassin poussé vers l''avant, buste redressé.'),
  (NULL, 'Pigeon',                         'hips',      'duration', 40,   NULL, 2, 'Tibia replié devant toi, jambe arrière tendue, buste vers l''avant.'),
  (NULL, 'Pigeon sur le dos',              'hips',      'duration', 40,   NULL, 2, 'Allongé, cheville sur le genou opposé, tire la cuisse vers toi.'),
  (NULL, 'Accroupi profond',               'hips',      'duration', 45,   NULL, 1, 'Accroupi, talons au sol, coudes poussent les genoux vers l''extérieur.'),
  (NULL, 'Fessiers allongé',               'hips',      'duration', 30,   NULL, 2, 'Allongé, ramène un genou vers l''épaule opposée.'),
  (NULL, 'Cercles de hanches',             'hips',      'reps',     NULL, 10,   2, 'À quatre pattes, genou levé, trace de grands cercles avec la hanche.')
ON CONFLICT DO NOTHING;
