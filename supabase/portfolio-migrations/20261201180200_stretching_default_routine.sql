-- Phase 18 (STRE-05/06, ST-3) : une seule routine de stretching par defaut par athlete ;
-- les logs referencent la routine lancee (le code ecrivait deja routine_id sans colonne).

ALTER TABLE public.ziko_stretching_routines
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Garantit au plus 1 routine par defaut par athlete.
CREATE UNIQUE INDEX IF NOT EXISTS ziko_uq_stretching_routines_one_default
  ON public.ziko_stretching_routines (user_id) WHERE is_default;

ALTER TABLE public.ziko_stretching_logs
  ADD COLUMN IF NOT EXISTS routine_id text;
