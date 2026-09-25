-- ==============================================================================
-- CROWN & LEDGER — EVIDENCE WORKSPACE
-- Initial Database Migration: Schema, Enums, Constraints, Indexes & RLS
-- Migration ID: 20260911000001_initial_schema.sql
-- ==============================================================================

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CUSTOM ENUMS
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'workspace_admin',
    'attorney',
    'reviewer'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matter_status AS ENUM (
    'active',
    'archived',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM (
    'high',
    'medium',
    'low'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matter_access_role AS ENUM (
    'lead',
    'contributor',
    'viewer'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_classification AS ENUM (
    'privileged',
    'confidential',
    'internal',
    'public'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_review_status AS ENUM (
    'needs_review',
    'reviewed',
    'restricted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_workflow_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
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
    'downloaded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 2. WORKSPACE SETTINGS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name TEXT NOT NULL DEFAULT 'Crown & Ledger',
  workspace_name TEXT NOT NULL DEFAULT 'Privileged workspace',
  storage_quota_bytes BIGINT NOT NULL DEFAULT 268435456000, -- 250 GB
  local_vault_quota_bytes BIGINT NOT NULL DEFAULT 107374182400, -- 100 GB
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. PROFILES TABLE (Linked to auth.users)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  initials VARCHAR(4) NOT NULL,
  role user_role NOT NULL DEFAULT 'attorney',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. MATTERS TABLE
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

-- ==============================================================================
-- 6. DOCUMENTS TABLE (Canonical evidence records)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  classification document_classification NOT NULL DEFAULT 'confidential',
  review_status document_review_status NOT NULL DEFAULT 'needs_review',
  current_version_number INT NOT NULL DEFAULT 1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_documents_matter ON public.documents(matter_id);
CREATE INDEX IF NOT EXISTS idx_documents_classification ON public.documents(classification);
CREATE INDEX IF NOT EXISTS idx_documents_review_status ON public.documents(review_status);
CREATE INDEX IF NOT EXISTS idx_documents_archived ON public.documents(is_archived);

-- ==============================================================================
-- 7. DOCUMENT VERSIONS TABLE (Immutable file snapshots)
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

-- ==============================================================================
-- 8. REVIEWS TABLE (Workflow assignments & attorney determinations)
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

-- ==============================================================================
-- 9. AUDIT LOGS TABLE (Append-Only Evidence Ledger)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  action audit_action_type NOT NULL,
  target_name TEXT NOT NULL,
  details TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_matter ON public.audit_logs(matter_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enforce strictly append-only integrity on audit_logs at trigger level
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

-- Revoke mutation rights
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, authenticated, anon;

-- ==============================================================================
-- 10. DOWNLOAD SECURITY EVENTS TABLE (Signed URL & Custodial Download Tracking)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.download_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  document_version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE RESTRICT,
  action_type VARCHAR(32) NOT NULL DEFAULT 'signed_url_generated', -- 'signed_url_generated', 'file_downloaded', 'access_revoked'
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

-- Enforce append-only on download_security_events
DROP TRIGGER IF EXISTS trg_prevent_download_events_mutation ON public.download_security_events;
CREATE TRIGGER trg_prevent_download_events_mutation
BEFORE UPDATE OR DELETE ON public.download_security_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.download_security_events FROM PUBLIC, authenticated, anon;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
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
      SELECT 1 FROM public.profiles WHERE id = user_uuid AND role = 'workspace_admin' AND is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.matters WHERE id = target_matter_id AND lead_attorney_id = user_uuid
    )
    OR EXISTS (
      SELECT 1 FROM public.matter_members WHERE matter_id = target_matter_id AND user_id = user_uuid
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 11. ENABLE ROW LEVEL SECURITY
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

-- ==============================================================================
-- 12. RLS POLICIES
-- ==============================================================================

-- Workspace Settings: Authenticated users can view; only admins can edit
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

-- Profiles: Authenticated users can view team profiles; users can update their own
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

-- Matters: Admins can view all; Attorneys can view matters they lead or belong to
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

-- Matter Members
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

-- Documents: Gated by matter access
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

-- Document Versions: Strictly gated by matter access; immutable once created
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

-- Reviews
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

-- Audit Logs: Append-only
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

-- Download Security Events: Strictly gated by matter access & append-only
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

