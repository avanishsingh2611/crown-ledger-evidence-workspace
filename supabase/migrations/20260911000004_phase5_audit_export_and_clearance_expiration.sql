-- ==============================================================================
-- CROWN & LEDGER — EVIDENCE WORKSPACE
-- Migration: Audit Export Action & Clearance Expiration
-- Migration ID: 20260911000004_phase5_audit_export_and_clearance_expiration.sql
-- ==============================================================================

-- 1. Extend audit_action_type enum with audit_exported
DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'audit_exported';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 2. Add optional approved_until column to restricted_access_requests
ALTER TABLE public.restricted_access_requests
  ADD COLUMN IF NOT EXISTS approved_until TIMESTAMPTZ;

-- 3. Add index on approved_until for fast expiration lookups
CREATE INDEX IF NOT EXISTS idx_restricted_req_approved_until
  ON public.restricted_access_requests(approved_until)
  WHERE approved_until IS NOT NULL;
