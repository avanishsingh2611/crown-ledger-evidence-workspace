-- ==============================================================================
-- CROWN & LEDGER — EVIDENCE WORKSPACE
-- Supabase Storage Configuration & Access Control Policies
-- Migration ID: 20260911000002_storage_setup.sql
-- ==============================================================================

-- 1. Create the private evidence-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-documents',
  'evidence-documents',
  false, -- STRICTLY PRIVATE: No public URL generation
  104857600, -- 100 MB limit per legal file
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/tiff',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/tiff',
    'image/png',
    'image/jpeg'
  ];

-- 2. Storage RLS Policies for evidence-documents bucket

-- Enable RLS on storage.objects (standard in Supabase)
-- SELECT Policy: Users can read files in evidence-documents if they have access to the matter
DROP POLICY IF EXISTS "Authorized users read evidence files" ON storage.objects;
CREATE POLICY "Authorized users read evidence files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'evidence-documents'
    AND (
      public.is_workspace_admin(auth.uid())
      OR EXISTS (
        -- Support both MAT-XXXX-XXX/... and evidence-documents/MAT-XXXX-XXX/...
        SELECT 1 FROM public.matters m
        WHERE (
          m.reference_code = (storage.foldername(name))[1]
          OR (
            (storage.foldername(name))[1] = 'evidence-documents'
            AND m.reference_code = (storage.foldername(name))[2]
          )
        )
        AND public.has_matter_access(auth.uid(), m.id)
      )
    )
  );

-- INSERT Policy: Authorized users can upload evidence versions to their matters
DROP POLICY IF EXISTS "Authorized users upload evidence files" ON storage.objects;
CREATE POLICY "Authorized users upload evidence files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'evidence-documents'
    AND (
      public.is_workspace_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.matters m
        WHERE (
          m.reference_code = (storage.foldername(name))[1]
          OR (
            (storage.foldername(name))[1] = 'evidence-documents'
            AND m.reference_code = (storage.foldername(name))[2]
          )
        )
        AND public.has_matter_access(auth.uid(), m.id)
      )
    )
  );

-- UPDATE Policy: Explicitly prohibited to ensure immutable evidence files
DROP POLICY IF EXISTS "Evidence files are immutable" ON storage.objects;
CREATE POLICY "Evidence files are immutable"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE Policy: Only workspace administrators can delete evidence in exceptional compliance circumstances
DROP POLICY IF EXISTS "Only admins can delete evidence files" ON storage.objects;
CREATE POLICY "Only admins can delete evidence files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'evidence-documents'
    AND public.is_workspace_admin(auth.uid())
  );
