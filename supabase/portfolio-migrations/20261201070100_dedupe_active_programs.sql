-- P7 (TRAIN-07) : un seul programme actif par athlete, toutes tables confondues.
-- Etape 1/4 : nettoyage des doublons existants AVANT les index uniques (0702).
-- Idempotent : si aucun doublon, ne modifie rien. Garde le programme actif le plus recemment
-- cree/modifie par athlete (entre ziko_workout_programs et ziko_ai_generated_programs).

WITH owners AS (
  SELECT COALESCE(assigned_to_user_id, user_id) AS uid, 'w'::text AS kind, id, updated_at AS ts
  FROM public.ziko_workout_programs
  WHERE is_active AND NOT is_template AND COALESCE(assigned_to_user_id, user_id) IS NOT NULL
  UNION ALL
  SELECT user_id, 'a'::text, id, created_at
  FROM public.ziko_ai_generated_programs
  WHERE is_active
), ranked AS (
  SELECT kind, id, row_number() OVER (PARTITION BY uid ORDER BY ts DESC, id) AS rn FROM owners
)
UPDATE public.ziko_workout_programs p
SET is_active = false
FROM ranked r
WHERE r.kind = 'w' AND r.id = p.id AND r.rn > 1;

WITH owners AS (
  SELECT COALESCE(assigned_to_user_id, user_id) AS uid, 'w'::text AS kind, id, updated_at AS ts
  FROM public.ziko_workout_programs
  WHERE is_active AND NOT is_template AND COALESCE(assigned_to_user_id, user_id) IS NOT NULL
  UNION ALL
  SELECT user_id, 'a'::text, id, created_at
  FROM public.ziko_ai_generated_programs
  WHERE is_active
), ranked AS (
  SELECT kind, id, row_number() OVER (PARTITION BY uid ORDER BY ts DESC, id) AS rn FROM owners
)
UPDATE public.ziko_ai_generated_programs p
SET is_active = false
FROM ranked r
WHERE r.kind = 'a' AND r.id = p.id AND r.rn > 1;
