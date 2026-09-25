-- ==============================================================================
-- CROWN & LEDGER — EVIDENCE WORKSPACE
-- Migration: Restricted Access Requests & Protected Evidence Governance
-- Migration ID: 20260911000003_restricted_access_requests.sql
-- ==============================================================================

-- 1. Extend audit_action_type enum if supported
DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'access_requested';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'access_approved';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'access_denied';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 2. RESTRICTED ACCESS REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.restricted_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  decided_at TIMESTAMPTZ
);

-- Ensure a user cannot spam multiple pending requests for the same evidence file
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_user_doc_request 
  ON public.restricted_access_requests(document_id, requester_id) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_restricted_req_doc ON public.restricted_access_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_restricted_req_requester ON public.restricted_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_restricted_req_matter ON public.restricted_access_requests(matter_id);
CREATE INDEX IF NOT EXISTS idx_restricted_req_status ON public.restricted_access_requests(status);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.restricted_access_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR RESTRICTED ACCESS REQUESTS
-- Requesters can see their own requests; Admins and Lead Attorneys can see all requests for their matters
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

-- Users can submit requests only for matters they are assigned to
DROP POLICY IF EXISTS "Authorized matter members can create access requests" ON public.restricted_access_requests;
CREATE POLICY "Authorized matter members can create access requests"
  ON public.restricted_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND public.has_matter_access(auth.uid(), matter_id)
  );

-- Only Workspace Admins or Matter Lead Attorneys can decide (update) access requests
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
