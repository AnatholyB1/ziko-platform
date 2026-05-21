-- Phase 28: wire credit_transaction_id FK left as comment in migration 036
-- Migration 036 (line 71) declared:
--   credit_transaction_id UUID NULL, -- FK wired in Phase 28 to ai_credit_transactions(id)
-- The ai_credit_transactions table was created in migration 026.
-- ON DELETE SET NULL preserves the import record if a transaction is ever purged.

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.ai_imports
  ADD CONSTRAINT fk_ai_imports_credit_transaction
    FOREIGN KEY (credit_transaction_id)
    REFERENCES public.ai_credit_transactions(id)
    ON DELETE SET NULL;
