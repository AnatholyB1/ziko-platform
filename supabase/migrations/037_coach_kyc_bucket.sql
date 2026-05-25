-- 037 — coach-kyc private Storage bucket + RLS policies (Phase 24)
-- Provisioned via SQL migration — same pattern as migrations 017 and 025.
-- Bucket is private (public: false). Only owning coach can read/write their own {user_id}/ prefix.
-- Future admin moderation uses service-role in Phase 31+ back-office (D-11).

SET LOCAL lock_timeout = '5s';

INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-kyc', 'coach-kyc', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "coach_kyc_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_kyc_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'coach-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_kyc_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coach-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
