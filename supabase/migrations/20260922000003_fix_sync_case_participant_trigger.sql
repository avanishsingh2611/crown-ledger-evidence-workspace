-- ==============================================================================
-- CROWN & LEDGER / SIH 2026 — PRODUCTION DATABASE MIGRATION
-- Migration ID: 20260922000003_fix_sync_case_participant_trigger.sql
-- STEP 3.1A (Step 5 Fix): Correct column reference in sync_case_participant_to_matter_members
--
-- PURPOSE:
-- Fixes column reference from 'role' to 'access_role' in public.matter_members
-- to allow participant sync for non-victim roles (judge, forensic_examiner).
-- Preserves strict victim isolation.
-- ==============================================================================

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
