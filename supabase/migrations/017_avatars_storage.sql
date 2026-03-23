-- ═══════════════════════════════════════════════════════════
-- 017 — Avatars Storage Bucket
-- ═══════════════════════════════════════════════════════════

-- Create public bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "avatar_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update (upsert) their own avatar
CREATE POLICY "avatar_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to all avatars
CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');
