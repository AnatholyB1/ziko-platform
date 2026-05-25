-- ============================================================
-- 046 — Coaching Program Seed Templates (Phase 27, Plan 03)
--
-- user_id = NULL for system seed templates (user_id column made
--   nullable in this migration). The FK constraint against auth.users
--   cannot be bypassed via the Supabase MCP apply_migration path, so
--   the sentinel UUID strategy was replaced with NULL user_id.
--   The workout_programs_coach_read RLS policy (migration 045) explicitly
--   allows any authenticated user to read rows where
--   is_template = TRUE AND created_by_coach_id IS NULL — so these seed
--   rows are visible to coaches and athletes. NULL user_id + existing RLS
--   policies prevent modification by regular users, making this approach
--   semantically cleaner than a sentinel UUID.
--
-- Adds:
--   1. ALTER TABLE workout_programs ALTER COLUMN user_id DROP NOT NULL
--   2. workout_programs.goal (TEXT NULL) — program fitness goal label
--   3. workout_programs.weeks_count (INTEGER NULL) — total program duration
--   4. 5 idempotent seed template INSERT statements
--      (ON CONFLICT (id) DO NOTHING — safe to re-run)
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. Make user_id nullable (required for system seed templates)
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.workout_programs ALTER COLUMN user_id DROP NOT NULL;

-- ───────────────────────────────────────────────────────────
-- 2. Add goal + weeks_count columns (not added in 045)
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.workout_programs
  ADD COLUMN IF NOT EXISTS goal         TEXT    NULL,
  ADD COLUMN IF NOT EXISTS weeks_count  INTEGER NULL;

-- ───────────────────────────────────────────────────────────
-- 2. Seed: 5 expert program templates
-- ───────────────────────────────────────────────────────────

-- Template 1 — PPL (Push/Pull/Legs) 6 weeks
INSERT INTO public.workout_programs (
  id,
  user_id,
  name,
  description,
  goal,
  weeks_count,
  days_per_week,
  is_active,
  is_template,
  created_by_coach_id,
  assigned_to_user_id,
  template_source_id,
  weeks_data,
  folder_id,
  start_date
) VALUES (
  'a1000000-0000-0000-0000-000000000001',
  NULL,
  'PPL 6 semaines',
  'Programme Push/Pull/Legs sur 6 jours — idéal pour hypertrophie intermédiaire',
  'Prise de masse',
  6,
  6,
  FALSE,
  TRUE,
  NULL,
  NULL,
  NULL,
  '[
    {
      "week_number": 1,
      "sessions": [
        {
          "session_id": "b1000000-0000-0000-0000-000000000101",
          "session_name": "Push — Poussée",
          "day_of_week": 1,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Développé couché",
              "sets": 4,
              "reps": 8,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Descente contrôlée 2s, poussée explosive"
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé militaire haltères",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Écarté poulie haute",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Extension triceps poulie",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Dips",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": null
            }
          ]
        },
        {
          "session_id": "b1000000-0000-0000-0000-000000000102",
          "session_name": "Pull — Tirage",
          "day_of_week": 3,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Soulevé de terre roumain",
              "sets": 4,
              "reps": 8,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Neutre lombaire, tirage hanches"
            },
            {
              "exercise_id": null,
              "exercise_name": "Traction pronation",
              "sets": 4,
              "reps": 8,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Rowing haltère unilatéral",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.5,
              "target_rir": null,
              "rest_seconds": 75,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Curl biceps barre",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": null
            }
          ]
        },
        {
          "session_id": "b1000000-0000-0000-0000-000000000103",
          "session_name": "Legs — Jambes",
          "day_of_week": 5,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Squat barre",
              "sets": 4,
              "reps": 8,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 150,
              "notes": "Parallèle ou en dessous, dos neutre"
            },
            {
              "exercise_id": null,
              "exercise_name": "Leg press",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": 7.5,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Fentes marchées haltères",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.5,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Leg curl couché",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Mollets debout",
              "sets": 4,
              "reps": 15,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 45,
              "notes": null
            }
          ]
        }
      ]
    }
  ]'::jsonb,
  NULL,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Template 2 — 5/3/1 Wendler 4 weeks
INSERT INTO public.workout_programs (
  id,
  user_id,
  name,
  description,
  goal,
  weeks_count,
  days_per_week,
  is_active,
  is_template,
  created_by_coach_id,
  assigned_to_user_id,
  template_source_id,
  weeks_data,
  folder_id,
  start_date
) VALUES (
  'a1000000-0000-0000-0000-000000000002',
  NULL,
  '5/3/1 Wendler 4 semaines',
  'Programme force basé sur 5/3/1 avec 4 mouvements fondamentaux',
  'Force',
  4,
  4,
  FALSE,
  TRUE,
  NULL,
  NULL,
  NULL,
  '[
    {
      "week_number": 1,
      "sessions": [
        {
          "session_id": "b2000000-0000-0000-0000-000000000201",
          "session_name": "Squat — Semaine 1 (3×5)",
          "day_of_week": 1,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Squat barre",
              "sets": 3,
              "reps": 5,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 180,
              "notes": "65% / 75% / 85% de votre 1RM. Dernière série: AMRAP"
            },
            {
              "exercise_id": null,
              "exercise_name": "Leg press (assistance BBB)",
              "sets": 5,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "50% du 1RM Squat"
            },
            {
              "exercise_id": null,
              "exercise_name": "Leg curl",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 6.5,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": null
            }
          ]
        },
        {
          "session_id": "b2000000-0000-0000-0000-000000000202",
          "session_name": "Développé couché — Semaine 1 (3×5)",
          "day_of_week": 2,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Développé couché",
              "sets": 3,
              "reps": 5,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 180,
              "notes": "65% / 75% / 85% de votre 1RM. Dernière série: AMRAP"
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé couché (assistance BBB)",
              "sets": 5,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "50% du 1RM Développé couché"
            },
            {
              "exercise_id": null,
              "exercise_name": "Rowing barre",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": null
            }
          ]
        },
        {
          "session_id": "b2000000-0000-0000-0000-000000000203",
          "session_name": "Soulevé de terre — Semaine 1 (3×5)",
          "day_of_week": 4,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Soulevé de terre",
              "sets": 3,
              "reps": 5,
              "duration_seconds": null,
              "target_rpe": 9.0,
              "target_rir": null,
              "rest_seconds": 240,
              "notes": "65% / 75% / 85% de votre 1RM. Dernière série: AMRAP"
            },
            {
              "exercise_id": null,
              "exercise_name": "Good morning",
              "sets": 5,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 6.5,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Assistance lombaires"
            },
            {
              "exercise_id": null,
              "exercise_name": "Planche abdominale",
              "sets": 3,
              "reps": null,
              "duration_seconds": 60,
              "target_rpe": null,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": null
            }
          ]
        },
        {
          "session_id": "b2000000-0000-0000-0000-000000000204",
          "session_name": "Développé militaire — Semaine 1 (3×5)",
          "day_of_week": 5,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Développé militaire barre",
              "sets": 3,
              "reps": 5,
              "duration_seconds": null,
              "target_rpe": 8.5,
              "target_rir": null,
              "rest_seconds": 180,
              "notes": "65% / 75% / 85% de votre 1RM. Dernière série: AMRAP"
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé militaire (assistance BBB)",
              "sets": 5,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "50% du 1RM Développé militaire"
            },
            {
              "exercise_id": null,
              "exercise_name": "Traction supination",
              "sets": 3,
              "reps": 8,
              "duration_seconds": null,
              "target_rpe": 7.5,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": null
            }
          ]
        }
      ]
    }
  ]'::jsonb,
  NULL,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Template 3 — Hyrox Prep 8 weeks
INSERT INTO public.workout_programs (
  id,
  user_id,
  name,
  description,
  goal,
  weeks_count,
  days_per_week,
  is_active,
  is_template,
  created_by_coach_id,
  assigned_to_user_id,
  template_source_id,
  weeks_data,
  folder_id,
  start_date
) VALUES (
  'a1000000-0000-0000-0000-000000000003',
  NULL,
  'Hyrox Prep 8 semaines',
  'Préparation compétition Hyrox — endurance fonctionnelle + force',
  'Hyrox',
  8,
  4,
  FALSE,
  TRUE,
  NULL,
  NULL,
  NULL,
  '[
    {
      "week_number": 1,
      "sessions": [
        {
          "session_id": "b3000000-0000-0000-0000-000000000301",
          "session_name": "Run + Ski Erg",
          "day_of_week": 1,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Course à pied",
              "sets": 1,
              "reps": null,
              "duration_seconds": 1200,
              "target_rpe": 6.5,
              "target_rir": null,
              "rest_seconds": null,
              "notes": "Allure modérée Z2 — 20 min continu"
            },
            {
              "exercise_id": null,
              "exercise_name": "Ski Erg",
              "sets": 4,
              "reps": null,
              "duration_seconds": 60,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": "4 × 1 min effort / 1 min repos"
            },
            {
              "exercise_id": null,
              "exercise_name": "Course à pied (retour)",
              "sets": 1,
              "reps": null,
              "duration_seconds": 600,
              "target_rpe": 6.0,
              "target_rir": null,
              "rest_seconds": null,
              "notes": "10 min cool-down allure lente"
            }
          ]
        },
        {
          "session_id": "b3000000-0000-0000-0000-000000000302",
          "session_name": "Sled Push + Force",
          "day_of_week": 3,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Sled Push",
              "sets": 6,
              "reps": null,
              "duration_seconds": 30,
              "target_rpe": 9.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Charge modérée — 6 × 20m sprint"
            },
            {
              "exercise_id": null,
              "exercise_name": "Squat barre",
              "sets": 4,
              "reps": 6,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Force de poussée — 75-80% 1RM"
            },
            {
              "exercise_id": null,
              "exercise_name": "Step-ups haltères",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.5,
              "target_rir": null,
              "rest_seconds": 75,
              "notes": "Chaque jambe — hauteur boîte 50 cm"
            }
          ]
        },
        {
          "session_id": "b3000000-0000-0000-0000-000000000303",
          "session_name": "Wall Balls + Burpee Broad Jump",
          "day_of_week": 5,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Wall Balls",
              "sets": 5,
              "reps": 15,
              "duration_seconds": null,
              "target_rpe": 8.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": "Balle 6 kg (F) / 9 kg (H) — cible 3m"
            },
            {
              "exercise_id": null,
              "exercise_name": "Burpee Broad Jump",
              "sets": 4,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 8.5,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Saut maximal vers l'avant à chaque rep"
            },
            {
              "exercise_id": null,
              "exercise_name": "Farmer's Walk",
              "sets": 4,
              "reps": null,
              "duration_seconds": 30,
              "target_rpe": 7.5,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": "Haltères 20kg/main — 4 × 30m"
            }
          ]
        },
        {
          "session_id": "b3000000-0000-0000-0000-000000000304",
          "session_name": "Long Run Endurance",
          "day_of_week": 6,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Course longue distance",
              "sets": 1,
              "reps": null,
              "duration_seconds": 2700,
              "target_rpe": 6.0,
              "target_rir": null,
              "rest_seconds": null,
              "notes": "45 min allure Z2 confortable — construction base aérobie"
            }
          ]
        }
      ]
    }
  ]'::jsonb,
  NULL,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Template 4 — Body Recomp 12 weeks
INSERT INTO public.workout_programs (
  id,
  user_id,
  name,
  description,
  goal,
  weeks_count,
  days_per_week,
  is_active,
  is_template,
  created_by_coach_id,
  assigned_to_user_id,
  template_source_id,
  weeks_data,
  folder_id,
  start_date
) VALUES (
  'a1000000-0000-0000-0000-000000000004',
  NULL,
  'Body Recomp 12 semaines',
  'Recomposition corporelle — perte de gras + maintien musculaire',
  'Reconditionnement',
  12,
  3,
  FALSE,
  TRUE,
  NULL,
  NULL,
  NULL,
  '[
    {
      "week_number": 1,
      "sessions": [
        {
          "session_id": "b4000000-0000-0000-0000-000000000401",
          "session_name": "Full Body A",
          "day_of_week": 1,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Squat gobelet",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 75,
              "notes": "Kettlebell ou haltère — genoux dans l'axe des orteils"
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé haltères incliné",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 75,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Rowing haltère",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 75,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé militaire haltères",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 60,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Gainage latéral",
              "sets": 3,
              "reps": null,
              "duration_seconds": 30,
              "target_rpe": null,
              "target_rir": null,
              "rest_seconds": 30,
              "notes": "Chaque côté"
            }
          ]
        },
        {
          "session_id": "b4000000-0000-0000-0000-000000000402",
          "session_name": "Full Body B",
          "day_of_week": 3,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Soulevé de terre roumain haltères",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 90,
              "notes": "Neutre lombaire — tension ischio-jambiers"
            },
            {
              "exercise_id": null,
              "exercise_name": "Pompes",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 60,
              "notes": "Genoux si besoin"
            },
            {
              "exercise_id": null,
              "exercise_name": "Traction assistée",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 90,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Fentes inversées haltères",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 75,
              "notes": "Chaque jambe"
            },
            {
              "exercise_id": null,
              "exercise_name": "Mountain climbers",
              "sets": 3,
              "reps": null,
              "duration_seconds": 30,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 45,
              "notes": null
            }
          ]
        },
        {
          "session_id": "b4000000-0000-0000-0000-000000000403",
          "session_name": "Full Body C",
          "day_of_week": 5,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Hip thrust",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 75,
              "notes": "Barre ou haltère sur hanches"
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé couché haltères",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 75,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Tirage horizontal poulie",
              "sets": 3,
              "reps": 12,
              "duration_seconds": null,
              "target_rpe": null,
              "target_rir": 2,
              "rest_seconds": 75,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Élévations latérales",
              "sets": 3,
              "reps": 15,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 45,
              "notes": null
            },
            {
              "exercise_id": null,
              "exercise_name": "Crunch bicyclette",
              "sets": 3,
              "reps": 20,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 45,
              "notes": "Contrôle, pas d'élan"
            }
          ]
        }
      ]
    }
  ]'::jsonb,
  NULL,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Template 5 — Débutant Full Body 8 weeks
INSERT INTO public.workout_programs (
  id,
  user_id,
  name,
  description,
  goal,
  weeks_count,
  days_per_week,
  is_active,
  is_template,
  created_by_coach_id,
  assigned_to_user_id,
  template_source_id,
  weeks_data,
  folder_id,
  start_date
) VALUES (
  'a1000000-0000-0000-0000-000000000005',
  NULL,
  'Débutant Full Body 8 semaines',
  'Programme pour débutants — 3 jours/semaine, mouvements fondamentaux',
  'Reconditionnement',
  8,
  3,
  FALSE,
  TRUE,
  NULL,
  NULL,
  NULL,
  '[
    {
      "week_number": 1,
      "sessions": [
        {
          "session_id": "b5000000-0000-0000-0000-000000000501",
          "session_name": "Full Body A — Initiation",
          "day_of_week": 1,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Squat poids de corps",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Pieds largeur épaules, regard devant, descendre jusqu'à parallèle"
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé haltères à plat",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Coudes à 45°, contrôle sur la descente"
            },
            {
              "exercise_id": null,
              "exercise_name": "Rowing haltère appuyé",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Main libre sur le banc, tirer le coude vers la hanche"
            },
            {
              "exercise_id": null,
              "exercise_name": "Développé militaire haltères assis",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Dos droit, pousser droit vers le haut"
            },
            {
              "exercise_id": null,
              "exercise_name": "Gainage frontal",
              "sets": 3,
              "reps": null,
              "duration_seconds": 30,
              "target_rpe": 6.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": "Corps aligné, ventre rentré, respirer normalement"
            }
          ]
        },
        {
          "session_id": "b5000000-0000-0000-0000-000000000502",
          "session_name": "Full Body B — Initiation",
          "day_of_week": 3,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Soulevé de terre haltères",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Dos plat, hanches basses au départ, pousser le sol pour monter"
            },
            {
              "exercise_id": null,
              "exercise_name": "Pompes genoux",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Corps droit des genoux aux épaules, descendre la poitrine vers le sol"
            },
            {
              "exercise_id": null,
              "exercise_name": "Tirage poulie haute",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Prise large, tirer vers la clavicule, coudes vers les hanches"
            },
            {
              "exercise_id": null,
              "exercise_name": "Fentes statiques",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Chaque jambe — genou avant à 90°, genou arrière proche du sol"
            },
            {
              "exercise_id": null,
              "exercise_name": "Superman",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 6.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": "Lever bras et jambes en même temps, tenir 2s en haut"
            }
          ]
        },
        {
          "session_id": "b5000000-0000-0000-0000-000000000503",
          "session_name": "Full Body C — Initiation",
          "day_of_week": 5,
          "exercises": [
            {
              "exercise_id": null,
              "exercise_name": "Leg press pieds hauts",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 120,
              "notes": "Charge légère, amplitude complète, ne jamais verrouiller les genoux"
            },
            {
              "exercise_id": null,
              "exercise_name": "Écarté haltères à plat",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Légère flexion des coudes, arc de cercle contrôlé"
            },
            {
              "exercise_id": null,
              "exercise_name": "Tirage horizontal poulie basse",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 7.0,
              "target_rir": null,
              "rest_seconds": 90,
              "notes": "Dos droit, tirer les coudes derrière soi, serrer les omoplates"
            },
            {
              "exercise_id": null,
              "exercise_name": "Élévations latérales haltères",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 6.5,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": "Légère flexion coude, monter jusqu'aux épaules uniquement"
            },
            {
              "exercise_id": null,
              "exercise_name": "Crunch",
              "sets": 3,
              "reps": 10,
              "duration_seconds": null,
              "target_rpe": 6.0,
              "target_rir": null,
              "rest_seconds": 60,
              "notes": "Mains sur les tempes, expirer en montant, contrôle total"
            }
          ]
        }
      ]
    }
  ]'::jsonb,
  NULL,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- End of migration 046.
