-- Post-apply verification suite for the ziko -> portfolio schema rename (SCHEMA-03 / SCHEMA-04).
--
-- This file is a TEMPLATE. It is never run verbatim: 03-run-verify.mjs substitutes the two
-- placeholders below from rename-map.generated.json at runtime, then executes each
-- "-- QUERY: <name>" block against the target project (scratch or portfolio).
--
--   __TABLE_ALTERNATION__    -> every OLD (unprefixed) table name in rename-map.tables, '|'-joined
--   __FUNCTION_ALTERNATION__ -> every OLD (unprefixed) function name in rename-map.functions, '|'-joined
--   __EXPECTED_TABLE_COUNT__ -> number of entries in rename-map.tables
--
-- Regex word boundary \y treats '_' as a word character, so 'ziko_user_profiles' does NOT match
-- 'user_profiles' -- only a genuine bare, unprefixed reference does.
--
-- Every query is read-only (SELECT only). Expected result per query is noted below.

-- QUERY: stale_policy_refs
-- Expect 0 rows: no RLS policy on a ziko_* table references an unprefixed table or function name.
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'ziko_%'
  AND (
    qual ~* '\y(__TABLE_ALTERNATION__|__FUNCTION_ALTERNATION__)\y'
    OR with_check ~* '\y(__TABLE_ALTERNATION__|__FUNCTION_ALTERNATION__)\y'
  );

-- QUERY: stale_function_refs
-- Expect 0 rows: no ziko_* function body references an unprefixed table or function name.
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'ziko_%'
  AND p.prosrc ~* '\y(__TABLE_ALTERNATION__|__FUNCTION_ALTERNATION__)\y';

-- QUERY: stale_trigger_refs
-- Expect 0 rows: no non-internal trigger on a ziko_* table has a definition (including its
-- WHEN clause / EXECUTE FUNCTION target) that references an unprefixed name.
SELECT c.relname AS tablename, t.tgname, pg_get_triggerdef(t.oid) AS triggerdef
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname LIKE 'ziko_%'
  AND NOT t.tgisinternal
  AND pg_get_triggerdef(t.oid) ~* '\y(__TABLE_ALTERNATION__|__FUNCTION_ALTERNATION__)\y';

-- QUERY: rls_not_enabled
-- Expect 0 rows: RLS is enabled on every ziko_* table.
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind IN ('r', 'p')
  AND relname LIKE 'ziko_%'
  AND relrowsecurity IS NOT TRUE;

-- QUERY: table_count
-- Expect exactly __EXPECTED_TABLE_COUNT__ (the size of the rename map).
SELECT count(*)::int AS table_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'ziko_%';
