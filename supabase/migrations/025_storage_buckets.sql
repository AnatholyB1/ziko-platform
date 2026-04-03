-- ═══════════════════════════════════════════════════════════
-- 025 — Storage Buckets: profile-photos, scan-photos, exports
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- profile-photos: private writes, public reads (D-01, D-06)
-- ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "profile_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profile-photos');

-- ─────────────────────────────────────────────────────────
-- scan-photos: private, owner-only INSERT/SELECT/DELETE (D-02, D-07)
-- ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('scan-photos', 'scan-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "scan_photos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scan-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "scan_photos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'scan-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "scan_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'scan-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────
-- exports: private, owner-only SELECT (D-03, D-08)
-- No INSERT policy — server-side only (Phase 15)
-- ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "exports_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
