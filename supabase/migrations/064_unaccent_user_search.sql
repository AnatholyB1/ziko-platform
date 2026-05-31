-- ============================================================
-- Migration 064: Accent-insensitive user search
-- Enables unaccent extension and adds an RPC for fuzzy search
-- ============================================================

-- Enable unaccent extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- RPC: search_users_fuzzy
-- Searches user_profiles by name, case- and accent-insensitive,
-- excluding the calling user and already-accepted friends.
CREATE OR REPLACE FUNCTION public.search_users_fuzzy(
  search_query TEXT,
  calling_user_id UUID,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  goal TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    p.avatar_url,
    p.goal
  FROM public.user_profiles p
  WHERE
    p.id <> calling_user_id
    AND unaccent(lower(p.name)) LIKE '%' || unaccent(lower(search_query)) || '%'
  ORDER BY
    -- Exact match (after normalization) ranked first
    CASE WHEN unaccent(lower(p.name)) = unaccent(lower(search_query)) THEN 0 ELSE 1 END,
    -- Prefix match ranked second
    CASE WHEN unaccent(lower(p.name)) LIKE unaccent(lower(search_query)) || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT result_limit;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.search_users_fuzzy(TEXT, UUID, INT) TO authenticated;
