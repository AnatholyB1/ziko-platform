-- v1.20 Phase 10 (Garde-manger, PANT-06): manual shopping items + checked flag.
-- FILE ONLY: never applied by the phase agent; the orchestrator applies after approval.
--
-- PREREQUISITE: public.ziko_shopping_list_items and the enum public.ziko_shopping_item_source
-- come from supabase/portfolio-migrations/20261108000000_ziko_shopping_list.sql, which declares itself
-- "NOT YET APPLIED". If that table does not exist in the target database, apply that file first,
-- otherwise this one fails.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as a statement that uses the new
-- value; nothing below uses 'manual', so this file is safe in a single migration transaction.

ALTER TYPE public.ziko_shopping_item_source ADD VALUE IF NOT EXISTS 'manual';

-- Why the line is on the list (shown under the name, e.g. "Pour : Poulet cremeux").
ALTER TABLE public.ziko_shopping_list_items ADD COLUMN IF NOT EXISTS reason text;

-- Ticked = ready to be put away into the pantry ("Ranger N article(s)").
ALTER TABLE public.ziko_shopping_list_items ADD COLUMN IF NOT EXISTS checked boolean NOT NULL DEFAULT false;
