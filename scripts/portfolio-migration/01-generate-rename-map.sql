-- ============================================================================
-- 01-generate-rename-map.sql
--
-- Read-only introspection queries against ziko's LIVE schema
-- (project ref slkobhavpwsubnsmuhya). This file contains SELECT statements
-- only — no DROP/ALTER/CREATE/INSERT/UPDATE/DELETE statement appears
-- anywhere below. It is safe to run against a live production database.
--
-- Consumed by 01-generate-rename-map.mjs, which parses this file for the
-- three named query blocks below (delimited by "-- QUERY: <name>" marker
-- comments) and runs each one live via the Supabase MCP execute_sql tool
-- (preferred) or the Supabase CLI (`supabase db query --linked
-- --project-ref <ref> "<SQL>"`, fallback) against ziko. The rename map is
-- built from LIVE state, never from parsing supabase/migrations/*.sql —
-- see 02-RESEARCH.md Pattern 1 / Pitfall 5: migration files can reference
-- objects (e.g. shopping_list_items / shopping_item_source, dropped from
-- live ziko at some point outside a tracked migration) that no longer
-- exist live and must not be resurrected by this map.
-- ============================================================================

-- QUERY: tables
-- All tables in the public schema, live.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- QUERY: functions
-- ziko-authored functions only — excludes extension-owned pg_proc rows via
-- the pg_depend deptype = 'e' filter. This exclusion is load-bearing: it
-- removes the 4 unaccent / unaccent(regdictionary,text) / unaccent_init /
-- unaccent_lexize rows (auto-created by CREATE EXTENSION unaccent, owned by
-- the extension) from ziko's raw 37-function list, leaving exactly the 33
-- ziko-authored functions that are actually safe to CREATE FUNCTION OR
-- REPLACE under a new ziko_-prefixed name. Renaming an extension-owned
-- function would break CREATE EXTENSION unaccent's internal wiring — see
-- this plan's threat_model, T-2-02.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
  )
ORDER BY p.proname;

-- QUERY: types
-- Genuine custom enum/composite types in the public schema — same
-- extension-exclusion logic as functions above, PLUS an exclusion of
-- automatic table row types.
--
-- Correctness note (found live during Plan 01 execution, not present in
-- the plan's originally drafted query text): Postgres implicitly creates a
-- pg_type row with typtype = 'c' (composite) for every ordinary table's row
-- type. A naive "typtype IN ('e','c')" filter (matching only extension
-- ownership) therefore returns one bogus "type" entry per table — 99 rows
-- for ziko, none of them a real standalone type. A genuine standalone
-- composite type's typrelid points to a pg_class row with relkind = 'c';
-- an ordinary table's implicit row type points to relkind = 'r'. The
-- "c.relkind IS DISTINCT FROM 'r'" clause below excludes exactly those
-- automatic table row types while still matching real enums (typrelid = 0,
-- so the LEFT JOIN produces a NULL relkind, which also satisfies
-- "IS DISTINCT FROM 'r'") and any genuine standalone composite type.
-- Verified live this session: ziko's public schema currently has zero
-- genuine custom types (0 rows) — consistent with Pitfall 5, since the
-- historical shopping_item_source enum was dropped from live ziko and
-- must not be resurrected by this map.
SELECT t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_class c ON c.oid = t.typrelid
WHERE n.nspname = 'public'
  AND t.typtype IN ('e', 'c')
  AND (c.relkind IS DISTINCT FROM 'r' OR t.typrelid = 0)
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e'
  )
ORDER BY t.typname;
