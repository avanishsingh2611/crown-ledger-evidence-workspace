-- ==============================================================================
-- CROWN & LEDGER / SIH 2026 — SECURE LEGAL DOCUMENT SYSTEM
-- SIH Court Case, Role Extension & Digital Evidence Integrity Schema
-- Migration ID: 20260921000001_sih_court_and_roles_schema.sql
-- Idempotent & Non-Destructive: Preserves All Existing Matters, Documents & RLS
-- ==============================================================================

-- ==============================================================================
-- 1. ROLE EXTENSION (Safe PostgreSQL Enum Updates)
-- ==============================================================================

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'judge';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'victim';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'forensic_team';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- If public.profiles has a legacy check constraint on role, update it to accept new SIH roles
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'profiles'
      AND tc.constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
      CHECK (role::text IN (
        'ADMIN', 'LAWYER', 'JUDGE', 'VICTIM', 'FORENSIC_TEAM',
        'workspace_admin', 'attorney', 'reviewer', 'auditor', 'judge', 'victim', 'forensic_team'
      ));
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ==============================================================================
-- 2. COURT CASES TABLE (Extends Existing Matters 1:1)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.court_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL UNIQUE REFERENCES public.matters(id) ON DELETE RESTRICT,
  case_number VARCHAR(64) NOT NULL UNIQUE,
  court_name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  case_type VARCHAR(64) NOT NULL DEFAULT 'Criminal',
  fir_number VARCHAR(64),
  police_station VARCHAR(128),
  presiding_judge_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  investigation_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stage VARCHAR(64) NOT NULL DEFAULT 'Investigation' CHECK (
    stage IN ('Filing', 'Investigation', 'Pre-Trial', 'Trial', 'Evidence Hearing', 'Judgement', 'Appeal', 'Closed')
  ),
  filing_date DATE,
  next_hearing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_court_cases_matter_id ON public.court_cases(matter_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_case_number ON public.court_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_court_cases_judge ON public.court_cases(presiding_judge_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_stage ON public.court_cases(stage);
CREATE INDEX IF NOT EXISTS idx_court_cases_next_hearing ON public.court_cases(next_hearing_date);

-- ==============================================================================
-- 3. CASE PARTICIPANTS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.case_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id UUID NOT NULL REFERENCES public.court_cases(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_role VARCHAR(32) NOT NULL CHECK (
    participant_role IN ('judge', 'prosecutor', 'defense_lawyer', 'victim', 'forensic_examiner', 'investigating_officer', 'auditor')
  ),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_case_participant UNIQUE (court_case_id, user_id, participant_role)
);

CREATE INDEX IF NOT EXISTS idx_case_participants_case ON public.case_participants(court_case_id);
CREATE INDEX IF NOT EXISTS idx_case_participants_matter ON public.case_participants(matter_id);
CREATE INDEX IF NOT EXISTS idx_case_participants_user ON public.case_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_case_participants_role ON public.case_participants(participant_role);

-- Synchronization trigger to matter_members (non-recursive, skips victim)
CREATE OR REPLACE FUNCTION public.sync_case_participant_to_matter_members()
RETURNS TRIGGER AS $$
DECLARE
  v_member_role matter_access_role;
BEGIN
  -- Strict Victim Isolation: Victims MUST NOT receive blanket matter_members document access
  IF NEW.participant_role = 'victim' THEN
    RETURN NEW;
  END IF;

  IF NEW.participant_role IN ('judge', 'prosecutor', 'defense_lawyer') THEN
    v_member_role := 'lead'::matter_access_role;
  ELSIF NEW.participant_role IN ('forensic_examiner', 'investigating_officer') THEN
    v_member_role := 'contributor'::matter_access_role;
  ELSE
    v_member_role := 'viewer'::matter_access_role;
  END IF;

  INSERT INTO public.matter_members (matter_id, user_id, access_role, created_at)
  VALUES (NEW.matter_id, NEW.user_id, v_member_role, timezone('utc'::text, now()))
  ON CONFLICT (matter_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_case_participant ON public.case_participants;
CREATE TRIGGER trg_sync_case_participant
AFTER INSERT ON public.case_participants
FOR EACH ROW EXECUTE FUNCTION public.sync_case_participant_to_matter_members();

-- ==============================================================================
-- 4. FORENSIC REPORTS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.forensic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  court_case_id UUID NOT NULL REFERENCES public.court_cases(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  examiner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  lab_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(64) NOT NULL,
  device_make_model VARCHAR(255) NOT NULL,
  device_serial_number VARCHAR(128) NOT NULL,
  extraction_tool VARCHAR(128) NOT NULL,
  extraction_tool_version VARCHAR(64) NOT NULL,
  acquisition_sha256 VARCHAR(64) NOT NULL,
  verification_sha256 VARCHAR(64) NOT NULL,
  hashes_match BOOLEAN NOT NULL DEFAULT true,
  intake_condition TEXT NOT NULL DEFAULT 'Intact, Tamper-Evident Bag Sealed',
  findings_summary TEXT NOT NULL,
  section_65b_certified BOOLEAN NOT NULL DEFAULT false,
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  finalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_forensic_reports_doc ON public.forensic_reports(document_id);
CREATE INDEX IF NOT EXISTS idx_forensic_reports_case ON public.forensic_reports(court_case_id);
CREATE INDEX IF NOT EXISTS idx_forensic_reports_matter ON public.forensic_reports(matter_id);
CREATE INDEX IF NOT EXISTS idx_forensic_reports_examiner ON public.forensic_reports(examiner_id);

-- Protection Trigger: Finalized forensic records are strictly immutable
CREATE OR REPLACE FUNCTION public.protect_forensic_reports()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_finalized = true THEN
      RAISE EXCEPTION 'Finalized forensic reports are immutable and cannot be deleted under evidence tampering protection rules.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_finalized = true THEN
      RAISE EXCEPTION 'Finalized forensic reports are immutable and cannot be modified under digital evidence rules.';
    END IF;
    IF NEW.is_finalized = true AND (OLD.is_finalized IS NULL OR OLD.is_finalized = false) THEN
      NEW.finalized_at := timezone('utc'::text, now());
    END IF;
    NEW.hashes_match := (LOWER(TRIM(NEW.acquisition_sha256)) = LOWER(TRIM(NEW.verification_sha256)));
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_forensic_reports ON public.forensic_reports;
CREATE TRIGGER trg_protect_forensic_reports
BEFORE UPDATE OR DELETE ON public.forensic_reports
FOR EACH ROW EXECUTE FUNCTION public.protect_forensic_reports();

-- Default calculation on insert
CREATE OR REPLACE FUNCTION public.set_forensic_report_defaults()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hashes_match := (LOWER(TRIM(NEW.acquisition_sha256)) = LOWER(TRIM(NEW.verification_sha256)));
  IF NEW.is_finalized = true AND NEW.finalized_at IS NULL THEN
    NEW.finalized_at := timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_forensic_defaults ON public.forensic_reports;
CREATE TRIGGER trg_set_forensic_defaults
BEFORE INSERT ON public.forensic_reports
FOR EACH ROW EXECUTE FUNCTION public.set_forensic_report_defaults();

-- ==============================================================================
-- 5. EVIDENCE CUSTODY TRANSFERS TABLE (Append-Only Chain of Custody)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.evidence_custody_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE RESTRICT,
  court_case_id UUID REFERENCES public.court_cases(id) ON DELETE SET NULL,
  releasing_party_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  receiving_party_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  transfer_type VARCHAR(32) NOT NULL CHECK (
    transfer_type IN ('INTAKE', 'LAB_ANALYSIS', 'COURT_SUBMISSION', 'VAULT_STORAGE', 'RELEASE')
  ),
  purpose TEXT NOT NULL,
  security_seal_number VARCHAR(64) NOT NULL,
  seal_intact BOOLEAN NOT NULL DEFAULT true,
  sha256_verified BOOLEAN NOT NULL DEFAULT true,
  transfer_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_custody_doc ON public.evidence_custody_transfers(document_id);
CREATE INDEX IF NOT EXISTS idx_custody_matter ON public.evidence_custody_transfers(matter_id);
CREATE INDEX IF NOT EXISTS idx_custody_case ON public.evidence_custody_transfers(court_case_id);
CREATE INDEX IF NOT EXISTS idx_custody_releasing ON public.evidence_custody_transfers(releasing_party_id);
CREATE INDEX IF NOT EXISTS idx_custody_receiving ON public.evidence_custody_transfers(receiving_party_id);
CREATE INDEX IF NOT EXISTS idx_custody_timestamp ON public.evidence_custody_transfers(transfer_timestamp);

-- Immutable Append-Only Enforcement Trigger
CREATE OR REPLACE FUNCTION public.protect_custody_transfers()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'evidence_custody_transfers is an immutable chain of custody ledger. UPDATE and DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_evidence_custody ON public.evidence_custody_transfers;
CREATE TRIGGER trg_protect_evidence_custody
BEFORE UPDATE OR DELETE ON public.evidence_custody_transfers
FOR EACH ROW EXECUTE FUNCTION public.protect_custody_transfers();

REVOKE UPDATE, DELETE, TRUNCATE ON public.evidence_custody_transfers FROM PUBLIC, authenticated, anon;

-- ==============================================================================
-- 6. NOTIFICATIONS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  court_case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (
    type IN ('hearing_scheduled', 'evidence_submitted', 'clearance_decided', 'custody_transferred', 'case_status_updated')
  ),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_case ON public.notifications(court_case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_id, is_read);

-- ==============================================================================
-- 7. REFINED RLS HELPER FUNCTION
-- ==============================================================================

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
    )
    OR EXISTS (
      SELECT 1 FROM public.case_participants cp 
      JOIN public.profiles p ON p.id = user_uuid
      WHERE cp.matter_id = target_matter_id 
        AND cp.user_id = user_uuid 
        AND p.role IN ('judge', 'forensic_team', 'attorney')
        AND p.is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_custody_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 8.1 court_cases Policies
DROP POLICY IF EXISTS "Users view authorized court cases" ON public.court_cases;
CREATE POLICY "Users view authorized court cases"
  ON public.court_cases FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR presiding_judge_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.case_participants cp 
      WHERE cp.court_case_id = id AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.matters m 
      WHERE m.id = matter_id AND (
        m.lead_attorney_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.matter_members mm WHERE mm.matter_id = m.id AND mm.user_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'auditor' AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "Authorized users create court cases" ON public.court_cases;
CREATE POLICY "Authorized users create court cases"
  ON public.court_cases FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.matters m 
      WHERE m.id = matter_id AND m.lead_attorney_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authorized users update court cases" ON public.court_cases;
CREATE POLICY "Authorized users update court cases"
  ON public.court_cases FOR UPDATE
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR presiding_judge_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matters m 
      WHERE m.id = matter_id AND m.lead_attorney_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins delete court cases" ON public.court_cases;
CREATE POLICY "Admins delete court cases"
  ON public.court_cases FOR DELETE
  TO authenticated
  USING (public.is_workspace_admin(auth.uid()));

-- 8.2 case_participants Policies
DROP POLICY IF EXISTS "Users view case participants" ON public.case_participants;
CREATE POLICY "Users view case participants"
  ON public.case_participants FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.court_cases cc 
      WHERE cc.id = court_case_id AND (
        cc.presiding_judge_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.matters m WHERE m.id = cc.matter_id AND m.lead_attorney_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.matter_members mm WHERE mm.matter_id = cc.matter_id AND mm.user_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'auditor' AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins and case leads manage participants" ON public.case_participants;
CREATE POLICY "Admins and case leads manage participants"
  ON public.case_participants FOR ALL
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.court_cases cc 
      WHERE cc.id = court_case_id AND cc.presiding_judge_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.matters m 
      WHERE m.id = matter_id AND m.lead_attorney_id = auth.uid()
    )
  );

-- 8.3 forensic_reports Policies
DROP POLICY IF EXISTS "Authorized users view forensic reports" ON public.forensic_reports;
CREATE POLICY "Authorized users view forensic reports"
  ON public.forensic_reports FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR examiner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'auditor' AND p.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.court_cases cc 
      WHERE cc.id = court_case_id AND cc.presiding_judge_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.case_participants cp 
      WHERE cp.court_case_id = court_case_id 
        AND cp.user_id = auth.uid() 
        AND cp.participant_role != 'victim'
    )
    OR EXISTS (
      SELECT 1 FROM public.matters m 
      WHERE m.id = matter_id AND m.lead_attorney_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Forensic examiners create reports" ON public.forensic_reports;
CREATE POLICY "Forensic examiners create reports"
  ON public.forensic_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_admin(auth.uid())
    OR (
      examiner_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('forensic_team', 'workspace_admin') AND p.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Examiners update own unfinalized reports" ON public.forensic_reports;
CREATE POLICY "Examiners update own unfinalized reports"
  ON public.forensic_reports FOR UPDATE
  TO authenticated
  USING (
    (examiner_id = auth.uid() OR public.is_workspace_admin(auth.uid()))
    AND is_finalized = false
  );

-- 8.4 evidence_custody_transfers Policies
DROP POLICY IF EXISTS "Authorized users view custody transfers" ON public.evidence_custody_transfers;
CREATE POLICY "Authorized users view custody transfers"
  ON public.evidence_custody_transfers FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_admin(auth.uid())
    OR releasing_party_id = auth.uid()
    OR receiving_party_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'auditor' AND p.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.court_cases cc 
      WHERE cc.id = court_case_id AND cc.presiding_judge_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.case_participants cp 
      WHERE cp.court_case_id = court_case_id 
        AND cp.user_id = auth.uid() 
        AND cp.participant_role != 'victim'
    )
  );

DROP POLICY IF EXISTS "Authorized parties record custody transfers" ON public.evidence_custody_transfers;
CREATE POLICY "Authorized parties record custody transfers"
  ON public.evidence_custody_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_admin(auth.uid())
    OR releasing_party_id = auth.uid()
  );

-- 8.5 notifications Policies
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid() OR public.is_workspace_admin(auth.uid()));

DROP POLICY IF EXISTS "Users update own notification read state" ON public.notifications;
CREATE POLICY "Users update own notification read state"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8.6 Extension to matters SELECT: case participants can view associated matters
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
    OR EXISTS (
      SELECT 1 FROM public.case_participants cp
      WHERE cp.matter_id = id AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'auditor' AND p.is_active = true
    )
  );

-- 8.7 Extension to documents SELECT: victims can ONLY view public documents in assigned cases
DROP POLICY IF EXISTS "Victims can view public documents in assigned cases" ON public.documents;
CREATE POLICY "Victims can view public documents in assigned cases"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    classification = 'public'
    AND EXISTS (
      SELECT 1 FROM public.case_participants cp
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cp.matter_id = documents.matter_id
        AND cp.user_id = auth.uid()
        AND p.role = 'victim'
        AND p.is_active = true
    )
  );

-- Extension to document_versions SELECT for victims
DROP POLICY IF EXISTS "Victims can view public document versions in assigned cases" ON public.document_versions;
CREATE POLICY "Victims can view public document versions in assigned cases"
  ON public.document_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.case_participants cp ON cp.matter_id = d.matter_id
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE d.id = document_id
        AND d.classification = 'public'
        AND cp.user_id = auth.uid()
        AND p.role = 'victim'
        AND p.is_active = true
    )
  );

-- ==============================================================================
-- 9. POPULATE INITIAL COURT CASES FOR EXISTING MATTERS (Non-Destructive)
-- ==============================================================================

INSERT INTO public.court_cases (
  id,
  matter_id,
  case_number,
  court_name,
  jurisdiction,
  case_type,
  fir_number,
  police_station,
  presiding_judge_id,
  investigation_officer_id,
  stage,
  filing_date,
  next_hearing_date,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-c001-4001-8001-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111', -- MAT-2024-018: Northstar v. Meridian
    'CRL-ND-2024-00891',
    'High Court of Delhi - Commercial & Cyber Division',
    'New Delhi Judicial District',
    'Corporate IP Theft & Cyber Intrusion',
    'FIR-402/2024',
    'Cyber Crime Police Station, Central District',
    NULL, -- Set once judge profile is seeded
    NULL,
    'Evidence Hearing',
    '2024-03-15',
    '2026-10-15 10:30:00+00',
    '2026-08-10 09:00:00+00',
    '2026-09-08 14:12:00+00'
  ),
  (
    '22222222-c002-4002-8002-222222222222',
    'bbbbbbbb-2222-4bbb-bbbb-222222222222', -- MAT-2024-022: Project Lighthouse
    'INV-DEL-2024-0142',
    'Special CBI & Cyber Investigation Court',
    'New Delhi Cyber Crime Zone',
    'Digital Evidence Tampering & Data Exfiltration',
    'FIR-118/2024',
    'Special Cell Cyber Crime, Lodhi Colony',
    NULL,
    NULL,
    'Investigation',
    '2024-05-20',
    '2026-10-22 14:00:00+00',
    '2026-08-15 10:30:00+00',
    '2026-09-07 20:50:00+00'
  ),
  (
    '33333333-c003-4003-8003-333333333333',
    'cccccccc-3333-4ccc-cccc-333333333333', -- MAT-2024-011: Atlas Vendor Review
    'COM-BLR-2024-0056',
    'City Civil and Sessions Court',
    'Bengaluru Commercial Jurisdiction',
    'Vendor Due Diligence Breach & Fraud',
    'FIR-089/2024',
    'Commercial Crimes Division, Bengaluru',
    NULL,
    NULL,
    'Pre-Trial',
    '2024-06-10',
    '2026-11-05 11:00:00+00',
    '2026-08-05 14:00:00+00',
    '2026-09-05 16:46:00+00'
  ),
  (
    '44444444-c004-4004-8004-444444444444',
    'dddddddd-4444-4ddd-dddd-444444444444', -- MAT-2023-044: Aster Compliance Inquiry
    'REG-MUM-2023-0981',
    'Securities & Appellate Tribunal',
    'Mumbai Appellate Jurisdiction',
    'Regulatory Compliance Inquiry',
    'INQ-44/2023',
    'Regulatory Enforcement Cell, Nariman Point',
    NULL,
    NULL,
    'Closed',
    '2023-10-01',
    NULL,
    '2025-11-12 11:00:00+00',
    '2026-08-21 10:00:00+00'
  )
ON CONFLICT (matter_id) DO NOTHING;

-- Map any other existing matters automatically
INSERT INTO public.court_cases (
  matter_id, case_number, court_name, jurisdiction, case_type, stage, filing_date
)
SELECT
  m.id,
  'CASE-' || m.reference_code,
  'Sessions & Cyber Court of Delhi',
  'Central Cyber Jurisdiction',
  'Criminal Investigation',
  CASE WHEN m.status = 'closed' THEN 'Closed' WHEN m.status = 'archived' THEN 'Closed' ELSE 'Investigation' END,
  m.created_at::date
FROM public.matters m
WHERE NOT EXISTS (SELECT 1 FROM public.court_cases cc WHERE cc.matter_id = m.id)
ON CONFLICT (matter_id) DO NOTHING;
