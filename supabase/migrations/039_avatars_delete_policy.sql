-- ═══════════════════════════════════════════════════════════
-- 039 — Fix avatars storage policies (delete + update WITH CHECK)
-- ═══════════════════════════════════════════════════════════

-- Allow authenticated users to delete their own avatar (required for upsert replace)
CREATE POLICY "avatar_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Rebuild UPDATE policy with WITH CHECK (was missing)
DROP POLICY IF EXISTS "avatar_update" ON storage.objects;
CREATE POLICY "avatar_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
