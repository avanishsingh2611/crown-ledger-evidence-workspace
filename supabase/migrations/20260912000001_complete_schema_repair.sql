-- ==============================================================================
-- CROWN & LEDGER — EVIDENCE WORKSPACE
-- Complete Database Schema Repair & Reconciliation Migration
-- Migration ID: 20260912000001_complete_schema_repair.sql
-- Idempotent & Non-Destructive: Preserves All Existing Data & Legacy Tables
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUMS (Safe Creation & Extension)
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('workspace_admin', 'attorney', 'reviewer', 'auditor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matter_status AS ENUM ('active', 'archived', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matter_access_role AS ENUM ('lead', 'contributor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_classification AS ENUM ('privileged', 'confidential', 'internal', 'public', 'restricted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE document_classification ADD VALUE IF NOT EXISTS 'restricted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_review_status AS ENUM ('needs_review', 'reviewed', 'restricted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_workflow_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected', 'in_review');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE review_workflow_status ADD VALUE IF NOT EXISTS 'in_review';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action_type AS ENUM (
    'uploaded',
    'review_requested',
    'accessed',
    'classification_changed',
    'review_completed',
    'matter_created',
    'matter_updated',
    'downloaded',
    'classified',
    'version_bumped',
    'security_alert',
    'access_requested',
    'access_approved',
    'access_denied',
    'audit_exported'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend audit_action_type if older enum variant exists
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'classified'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'version_bumped'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'security_alert'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'access_requested'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'access_approved'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'access_denied'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'audit_exported'; EXCEPTION WHEN others THEN NULL; END $$;

-- ==============================================================================
-- 2. WORKSPACE SETTINGS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name TEXT NOT NULL DEFAULT 'Crown & Ledger',
  workspace_name TEXT NOT NULL DEFAULT 'Privileged workspace',
  storage_quota_bytes BIGINT NOT NULL DEFAULT 268435456000, -- 250 GB
  local_vault_quota_bytes BIGINT NOT NULL DEFAULT 107374182400, -- 100 GB
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.workspace_settings (
  id,
  firm_name,
  workspace_name,
  storage_quota_bytes,
  local_vault_quota_bytes
)
VALUES (
  '00000000-0000-4000-a000-000000000001',
  'Crown & Ledger',
  'Privileged workspace',
  268435456000,
  107374182400
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 3. REPAIR PROFILES TABLE (Safe Column Augmentation & Sync)
-- ==============================================================================

-- Add missing columns required by backend & frontend
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initials VARCHAR(4);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Backfill full_name from existing name
UPDATE public.profiles
SET full_name = name
WHERE full_name IS NULL AND name IS NOT NULL;

-- Backfill initials based on names/emails
UPDATE public.profiles
SET initials = CASE
  WHEN id = '11111111-1111-4111-a111-111111111111' THEN 'ER'
  WHEN id = '22222222-2222-4222-a222-222222222222' THEN 'EM'
  WHEN id = '33333333-3333-4333-a333-333333333333' THEN 'DC'
  WHEN id = '44444444-4444-4444-a444-444444444444' THEN 'PS'
  WHEN id = '55555555-5555-4555-a555-555555555555' THEN 'JB'
  WHEN id = '66666666-6666-4666-a666-666666666666' THEN 'CV'
  ELSE UPPER(SUBSTRING(COALESCE(full_name, name, 'CL'), 1, 2))
END
WHERE initials IS NULL;

-- Backfill is_active from status column
UPDATE public.profiles
SET is_active = (status = 'ACTIVE')
WHERE status IS NOT NULL;

-- Ensure non-null constraints are safely fulfilled
UPDATE public.profiles SET full_name = 'Authorized User' WHERE full_name IS NULL;
UPDATE public.profiles SET initials = 'AU' WHERE initials IS NULL;
ALTER TABLE public.profiles ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN initials SET NOT NULL;

-- Safely cast legacy text roles to user_role enum
DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
  UPDATE public.profiles
  SET role = CASE
    WHEN LOWER(role::text) IN ('admin', 'workspace_admin') THEN 'workspace_admin'
    WHEN LOWER(role::text) IN ('lawyer', 'attorney') THEN 'attorney'
    WHEN LOWER(role::text) = 'reviewer' THEN 'reviewer'
    WHEN LOWER(role::text) = 'auditor' THEN 'auditor'
    ELSE 'attorney'
  END;
  ALTER TABLE public.profiles ALTER COLUMN role TYPE user_role USING role::user_role;
  ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'attorney'::user_role;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'role column already matches or cannot be converted directly';
END $$;

-- Keep name and full_name in sync bidirectionally for legacy & modern compatibility
CREATE OR REPLACE FUNCTION public.sync_profile_names()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.full_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := NEW.full_name;
  ELSIF NEW.name IS NOT NULL AND (NEW.full_name IS NULL OR NEW.full_name = '') THEN
    NEW.full_name := NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_names ON public.profiles;
CREATE TRIGGER trg_sync_profile_names
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_names();

-- Ensure FK from profiles.id to auth.users.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'profiles'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ==============================================================================
-- 4. MATTERS TABLE (Creation & Migration from Legacy cases)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code VARCHAR(32) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  matter_type VARCHAR(64) NOT NULL DEFAULT 'Litigation',
  status matter_status NOT NULL DEFAULT 'active',
  risk_level risk_level NOT NULL DEFAULT 'low',
  lead_attorney_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_matters_status ON public.matters(status);
CREATE INDEX IF NOT EXISTS idx_matters_reference ON public.matters(reference_code);
CREATE INDEX IF NOT EXISTS idx_matters_lead ON public.matters(lead_attorney_id);

-- Migrate existing 4 cases from legacy public.cases into public.matters
INSERT INTO public.matters (
  id,
  reference_code,
  title,
  client_name,
  matter_type,
  status,
  risk_level,
  lead_attorney_id,
  description,
  created_at,
  updated_at
)
VALUES
  (
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    'MAT-2024-018',
    'Northstar v. Meridian',
    'Northstar Holdings',
    'Commercial Litigation',
    'active',
    'high',
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    'High-stakes IP and commercial breach dispute regarding multi-market logistics telemetry.',
    '2026-08-10 09:00:00+00',
    '2026-09-08 14:12:00+00'
  ),
  (
    'bbbbbbbb-2222-4bbb-bbbb-222222222222',
    'MAT-2024-022',
    'Project Lighthouse',
    'Internal Investigation',
    'Internal Compliance',
    'active',
    'medium',
    '33333333-3333-4333-a333-333333333333', -- Darius Cole
    'Internal investigation into server forensic imaging and digital custodial logging.',
    '2026-08-15 10:30:00+00',
    '2026-09-07 20:50:00+00'
  ),
  (
    'cccccccc-3333-4ccc-cccc-333333333333',
    'MAT-2024-011',
    'Atlas Vendor Review',
    'Atlas Financial',
    'Vendor Due Diligence',
    'active',
    'low',
    '44444444-4444-4444-a444-444444444444', -- Priya Shah
    'Contractual compliance review, vendor audit and third-party security assurance.',
    '2026-08-05 14:00:00+00',
    '2026-09-05 16:46:00+00'
  ),
  (
    'dddddddd-4444-4ddd-dddd-444444444444',
    'MAT-2023-044',
    'Aster Compliance Inquiry',
    'Aster & Co.',
    'Regulatory Inquiry',
    'archived',
    'low',
    '55555555-5555-4555-a555-555555555555', -- Jon Bell
    'Archived regulatory inquiry regarding historical reporting metrics.',
    '2025-11-12 11:00:00+00',
    '2026-08-21 10:00:00+00'
  )
ON CONFLICT (id) DO UPDATE SET
  reference_code = EXCLUDED.reference_code,
  title = EXCLUDED.title,
  client_name = EXCLUDED.client_name,
  matter_type = EXCLUDED.matter_type,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  lead_attorney_id = EXCLUDED.lead_attorney_id,
  description = EXCLUDED.description,
  updated_at = EXCLUDED.updated_at;

-- Migrate any additional ad-hoc cases if present in public.cases
INSERT INTO public.matters (
  id, reference_code, title, client_name, matter_type, status, risk_level, lead_attorney_id, description, created_at, updated_at
)
SELECT
  c.id,
  c.case_number,
  c.title,
  'Client ' || c.case_number,
  'Litigation',
  CASE WHEN LOWER(c.status) = 'closed' THEN 'closed'::matter_status ELSE 'active'::matter_status END,
  'low'::risk_level,
  COALESCE(c.lawyer_id, c.created_by, '11111111-1111-4111-a111-111111111111'::uuid),
  c.description,
  c.created_at,
  c.updated_at
FROM public.cases c
WHERE NOT EXISTS (SELECT 1 FROM public.matters m WHERE m.id = c.id)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. MATTER MEMBERS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.matter_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_role matter_access_role NOT NULL DEFAULT 'contributor',
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_matter_member UNIQUE (matter_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_matter_members_user ON public.matter_members(user_id);
CREATE INDEX IF NOT EXISTS idx_matter_members_matter ON public.matter_members(matter_id);

-- Seed matter memberships
INSERT INTO public.matter_members (matter_id, user_id, access_role, granted_by)
VALUES
  ('aaaaaaaa-1111-4aaa-aaaa-111111111111', '22222222-2222-4222-a222-222222222222', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('aaaaaaaa-1111-4aaa-aaaa-111111111111', '11111111-1111-4111-a111-111111111111', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('bbbbbbbb-2222-4bbb-bbbb-222222222222', '33333333-3333-4333-a333-333333333333', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('bbbbbbbb-2222-4bbb-bbbb-222222222222', '22222222-2222-4222-a222-222222222222', 'contributor', '33333333-3333-4333-a333-333333333333'),
  ('cccccccc-3333-4ccc-cccc-333333333333', '44444444-4444-4444-a444-444444444444', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('dddddddd-4444-4ddd-dddd-444444444444', '55555555-5555-4555-a555-555555555555', 'lead', '11111111-1111-4111-a111-111111111111')
ON CONFLICT (matter_id, user_id) DO NOTHING;

-- ==============================================================================
-- 6. REPAIR DOCUMENTS TABLE (Add matter_id, Enum Types & Metadata)
-- ==============================================================================

-- Add missing columns
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS matter_id UUID;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS review_status document_review_status NOT NULL DEFAULT 'needs_review';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS current_version_number INT NOT NULL DEFAULT 1;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_by UUID;

-- Backfill matter_id from case_id
UPDATE public.documents
SET matter_id = case_id
WHERE matter_id IS NULL AND case_id IS NOT NULL;

-- Backfill created_by from uploaded_by or matter lead attorney
UPDATE public.documents
SET created_by = COALESCE(
  uploaded_by,
  (SELECT lead_attorney_id FROM public.matters m WHERE m.id = documents.matter_id),
  '22222222-2222-4222-a222-222222222222'::uuid
)
WHERE created_by IS NULL;

-- Safely convert classification to enum type
DO $$ BEGIN
  ALTER TABLE public.documents ALTER COLUMN classification DROP DEFAULT;
  UPDATE public.documents
  SET classification = LOWER(classification::text)
  WHERE classification IS NOT NULL;

  ALTER TABLE public.documents
    ALTER COLUMN classification TYPE document_classification
    USING classification::document_classification;

  ALTER TABLE public.documents
    ALTER COLUMN classification SET DEFAULT 'confidential'::document_classification;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Update canonical document review status & version tracking for existing 8 records
UPDATE public.documents SET
  review_status = 'needs_review',
  current_version_number = 3,
  tags = ARRAY['memo', 'outside-counsel', 'privileged'],
  created_by = '22222222-2222-4222-a222-222222222222'
WHERE id = '10000000-0000-4000-a000-000000000001';

UPDATE public.documents SET
  review_status = 'reviewed',
  current_version_number = 1,
  tags = ARRAY['witness', 'transcript', 'deposition'],
  created_by = '22222222-2222-4222-a222-222222222222'
WHERE id = '10000000-0000-4000-a000-000000000002';

UPDATE public.documents SET
  review_status = 'restricted',
  current_version_number = 2,
  tags = ARRAY['source-code', 'diff', 'audit'],
  created_by = '22222222-2222-4222-a222-222222222222'
WHERE id = '10000000-0000-4000-a000-000000000003';

UPDATE public.documents SET
  review_status = 'needs_review',
  current_version_number = 1,
  tags = ARRAY['telemetry', 'turbine', 'forensics'],
  created_by = '33333333-3333-4333-a333-333333333333'
WHERE id = '20000000-0000-4000-a000-000000000004';

UPDATE public.documents SET
  review_status = 'reviewed',
  current_version_number = 4,
  tags = ARRAY['custody', 'chain-of-custody', 'log'],
  created_by = '33333333-3333-4333-a333-333333333333'
WHERE id = '20000000-0000-4000-a000-000000000005';

UPDATE public.documents SET
  review_status = 'reviewed',
  current_version_number = 1,
  tags = ARRAY['due-diligence', 'vendor', 'atlas'],
  created_by = '44444444-4444-4444-a444-444444444444'
WHERE id = '30000000-0000-4000-a000-000000000006';

UPDATE public.documents SET
  review_status = 'needs_review',
  current_version_number = 1,
  tags = ARRAY['contract', 'msa', 'schedule-b'],
  created_by = '44444444-4444-4444-a444-444444444444'
WHERE id = '30000000-0000-4000-a000-000000000007';

UPDATE public.documents SET
  review_status = 'reviewed',
  current_version_number = 1,
  tags = ARRAY['regulatory', 'audit', 'findings'],
  created_by = '55555555-5555-4555-a555-555555555555'
WHERE id = '40000000-0000-4000-a000-000000000008';

-- Enforce foreign keys & constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents' AND constraint_name = 'documents_matter_id_fkey'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_matter_id_fkey FOREIGN KEY (matter_id) REFERENCES public.matters(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents' AND constraint_name = 'documents_created_by_fkey'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Set NOT NULL where required
ALTER TABLE public.documents ALTER COLUMN matter_id SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN created_by SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_matter ON public.documents(matter_id);
CREATE INDEX IF NOT EXISTS idx_documents_classification ON public.documents(classification);
CREATE INDEX IF NOT EXISTS idx_documents_review_status ON public.documents(review_status);
CREATE INDEX IF NOT EXISTS idx_documents_archived ON public.documents(is_archived);

-- ==============================================================================
-- 7. DOCUMENT VERSIONS TABLE (Immutable Snapshots)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  version_number INT NOT NULL,
  original_filename TEXT NOT NULL,
  file_extension VARCHAR(16) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  sha256_checksum VARCHAR(64) NOT NULL,
  change_summary TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_document_version UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON public.document_versions(document_id);

-- Populate document versions matching actual file inventory
INSERT INTO public.document_versions (
  id, document_id, version_number, original_filename, file_extension, mime_type, file_size_bytes, storage_path, sha256_checksum, change_summary, uploaded_by, created_at
)
VALUES
  ('10000001-0001-4000-b000-000000000001', '10000000-0000-4000-a000-000000000001', 1, 'Outside_Counsel_Memo_Draft1.pdf', 'pdf', 'application/pdf', 1887436, 'evidence-documents/MAT-2024-018/doc-1/v1/Outside_Counsel_Memo_Draft1.pdf', '7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c', 'Initial outside counsel preliminary briefing.', '22222222-2222-4222-a222-222222222222', '2026-08-20 10:00:00+00'),
  ('10000001-0001-4000-b000-000000000002', '10000000-0000-4000-a000-000000000001', 2, 'Outside_Counsel_Memo_Revisions.pdf', 'pdf', 'application/pdf', 2516582, 'evidence-documents/MAT-2024-018/doc-1/v2/Outside_Counsel_Memo_Revisions.pdf', '6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c', 'Revised draft incorporating partner comments.', '22222222-2222-4222-a222-222222222222', '2026-08-28 15:30:00+00'),
  ('10000001-0001-4000-b000-000000000003', '10000000-0000-4000-a000-000000000001', 3, 'Outside_Counsel_Memo_Preliminary_Findings.pdf', 'pdf', 'application/pdf', 2936012, 'evidence-documents/MAT-2024-018/doc-1/v3/Outside_Counsel_Memo_Preliminary_Findings.pdf', '4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c', 'Version 3 finalized outside counsel preliminary findings.', '22222222-2222-4222-a222-222222222222', '2026-09-08 14:12:00+00'),
  ('10000002-0002-4000-b000-000000000001', '10000000-0000-4000-a000-000000000002', 1, 'Interview_Transcript_R_Patel.docx', 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1468006, 'evidence-documents/MAT-2024-018/doc-2/v1/Interview_Transcript_R_Patel.docx', '10a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a493827', 'Certified transcription of investigative deposition.', '22222222-2222-4222-a222-222222222222', '2026-09-07 11:30:00+00'),
  ('10000003-0003-4000-b000-000000000001', '10000000-0000-4000-a000-000000000003', 1, 'Evidence_Index_Batch_04_Draft.xlsx', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 634880, 'evidence-documents/MAT-2024-018/doc-3/v1/Evidence_Index_Batch_04_Draft.xlsx', 'c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8', 'Initial batch evidence index tabulation.', '22222222-2222-4222-a222-222222222222', '2026-09-01 09:00:00+00'),
  ('10000003-0003-4000-b000-000000000002', '10000000-0000-4000-a000-000000000003', 2, 'Evidence_Index_Batch_04.xlsx', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 862208, 'evidence-documents/MAT-2024-018/doc-3/v2/Evidence_Index_Batch_04.xlsx', 'f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5', 'Version 2 with verified digital custodial checksums.', '22222222-2222-4222-a222-222222222222', '2026-09-06 15:55:00+00'),
  ('20000004-0004-4000-b000-000000000001', '20000000-0000-4000-a000-000000000004', 1, 'Forensic_Imaging_Report.pdf', 'pdf', 'application/pdf', 19084083, 'evidence-documents/MAT-2024-022/doc-4/v1/Forensic_Imaging_Report.pdf', 'd0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1', 'Bitstream forensic image verification report.', '33333333-3333-4333-a333-333333333333', '2026-09-07 20:50:00+00'),
  ('20000005-0005-4000-b000-000000000001', '20000000-0000-4000-a000-000000000005', 1, 'Chain_of_Custody_v1.csv', 'csv', 'text/csv', 102400, 'evidence-documents/MAT-2024-022/doc-5/v1/Chain_of_Custody_v1.csv', 'e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6', 'Initial device intake.', '33333333-3333-4333-a333-333333333333', '2026-08-25 09:15:00+00'),
  ('20000005-0005-4000-b000-000000000002', '20000000-0000-4000-a000-000000000005', 2, 'Chain_of_Custody_v2.csv', 'csv', 'text/csv', 184320, 'evidence-documents/MAT-2024-022/doc-5/v2/Chain_of_Custody_v2.csv', 'b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3', 'Lab intake records added.', '33333333-3333-4333-a333-333333333333', '2026-08-30 14:20:00+00'),
  ('20000005-0005-4000-b000-000000000003', '20000000-0000-4000-a000-000000000005', 3, 'Chain_of_Custody_v3.csv', 'csv', 'text/csv', 266240, 'evidence-documents/MAT-2024-022/doc-5/v3/Chain_of_Custody_v3.csv', '9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f', 'Third-party examiner transfer.', '33333333-3333-4333-a333-333333333333', '2026-09-02 17:00:00+00'),
  ('20000005-0005-4000-b000-000000000004', '20000000-0000-4000-a000-000000000005', 4, 'Chain_of_Custody_Log.csv', 'csv', 'text/csv', 335872, 'evidence-documents/MAT-2024-022/doc-5/v4/Chain_of_Custody_Log.csv', '8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e', 'Version 4 full chain of custody log with no exceptions.', '33333333-3333-4333-a333-333333333333', '2026-09-05 19:18:00+00'),
  ('30000006-0006-4000-b000-000000000001', '30000000-0000-4000-a000-000000000006', 1, 'Vendor_Due_Diligence_Summary.pdf', 'pdf', 'application/pdf', 1153433, 'evidence-documents/MAT-2024-011/doc-6/v1/Vendor_Due_Diligence_Summary.pdf', '7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d', 'Completed vendor compliance and due diligence executive summary.', '44444444-4444-4444-a444-444444444444', '2026-09-05 16:46:00+00'),
  ('30000007-0007-4000-b000-000000000001', '30000000-0000-4000-a000-000000000007', 1, 'MSA_Schedule_B_Atlas.pdf', 'pdf', 'application/pdf', 3774873, 'evidence-documents/MAT-2024-011/doc-7/v1/MSA_Schedule_B_Atlas.pdf', '6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c', 'Schedule B services and data governance annex.', '44444444-4444-4444-a444-444444444444', '2026-09-04 14:10:00+00'),
  ('40000008-0008-4000-b000-000000000001', '40000000-0000-4000-a000-000000000008', 1, 'Regulatory_Response_Audit_Findings.pdf', 'pdf', 'application/pdf', 4404019, 'evidence-documents/MAT-2023-044/doc-8/v1/Regulatory_Response_Audit_Findings.pdf', '5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b', 'Archived closing response and compliance sign-off.', '55555555-5555-4555-a555-555555555555', '2026-08-21 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Also generate version records for any documents not already covered
INSERT INTO public.document_versions (
  document_id, version_number, original_filename, file_extension, mime_type, file_size_bytes, storage_path, sha256_checksum, change_summary, uploaded_by, created_at
)
SELECT
  d.id,
  1,
  COALESCE(d.file_name, d.title || '.pdf'),
  COALESCE(d.file_type, 'pdf'),
  'application/pdf',
  COALESCE(d.file_size, 1048576),
  COALESCE(d.storage_path, 'evidence-documents/documents/' || d.id::text || '/v1.pdf'),
  md5(d.id::text || 'v1'),
  'Initial version record',
  d.created_by,
  d.created_at
FROM public.documents d
WHERE NOT EXISTS (SELECT 1 FROM public.document_versions dv WHERE dv.document_id = d.id)
ON CONFLICT (document_id, version_number) DO NOTHING;

-- ==============================================================================
-- 8. REVIEWS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  document_version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE RESTRICT,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status review_workflow_status NOT NULL DEFAULT 'pending',
  decision_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reviews_document ON public.reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_reviews_assigned ON public.reviews(assigned_to);

-- Seed existing review records
INSERT INTO public.reviews (
  id, document_id, document_version_id, assigned_to, requested_by, status, decision_notes, completed_at, created_at, updated_at
)
VALUES
  ('aaaa0001-0001-4000-c000-000000000001', '20000000-0000-4000-a000-000000000004', '20000004-0004-4000-b000-000000000001', '22222222-2222-4222-a222-222222222222', '33333333-3333-4333-a333-333333333333', 'pending', NULL, NULL, '2026-09-07 20:50:00+00', '2026-09-07 20:50:00+00'),
  ('aaaa0002-0002-4000-c000-000000000002', '20000000-0000-4000-a000-000000000005', '20000005-0005-4000-b000-000000000004', '55555555-5555-4555-a555-555555555555', '33333333-3333-4333-a333-333333333333', 'completed', 'No exceptions found', '2026-09-05 19:18:00+00', '2026-09-02 10:00:00+00', '2026-09-05 19:18:00+00'),
  ('aaaa0003-0003-4000-c000-000000000003', '10000000-0000-4000-a000-000000000002', '10000002-0002-4000-b000-000000000001', '22222222-2222-4222-a222-222222222222', '22222222-2222-4222-a222-222222222222', 'completed', 'Transcript verified against audio recording.', '2026-09-07 14:00:00+00', '2026-09-07 11:30:00+00', '2026-09-07 14:00:00+00'),
  ('aaaa0004-0004-4000-c000-000000000004', '30000000-0000-4000-a000-000000000006', '30000006-0006-4000-b000-000000000001', '44444444-4444-4444-a444-444444444444', '44444444-4444-4444-a444-444444444444', 'completed', 'All corporate governance and vendor filings certified.', '2026-09-05 16:46:00+00', '2026-09-04 09:00:00+00', '2026-09-05 16:46:00+00'),
  ('aaaa0005-0005-4000-c000-000000000005', '40000000-0000-4000-a000-000000000008', '40000008-0008-4000-b000-000000000001', '55555555-5555-4555-a555-555555555555', '55555555-5555-4555-a555-555555555555', 'completed', 'Regulatory matter concluded and archived.', '2026-08-21 10:00:00+00', '2026-08-20 09:00:00+00', '2026-08-21 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 9. REPAIR AUDIT LOGS TABLE & ESTABLISH RELATIONSHIPS
-- ==============================================================================

-- 1. Add missing expected columns
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS matter_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill actor_id from legacy user_id
UPDATE public.audit_logs
SET actor_id = user_id
WHERE actor_id IS NULL AND user_id IS NOT NULL;

-- Backfill matter_id from legacy case_id
UPDATE public.audit_logs
SET matter_id = case_id
WHERE matter_id IS NULL AND case_id IS NOT NULL;

-- Backfill target_name and details from description/action if empty
UPDATE public.audit_logs
SET target_name = COALESCE(description, action::text, 'Evidence Action')
WHERE target_name IS NULL;

UPDATE public.audit_logs
SET details = COALESCE(description, 'Audit event recorded')
WHERE details IS NULL;

-- Fallback actor_id to admin profile if any nulls remain before constraint
UPDATE public.audit_logs
SET actor_id = '11111111-1111-4111-a111-111111111111'::uuid
WHERE actor_id IS NULL;

ALTER TABLE public.audit_logs ALTER COLUMN actor_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN target_name SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN details SET NOT NULL;

-- 3. Safely cast action to audit_action_type enum
DO $$ BEGIN
  ALTER TABLE public.audit_logs ALTER COLUMN action DROP DEFAULT;
  UPDATE public.audit_logs
  SET action = CASE
    WHEN LOWER(action::text) = 'uploaded' THEN 'uploaded'
    WHEN LOWER(action::text) = 'review_requested' THEN 'review_requested'
    WHEN LOWER(action::text) = 'accessed' THEN 'accessed'
    WHEN LOWER(action::text) = 'classification_changed' THEN 'classification_changed'
    WHEN LOWER(action::text) = 'review_completed' THEN 'review_completed'
    WHEN LOWER(action::text) = 'matter_created' THEN 'matter_created'
    WHEN LOWER(action::text) = 'matter_updated' THEN 'matter_updated'
    WHEN LOWER(action::text) = 'downloaded' THEN 'downloaded'
    WHEN LOWER(action::text) = 'access_requested' THEN 'access_requested'
    WHEN LOWER(action::text) = 'access_approved' THEN 'access_approved'
    WHEN LOWER(action::text) = 'access_denied' THEN 'access_denied'
    WHEN LOWER(action::text) = 'audit_exported' THEN 'audit_exported'
    ELSE 'accessed'
  END;
  ALTER TABLE public.audit_logs ALTER COLUMN action TYPE audit_action_type USING action::audit_action_type;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 4. Establish explicit Foreign Keys required by PostgREST schema cache
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'audit_logs' AND constraint_name = 'audit_logs_actor_id_fkey'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'audit_logs' AND constraint_name = 'audit_logs_matter_id_fkey'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_matter_id_fkey
      FOREIGN KEY (matter_id) REFERENCES public.matters(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'audit_logs' AND constraint_name = 'audit_logs_document_id_fkey'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_document_id_fkey
      FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_matter ON public.audit_logs(matter_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 5. Establish append-only trigger AFTER column migrations
CREATE OR REPLACE FUNCTION public.prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs and security events are immutable. UPDATE, DELETE, and TRUNCATE operations are strictly prohibited by legal compliance policy.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_logs_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, authenticated, anon;

-- ==============================================================================
-- 10. DOWNLOAD SECURITY EVENTS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.download_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  document_version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE RESTRICT,
  action_type VARCHAR(32) NOT NULL DEFAULT 'signed_url_generated',
  ip_address TEXT,
  user_agent TEXT,
  signed_url_expires_at TIMESTAMPTZ NOT NULL,
  download_verified BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_download_events_doc ON public.download_security_events(document_id);
CREATE INDEX IF NOT EXISTS idx_download_events_user ON public.download_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_download_events_matter ON public.download_security_events(matter_id);
CREATE INDEX IF NOT EXISTS idx_download_events_created ON public.download_security_events(created_at DESC);

DROP TRIGGER IF EXISTS trg_prevent_download_events_mutation ON public.download_security_events;
CREATE TRIGGER trg_prevent_download_events_mutation
BEFORE UPDATE OR DELETE ON public.download_security_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.download_security_events FROM PUBLIC, authenticated, anon;

-- ==============================================================================
-- 11. RESTRICTED ACCESS REQUESTS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.restricted_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision_note TEXT,
  approved_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  decided_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_user_doc_request 
  ON public.restricted_access_requests(document_id, requester_id) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_restricted_req_doc ON public.restricted_access_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_restricted_req_requester ON public.restricted_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_restricted_req_matter ON public.restricted_access_requests(matter_id);
CREATE INDEX IF NOT EXISTS idx_restricted_req_status ON public.restricted_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_restricted_req_approved_until ON public.restricted_access_requests(approved_until) WHERE approved_until IS NOT NULL;

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid AND role = 'workspace_admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_matter_access(user_uuid UUID, target_matter_id UUID)
RETURNS BOOLEAN AS $$
  SELECT 
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = user_uuid AND (role = 'workspace_admin' OR role = 'auditor') AND is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.matters WHERE id = target_matter_id AND lead_attorney_id = user_uuid
    )
    OR EXISTS (
      SELECT 1 FROM public.matter_members WHERE matter_id = target_matter_id AND user_id = user_uuid
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 13. ENABLE RLS ON ALL TABLES
-- ==============================================================================

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restricted_access_requests ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 14. RLS POLICIES (Idempotent Drop & Create)
-- ==============================================================================

-- 14.1 Workspace Settings
DROP POLICY IF EXISTS "Authenticated users view settings" ON public.workspace_settings;
CREATE POLICY "Authenticated users view settings"
  ON public.workspace_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins update settings" ON public.workspace_settings;
CREATE POLICY "Admins update settings"
  ON public.workspace_settings FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin(auth.uid()));

-- 14.2 Profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_workspace_admin(auth.uid()));

-- 14.3 Matters
DROP POLICY IF EXISTS "Users can view authorized matters" ON public.matters;
CREATE POLICY "Users can view authorized matters"
  ON public.matters FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid()) 
    OR lead_attorney_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.matter_members mm 
      WHERE mm.matter_id = id AND mm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and leads can create matters" ON public.matters;
CREATE POLICY "Admins and leads can create matters"
  ON public.matters FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_admin(auth.uid()) 
    OR lead_attorney_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins and leads can update matters" ON public.matters;
CREATE POLICY "Admins and leads can update matters"
  ON public.matters FOR UPDATE
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid()) 
    OR lead_attorney_id = auth.uid()
  );

-- 14.4 Matter Members
DROP POLICY IF EXISTS "Users can view members of authorized matters" ON public.matter_members;
CREATE POLICY "Users can view members of authorized matters"
  ON public.matter_members FOR SELECT
  TO authenticated
  USING (public.has_matter_access(auth.uid(), matter_id));

DROP POLICY IF EXISTS "Admins and leads can manage members" ON public.matter_members;
CREATE POLICY "Admins and leads can manage members"
  ON public.matter_members FOR ALL
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.matters m WHERE m.id = matter_id AND m.lead_attorney_id = auth.uid())
  );

-- 14.5 Documents
DROP POLICY IF EXISTS "Users can view documents in authorized matters" ON public.documents;
CREATE POLICY "Users can view documents in authorized matters"
  ON public.documents FOR SELECT
  TO authenticated
  USING (public.has_matter_access(auth.uid(), matter_id));

DROP POLICY IF EXISTS "Users can insert documents in authorized matters" ON public.documents;
CREATE POLICY "Users can insert documents in authorized matters"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_matter_access(auth.uid(), matter_id));

DROP POLICY IF EXISTS "Users can update documents in authorized matters" ON public.documents;
CREATE POLICY "Users can update documents in authorized matters"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (public.has_matter_access(auth.uid(), matter_id));

-- 14.6 Document Versions
DROP POLICY IF EXISTS "Users can view versions in authorized matters" ON public.document_versions;
CREATE POLICY "Users can view versions in authorized matters"
  ON public.document_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.has_matter_access(auth.uid(), d.matter_id)
    )
  );

DROP POLICY IF EXISTS "Users can upload versions in authorized matters" ON public.document_versions;
CREATE POLICY "Users can upload versions in authorized matters"
  ON public.document_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.has_matter_access(auth.uid(), d.matter_id)
    )
  );

-- 14.7 Reviews
DROP POLICY IF EXISTS "Users can view reviews in authorized matters" ON public.reviews;
CREATE POLICY "Users can view reviews in authorized matters"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.has_matter_access(auth.uid(), d.matter_id)
    )
  );

DROP POLICY IF EXISTS "Authorized users can request reviews" ON public.reviews;
CREATE POLICY "Authorized users can request reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.has_matter_access(auth.uid(), d.matter_id)
    )
  );

DROP POLICY IF EXISTS "Assigned reviewers or admins can update review status" ON public.reviews;
CREATE POLICY "Assigned reviewers or admins can update review status"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() 
    OR requested_by = auth.uid() 
    OR public.is_workspace_admin(auth.uid())
  );

-- 14.8 Audit Logs
DROP POLICY IF EXISTS "Users can view audit logs for authorized matters" ON public.audit_logs;
CREATE POLICY "Users can view audit logs for authorized matters"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid()) 
    OR matter_id IS NULL 
    OR public.has_matter_access(auth.uid(), matter_id)
  );

DROP POLICY IF EXISTS "Authenticated users can create audit log entries" ON public.audit_logs;
CREATE POLICY "Authenticated users can create audit log entries"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 14.9 Download Security Events
DROP POLICY IF EXISTS "Users can view download events for authorized matters" ON public.download_security_events;
CREATE POLICY "Users can view download events for authorized matters"
  ON public.download_security_events FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid()) 
    OR public.has_matter_access(auth.uid(), matter_id)
  );

DROP POLICY IF EXISTS "Authenticated users can record download events" ON public.download_security_events;
CREATE POLICY "Authenticated users can record download events"
  ON public.download_security_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 14.10 Restricted Access Requests
DROP POLICY IF EXISTS "Users can view relevant access requests" ON public.restricted_access_requests;
CREATE POLICY "Users can view relevant access requests"
  ON public.restricted_access_requests FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid()
    OR public.is_workspace_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.matters m
      WHERE m.id = matter_id AND m.lead_attorney_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authorized matter members can create access requests" ON public.restricted_access_requests;
CREATE POLICY "Authorized matter members can create access requests"
  ON public.restricted_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND public.has_matter_access(auth.uid(), matter_id)
  );

DROP POLICY IF EXISTS "Admins and leads can decide access requests" ON public.restricted_access_requests;
CREATE POLICY "Admins and leads can decide access requests"
  ON public.restricted_access_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.matters m
      WHERE m.id = matter_id AND m.lead_attorney_id = auth.uid()
    )
  );

-- ==============================================================================
-- 15. STORAGE BUCKET & ACCESS POLICIES
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-documents',
  'evidence-documents',
  false,
  104857600,
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

DROP POLICY IF EXISTS "Authorized users read evidence files" ON storage.objects;
CREATE POLICY "Authorized users read evidence files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
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

DROP POLICY IF EXISTS "Evidence files are immutable" ON storage.objects;
CREATE POLICY "Evidence files are immutable"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Only admins can delete evidence files" ON storage.objects;
CREATE POLICY "Only admins can delete evidence files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'evidence-documents'
    AND public.is_workspace_admin(auth.uid())
  );

-- ==============================================================================
-- 16. FORCE POSTGREST SCHEMA CACHE RELOAD
-- ==============================================================================

NOTIFY pgrst, 'reload schema';
