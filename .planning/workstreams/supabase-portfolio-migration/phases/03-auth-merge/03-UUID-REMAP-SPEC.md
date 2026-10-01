# UUID Remap Spec for the Collision User (D-02)

Status: Specification only. Executed in Phase 4; nothing in Phase 3 runs it.

## 1. Input

`scripts/auth-merge/uuid-remap.json`, written by Plan 11's real import:

```
{ generated_at, source_ref, target_ref,
  remaps: [{ source_user_id, target_user_id, password_filled, identity_inserted }] }
```

Phase 4 must read this file and never hardcode the target UUID. The source (ziko) UUID is `ea0f0b65-6681-4780-8ee0-dbf20b95d4d9`; the target is the portfolio UUID recorded in uuid-remap.json (`2b6a60fa-f37a-45a8-bf3f-e6b6681917e5` per RESEARCH).

## 2. Why the remap is in-flight

The ziko UUID does not exist in portfolio `auth.users`, so any `ziko_*` row carrying it violates the FK to `auth.users(id)`. The remap must be applied while transforming rows before load (staging table or COPY transform), not after.

## 3. FK-discovered columns

Run at Phase 4 time; do not rely on a static list:

```sql
SELECT c.conrelid::regclass AS tbl, a.attname AS col
FROM pg_constraint c
JOIN LATERAL unnest(c.conkey) AS k(attnum) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND c.conrelid::regclass::text LIKE 'public.ziko\_%'
ORDER BY 1, 2;
```

Illustrations only (from RESEARCH), not the list: `ziko_user_profiles.id`, `ziko_coach_client_links.client_id` / `coach_id`, `ziko_coach_invitations.coach_id` / `used_by`, `ziko_ai_tool_audit.coach_id` / `target_client_id`, `ziko_friendships.requester_id` / `addressee_id`, `ziko_workout_programs.user_id` / `assigned_to_user_id` / `created_by_coach_id`.

## 4. Non-FK columns to remap or inspect

- `ziko_exercises_merge_backup.user_id` (no FK).
- Polymorphic `ziko_coin_transactions.source_id` and `ziko_xp_transactions.source_id`: remap only rows whose value equals the source UUID.
- Free-form text/JSONB: `ziko_ai_messages`, `ziko_athlete_decisions` evidence/outcome, `ziko_coach_*` JSONB columns, notification payloads. Replace UUID string occurrences.

## 5. Uniqueness pre-check

Before load, confirm the portfolio target UUID has zero rows in every `ziko_*` table, so single-row-per-user tables (`ziko_user_profiles`, `ziko_user_ai_credits`) cannot conflict.

## 6. Verification (mandatory, scripted)

After load:
- The count of occurrences of the source UUID as text across every uuid/text/jsonb column of every `ziko_*` table on portfolio is 0.
- Per table, rows referencing the target UUID on portfolio equal rows referencing the source UUID on ziko.

## 7. Forbidden operations

- Never `UPDATE auth.users SET id = ...`.
- Never delete and reinsert the portfolio user: `ON DELETE CASCADE` would wipe its `rh_users` / `gecko_admins` rows.

## 8. Phase 5 note

Storage objects of the collision user under folder `<source uuid>/` in ziko buckets must be re-keyed to `<target uuid>/`, because storage RLS matches `(storage.foldername(name))[1] = auth.uid()::text`.
