-- ==============================================================================
-- CROWN & LEDGER / SIH 2026 — PRODUCTION DATABASE MIGRATION
-- Migration ID: 20260922000001_safe_profiles_initials_default.sql
-- STEP 3.1A (Step 2): Set Safe Default for public.profiles.initials
--
-- PURPOSE:
-- Fixes PostgreSQL Error 23502 on auth user creation by providing a safe fallback
-- default ('AU' = Authorized User) for public.profiles.initials.
--
-- SAFETY & COMPLIANCE:
-- - Preserves NOT NULL constraint on public.profiles.initials.
-- - Does NOT drop or disable any constraints or triggers.
-- - Does NOT modify existing user profiles or data.
-- - Does NOT weaken Row Level Security (RLS).
-- - Non-destructive and idempotent.
-- ==============================================================================

ALTER TABLE public.profiles
  ALTER COLUMN initials SET DEFAULT 'AU';
