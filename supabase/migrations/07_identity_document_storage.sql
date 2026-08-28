-- Create private storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-documents',
  'identity-documents',
  false, -- private bucket
  5242880, -- 5 MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on storage.objects if they exist to avoid conflict on migration re-runs
DROP POLICY IF EXISTS "Allow users to upload own identity documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow owners and staff to read identity documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own identity documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own identity documents" ON storage.objects;

-- Policy 1: Allow users to upload (insert) files to their own folder only
CREATE POLICY "Allow users to upload own identity documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'identity-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow users to select (read) files from their own folder only, and allow staff/admins to view them
CREATE POLICY "Allow owners and staff to read identity documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'identity-documents' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
    )
  )
);

-- Policy 3: Allow users to delete their own files (required for document replacement)
CREATE POLICY "Allow users to delete own identity documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'identity-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow users to update their own files
CREATE POLICY "Allow users to update own identity documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'identity-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
