-- Phase 28: create private ai-imports storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-imports',
  'ai-imports',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ai_imports_owner_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'ai-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ai_imports_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ai-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ai_imports_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'ai-imports' AND auth.uid()::text = (storage.foldername(name))[1]);
