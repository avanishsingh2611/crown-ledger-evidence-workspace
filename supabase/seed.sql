-- ==============================================================================
-- CROWN & LEDGER — EVIDENCE WORKSPACE
-- Seed Data File: Exact Reproduction of Screenshot Telemetry & Audit Stream
-- File: supabase/seed.sql
-- ==============================================================================

-- 1. Workspace Configuration
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
  268435456000, -- 250 GB
  107374182400  -- 100 GB
)
ON CONFLICT (id) DO UPDATE SET
  firm_name = EXCLUDED.firm_name,
  workspace_name = EXCLUDED.workspace_name,
  storage_quota_bytes = EXCLUDED.storage_quota_bytes,
  local_vault_quota_bytes = EXCLUDED.local_vault_quota_bytes;

-- 2. Mock auth.users (Ensures Foreign Key Integrity in Supabase)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-1111-4111-a111-111111111111',
    'eleanor.raines@crownledger.internal',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Eleanor Raines","initials":"ER","role":"workspace_admin"}',
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '22222222-2222-4222-a222-222222222222',
    'elena.marquez@crownledger.internal',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Elena Marquez","initials":"EM","role":"attorney"}',
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '33333333-3333-4333-a333-333333333333',
    'darius.cole@crownledger.internal',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Darius Cole","initials":"DC","role":"attorney"}',
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '44444444-4444-4444-a444-444444444444',
    'priya.shah@crownledger.internal',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Priya Shah","initials":"PS","role":"attorney"}',
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '55555555-5555-4555-a555-555555555555',
    'jon.bell@crownledger.internal',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Jon Bell","initials":"JB","role":"attorney"}',
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '77777777-7777-4777-a777-777777777777',
    'justice.sharma@court.gov.in',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Hon. Justice V. K. Sharma","initials":"VS","role":"judge","title":"Presiding Sessions Judge"}',
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '88888888-8888-4888-a888-888888888888',
    'forensics.sen@cfsl.gov.in',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Amitav Sen","initials":"AS","role":"forensic_team","title":"Chief Forensic Cyber Examiner"}',
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '99999999-9999-4999-a999-999999999999',
    'ananya.roy@citizen.org',
    crypt('CrownLedgerDemo!2026#Secure', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ananya Roy","initials":"AR","role":"victim","title":"Complainant / Protected Citizen"}',
    '2026-08-01 08:00:00+00',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email = EXCLUDED.email,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- 3. Profiles (Exactly 5 User Profiles)
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  initials,
  role,
  avatar_url,
  is_active,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-1111-4111-a111-111111111111',
    'eleanor.raines@crownledger.internal',
    'Eleanor Raines',
    'ER',
    'workspace_admin',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '22222222-2222-4222-a222-222222222222',
    'elena.marquez@crownledger.internal',
    'Elena Marquez',
    'EM',
    'attorney',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '33333333-3333-4333-a333-333333333333',
    'darius.cole@crownledger.internal',
    'Darius Cole',
    'DC',
    'attorney',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '44444444-4444-4444-a444-444444444444',
    'priya.shah@crownledger.internal',
    'Priya Shah',
    'PS',
    'attorney',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '55555555-5555-4555-a555-555555555555',
    'jon.bell@crownledger.internal',
    'Jon Bell',
    'JB',
    'attorney',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '77777777-7777-4777-a777-777777777777',
    'justice.sharma@court.gov.in',
    'Hon. Justice V. K. Sharma',
    'VS',
    'judge',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '88888888-8888-4888-a888-888888888888',
    'forensics.sen@cfsl.gov.in',
    'Dr. Amitav Sen',
    'AS',
    'forensic_team',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  ),
  (
    '99999999-9999-4999-a999-999999999999',
    'ananya.roy@citizen.org',
    'Ananya Roy',
    'AR',
    'victim',
    NULL,
    true,
    '2026-08-01 08:00:00+00',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  initials = EXCLUDED.initials,
  role = EXCLUDED.role,
  updated_at = now();

-- 4. Matters (Exactly 4 Matters: 3 Active, 1 Archived)
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
  title = EXCLUDED.title,
  client_name = EXCLUDED.client_name,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  updated_at = EXCLUDED.updated_at;

-- 5. Matter Members (Access Grants)
INSERT INTO public.matter_members (matter_id, user_id, access_role, granted_by)
VALUES
  ('aaaaaaaa-1111-4aaa-aaaa-111111111111', '22222222-2222-4222-a222-222222222222', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('aaaaaaaa-1111-4aaa-aaaa-111111111111', '11111111-1111-4111-a111-111111111111', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('bbbbbbbb-2222-4bbb-bbbb-222222222222', '33333333-3333-4333-a333-333333333333', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('bbbbbbbb-2222-4bbb-bbbb-222222222222', '22222222-2222-4222-a222-222222222222', 'contributor', '33333333-3333-4333-a333-333333333333'),
  ('cccccccc-3333-4ccc-cccc-333333333333', '44444444-4444-4444-a444-444444444444', 'lead', '11111111-1111-4111-a111-111111111111'),
  ('dddddddd-4444-4ddd-dddd-444444444444', '55555555-5555-4555-a555-555555555555', 'lead', '11111111-1111-4111-a111-111111111111')
ON CONFLICT (matter_id, user_id) DO NOTHING;

-- 6. Documents (Exactly 8 Canonical Documents)
-- Distribution: MAT-2024-018: 3 | MAT-2024-022: 2 | MAT-2024-011: 2 | MAT-2023-044: 1
-- Review Status: needs_review: 3 | reviewed: 4 | restricted: 1
INSERT INTO public.documents (
  id,
  matter_id,
  title,
  classification,
  review_status,
  current_version_number,
  tags,
  is_archived,
  created_by,
  created_at,
  updated_at
)
VALUES
  -- 1. Outside Counsel Memo (MAT-2024-018, Privileged, v3, needs_review)
  (
    '10000000-0000-4000-a000-000000000001',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    'Outside Counsel Memo — Preliminary Findings',
    'privileged',
    'needs_review',
    3,
    ARRAY['memo', 'outside-counsel', 'privileged'],
    false,
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    '2026-08-20 10:00:00+00',
    '2026-09-08 14:12:00+00'
  ),
  -- 2. Interview Transcript — R. Patel (MAT-2024-018, Confidential, v1, reviewed)
  (
    '10000000-0000-4000-a000-000000000002',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    'Interview Transcript — R. Patel',
    'confidential',
    'reviewed',
    1,
    ARRAY['witness', 'transcript', 'deposition'],
    false,
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    '2026-09-07 11:30:00+00',
    '2026-09-07 11:30:00+00'
  ),
  -- 3. Evidence Index — Batch 04 (MAT-2024-018, Internal, v2, restricted)
  (
    '10000000-0000-4000-a000-000000000003',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    'Evidence Index — Batch 04',
    'internal',
    'restricted',
    2,
    ARRAY['index', 'evidence', 'batch-04'],
    false,
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    '2026-09-01 09:00:00+00',
    '2026-09-06 15:55:00+00'
  ),
  -- 4. Forensic Imaging Report (MAT-2024-022, Confidential, v1, needs_review)
  (
    '20000000-0000-4000-a000-000000000004',
    'bbbbbbbb-2222-4bbb-bbbb-222222222222',
    'Forensic Imaging Report',
    'confidential',
    'needs_review',
    1,
    ARRAY['forensics', 'drive-image', 'report'],
    false,
    '33333333-3333-4333-a333-333333333333', -- Darius Cole
    '2026-09-07 20:50:00+00',
    '2026-09-07 20:50:00+00'
  ),
  -- 5. Chain of Custody Log (MAT-2024-022, Internal, v4, reviewed)
  (
    '20000000-0000-4000-a000-000000000005',
    'bbbbbbbb-2222-4bbb-bbbb-222222222222',
    'Chain of Custody Log',
    'internal',
    'reviewed',
    4,
    ARRAY['custody', 'audit', 'compliance'],
    false,
    '33333333-3333-4333-a333-333333333333', -- Darius Cole
    '2026-08-25 09:15:00+00',
    '2026-09-05 19:18:00+00'
  ),
  -- 6. Vendor Due Diligence Summary (MAT-2024-011, Confidential, v1, reviewed)
  (
    '30000000-0000-4000-a000-000000000006',
    'cccccccc-3333-4ccc-cccc-333333333333',
    'Vendor Due Diligence Summary',
    'confidential',
    'reviewed',
    1,
    ARRAY['due-diligence', 'vendor', 'atlas'],
    false,
    '44444444-4444-4444-a444-444444444444', -- Priya Shah
    '2026-09-05 16:46:00+00',
    '2026-09-05 16:46:00+00'
  ),
  -- 7. Master Services Agreement — Schedule B (MAT-2024-011, Confidential, v1, needs_review)
  -- [INFERRED DEMO RECORD #1: Fulfills MAT-2024-011 2-file requirement & needs_review count of 3]
  (
    '30000000-0000-4000-a000-000000000007',
    'cccccccc-3333-4ccc-cccc-333333333333',
    'Master Services Agreement — Schedule B',
    'confidential',
    'needs_review',
    1,
    ARRAY['contract', 'msa', 'schedule-b'],
    false,
    '44444444-4444-4444-a444-444444444444', -- Priya Shah
    '2026-09-04 14:10:00+00',
    '2026-09-04 14:10:00+00'
  ),
  -- 8. Regulatory Response & Audit Findings (MAT-2023-044, Internal, v1, reviewed)
  -- [INFERRED DEMO RECORD #2: Fulfills MAT-2023-044 1-file requirement & reviewed count of 4]
  (
    '40000000-0000-4000-a000-000000000008',
    'dddddddd-4444-4ddd-dddd-444444444444',
    'Regulatory Response & Audit Findings',
    'internal',
    'reviewed',
    1,
    ARRAY['regulatory', 'audit', 'findings'],
    false,
    '55555555-5555-4555-a555-555555555555', -- Jon Bell
    '2026-08-21 10:00:00+00',
    '2026-08-21 10:00:00+00'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  classification = EXCLUDED.classification,
  review_status = EXCLUDED.review_status,
  current_version_number = EXCLUDED.current_version_number,
  updated_at = EXCLUDED.updated_at;

-- 7. Document Versions (Preserves Real Version History)
INSERT INTO public.document_versions (
  id,
  document_id,
  version_number,
  original_filename,
  file_extension,
  mime_type,
  file_size_bytes,
  storage_path,
  sha256_checksum,
  change_summary,
  uploaded_by,
  created_at
)
VALUES
  -- Document 1 (Outside Counsel Memo: v1, v2, v3)
  (
    '10000001-0001-4000-b000-000000000001',
    '10000000-0000-4000-a000-000000000001',
    1,
    'Outside_Counsel_Memo_Draft1.pdf',
    'pdf',
    'application/pdf',
    1887436, -- 1.8 MB
    'evidence-documents/MAT-2024-018/doc-1/v1/Outside_Counsel_Memo_Draft1.pdf',
    '7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c',
    'Initial outside counsel preliminary briefing.',
    '22222222-2222-4222-a222-222222222222',
    '2026-08-20 10:00:00+00'
  ),
  (
    '10000001-0001-4000-b000-000000000002',
    '10000000-0000-4000-a000-000000000001',
    2,
    'Outside_Counsel_Memo_Revisions.pdf',
    'pdf',
    'application/pdf',
    2516582, -- 2.4 MB
    'evidence-documents/MAT-2024-018/doc-1/v2/Outside_Counsel_Memo_Revisions.pdf',
    '6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c',
    'Revised draft incorporating partner comments.',
    '22222222-2222-4222-a222-222222222222',
    '2026-08-28 15:30:00+00'
  ),
  (
    '10000001-0001-4000-b000-000000000003',
    '10000000-0000-4000-a000-000000000001',
    3,
    'Outside_Counsel_Memo_Preliminary_Findings.pdf',
    'pdf',
    'application/pdf',
    2936012, -- 2.8 MB (As shown in screenshot!)
    'evidence-documents/MAT-2024-018/doc-1/v3/Outside_Counsel_Memo_Preliminary_Findings.pdf',
    '4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c',
    'Version 3 finalized outside counsel preliminary findings.',
    '22222222-2222-4222-a222-222222222222',
    '2026-09-08 14:12:00+00'
  ),

  -- Document 2 (Interview Transcript — R. Patel: v1)
  (
    '10000002-0002-4000-b000-000000000001',
    '10000000-0000-4000-a000-000000000002',
    1,
    'Interview_Transcript_R_Patel.docx',
    'docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    1468006, -- 1.4 MB (As shown in screenshot!)
    'evidence-documents/MAT-2024-018/doc-2/v1/Interview_Transcript_R_Patel.docx',
    '10a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a493827',
    'Certified transcription of investigative deposition.',
    '22222222-2222-4222-a222-222222222222',
    '2026-09-07 11:30:00+00'
  ),

  -- Document 3 (Evidence Index — Batch 04: v1, v2)
  (
    '10000003-0003-4000-b000-000000000001',
    '10000000-0000-4000-a000-000000000003',
    1,
    'Evidence_Index_Batch_04_Draft.xlsx',
    'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    634880, -- 620 KB
    'evidence-documents/MAT-2024-018/doc-3/v1/Evidence_Index_Batch_04_Draft.xlsx',
    'c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8',
    'Initial batch evidence index tabulation.',
    '22222222-2222-4222-a222-222222222222',
    '2026-09-01 09:00:00+00'
  ),
  (
    '10000003-0003-4000-b000-000000000002',
    '10000000-0000-4000-a000-000000000003',
    2,
    'Evidence_Index_Batch_04.xlsx',
    'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    862208, -- 842 KB (As shown in screenshot!)
    'evidence-documents/MAT-2024-018/doc-3/v2/Evidence_Index_Batch_04.xlsx',
    'f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5',
    'Version 2 with verified digital custodial checksums.',
    '22222222-2222-4222-a222-222222222222',
    '2026-09-06 15:55:00+00'
  ),

  -- Document 4 (Forensic Imaging Report: v1)
  (
    '20000004-0004-4000-b000-000000000001',
    '20000000-0000-4000-a000-000000000004',
    1,
    'Forensic_Imaging_Report.pdf',
    'pdf',
    'application/pdf',
    19084083, -- 18.2 MB (As shown in screenshot!)
    'evidence-documents/MAT-2024-022/doc-4/v1/Forensic_Imaging_Report.pdf',
    'd0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1',
    'Bitstream forensic image verification report.',
    '33333333-3333-4333-a333-333333333333',
    '2026-09-07 20:50:00+00'
  ),

  -- Document 5 (Chain of Custody Log: v1, v2, v3, v4)
  (
    '20000005-0005-4000-b000-000000000001',
    '20000000-0000-4000-a000-000000000005',
    1,
    'Chain_of_Custody_v1.csv',
    'csv',
    'text/csv',
    102400,
    'evidence-documents/MAT-2024-022/doc-5/v1/Chain_of_Custody_v1.csv',
    'e5c4d3b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6',
    'Initial device intake.',
    '33333333-3333-4333-a333-333333333333',
    '2026-08-25 09:15:00+00'
  ),
  (
    '20000005-0005-4000-b000-000000000002',
    '20000000-0000-4000-a000-000000000005',
    2,
    'Chain_of_Custody_v2.csv',
    'csv',
    'text/csv',
    184320,
    'evidence-documents/MAT-2024-022/doc-5/v2/Chain_of_Custody_v2.csv',
    'b2a10f9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3',
    'Lab intake records added.',
    '33333333-3333-4333-a333-333333333333',
    '2026-08-30 14:20:00+00'
  ),
  (
    '20000005-0005-4000-b000-000000000003',
    '20000000-0000-4000-a000-000000000005',
    3,
    'Chain_of_Custody_v3.csv',
    'csv',
    'text/csv',
    266240,
    'evidence-documents/MAT-2024-022/doc-5/v3/Chain_of_Custody_v3.csv',
    '9e8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f',
    'Third-party examiner transfer.',
    '33333333-3333-4333-a333-333333333333',
    '2026-09-02 17:00:00+00'
  ),
  (
    '20000005-0005-4000-b000-000000000004',
    '20000000-0000-4000-a000-000000000005',
    4,
    'Chain_of_Custody_Log.csv',
    'csv',
    'text/csv',
    335872, -- 328 KB (As shown in screenshot!)
    'evidence-documents/MAT-2024-022/doc-5/v4/Chain_of_Custody_Log.csv',
    '8d7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e',
    'Version 4 full chain of custody log with no exceptions.',
    '33333333-3333-4333-a333-333333333333',
    '2026-09-05 19:18:00+00'
  ),

  -- Document 6 (Vendor Due Diligence Summary: v1)
  (
    '30000006-0006-4000-b000-000000000001',
    '30000000-0000-4000-a000-000000000006',
    1,
    'Vendor_Due_Diligence_Summary.pdf',
    'pdf',
    'application/pdf',
    1153433, -- 1.1 MB
    'evidence-documents/MAT-2024-011/doc-6/v1/Vendor_Due_Diligence_Summary.pdf',
    '7c6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d',
    'Completed vendor compliance and due diligence executive summary.',
    '44444444-4444-4444-a444-444444444444',
    '2026-09-05 16:46:00+00'
  ),

  -- Document 7 (Master Services Agreement — Schedule B: v1) [INFERRED RECORD #1]
  (
    '30000007-0007-4000-b000-000000000001',
    '30000000-0000-4000-a000-000000000007',
    1,
    'MSA_Schedule_B_Atlas.pdf',
    'pdf',
    'application/pdf',
    3774873, -- 3.6 MB
    'evidence-documents/MAT-2024-011/doc-7/v1/MSA_Schedule_B_Atlas.pdf',
    '6b5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c',
    'Schedule B services and data governance annex.',
    '44444444-4444-4444-a444-444444444444',
    '2026-09-04 14:10:00+00'
  ),

  -- Document 8 (Regulatory Response & Audit Findings: v1) [INFERRED RECORD #2]
  (
    '40000008-0008-4000-b000-000000000001',
    '40000000-0000-4000-a000-000000000008',
    1,
    'Regulatory_Response_Audit_Findings.pdf',
    'pdf',
    'application/pdf',
    4404019, -- 4.2 MB
    'evidence-documents/MAT-2023-044/doc-8/v1/Regulatory_Response_Audit_Findings.pdf',
    '5a49382710a9b8c7d6e5f4a3b2c1d0e9f8a7b6c7a8f6e5c4d3b2a10f9e8d7c6b',
    'Archived closing response and compliance sign-off.',
    '55555555-5555-4555-a555-555555555555',
    '2026-08-21 10:00:00+00'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Reviews
INSERT INTO public.reviews (
  id,
  document_id,
  document_version_id,
  assigned_to,
  requested_by,
  status,
  decision_notes,
  completed_at,
  created_at,
  updated_at
)
VALUES
  -- Review for Document 4 (Forensic Imaging Report - requested Sep 7, 8:50 PM by Darius Cole, assigned to Elena Marquez)
  (
    'aaaa0001-0001-4000-c000-000000000001',
    '20000000-0000-4000-a000-000000000004',
    '20000004-0004-4000-b000-000000000001',
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    '33333333-3333-4333-a333-333333333333', -- Darius Cole
    'pending',
    NULL,
    NULL,
    '2026-09-07 20:50:00+00',
    '2026-09-07 20:50:00+00'
  ),
  -- Review for Document 5 (Chain of Custody Log - completed Sep 5, 7:18 PM by Jon Bell: "No exceptions found")
  (
    'aaaa0002-0002-4000-c000-000000000002',
    '20000000-0000-4000-a000-000000000005',
    '20000005-0005-4000-b000-000000000004',
    '55555555-5555-4555-a555-555555555555', -- Jon Bell
    '33333333-3333-4333-a333-333333333333', -- Darius Cole
    'completed',
    'No exceptions found',
    '2026-09-05 19:18:00+00',
    '2026-09-02 10:00:00+00',
    '2026-09-05 19:18:00+00'
  ),
  -- Review for Document 2 (Interview Transcript — R. Patel - completed)
  (
    'aaaa0003-0003-4000-c000-000000000003',
    '10000000-0000-4000-a000-000000000002',
    '10000002-0002-4000-b000-000000000001',
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    '22222222-2222-4222-a222-222222222222',
    'completed',
    'Transcript verified against audio recording.',
    '2026-09-07 14:00:00+00',
    '2026-09-07 11:30:00+00',
    '2026-09-07 14:00:00+00'
  ),
  -- Review for Document 6 (Vendor Due Diligence Summary - completed)
  (
    'aaaa0004-0004-4000-c000-000000000004',
    '30000000-0000-4000-a000-000000000006',
    '30000006-0006-4000-b000-000000000001',
    '44444444-4444-4444-a444-444444444444', -- Priya Shah
    '44444444-4444-4444-a444-444444444444',
    'completed',
    'All corporate governance and vendor filings certified.',
    '2026-09-05 16:46:00+00',
    '2026-09-04 09:00:00+00',
    '2026-09-05 16:46:00+00'
  ),
  -- Review for Document 8 (Regulatory Response & Audit Findings - completed)
  (
    'aaaa0005-0005-4000-c000-000000000005',
    '40000000-0000-4000-a000-000000000008',
    '40000008-0008-4000-b000-000000000001',
    '55555555-5555-4555-a555-555555555555', -- Jon Bell
    '55555555-5555-4555-a555-555555555555',
    'completed',
    'Regulatory matter concluded and archived.',
    '2026-08-21 10:00:00+00',
    '2026-08-20 09:00:00+00',
    '2026-08-21 10:00:00+00'
  )
ON CONFLICT (id) DO NOTHING;

-- 9. Audit Logs (The Exact 5 Chronological Screenshot Events)
-- Disables trigger temporarily during seeding if needed, or inserts directly
INSERT INTO public.audit_logs (
  id,
  actor_id,
  matter_id,
  document_id,
  action,
  target_name,
  details,
  metadata,
  created_at
)
VALUES
  -- 1. Sep 8, 2:12 PM - uploaded · Outside Counsel Memo — Preliminary Findings (Elena Marquez)
  (
    'f0000001-0001-4000-d000-000000000001',
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    'aaaaaaaa-1111-4aaa-aaaa-111111111111', -- MAT-2024-018
    '10000000-0000-4000-a000-000000000001', -- Outside Counsel Memo
    'uploaded',
    'Outside Counsel Memo — Preliminary Findings',
    'Version 3 · 2.8 MB',
    '{"version": 3, "file_size_bytes": 2936012, "mime_type": "application/pdf"}'::jsonb,
    '2026-09-08 14:12:00+00'
  ),
  -- 2. Sep 7, 8:50 PM - review requested · Forensic Imaging Report (Darius Cole)
  (
    'f0000002-0002-4000-d000-000000000002',
    '33333333-3333-4333-a333-333333333333', -- Darius Cole
    'bbbbbbbb-2222-4bbb-bbbb-222222222222', -- MAT-2024-022
    '20000000-0000-4000-a000-000000000004', -- Forensic Imaging Report
    'review_requested',
    'Forensic Imaging Report',
    'Assigned to Elena Marquez',
    '{"assigned_to_id": "22222222-2222-4222-a222-222222222222", "assigned_to_name": "Elena Marquez"}'::jsonb,
    '2026-09-07 20:50:00+00'
  ),
  -- 3. Sep 7, 4:46 PM - accessed · Vendor Due Diligence Summary (Priya Shah)
  (
    'f0000003-0003-4000-d000-000000000003',
    '44444444-4444-4444-a444-444444444444', -- Priya Shah
    'cccccccc-3333-4ccc-cccc-333333333333', -- MAT-2024-011
    '30000000-0000-4000-a000-000000000006', -- Vendor Due Diligence Summary
    'accessed',
    'Vendor Due Diligence Summary',
    'Read access · privileged workspace',
    '{"access_type": "read", "workspace": "privileged"}'::jsonb,
    '2026-09-07 16:46:00+00'
  ),
  -- 4. Sep 6, 3:55 PM - classification changed · Evidence Index — Batch 04 (Elena Marquez)
  (
    'f0000004-0004-4000-d000-000000000004',
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    'aaaaaaaa-1111-4aaa-aaaa-111111111111', -- MAT-2024-018
    '10000000-0000-4000-a000-000000000003', -- Evidence Index — Batch 04
    'classification_changed',
    'Evidence Index — Batch 04',
    'Confidential → Internal',
    '{"old_classification": "confidential", "new_classification": "internal"}'::jsonb,
    '2026-09-06 15:55:00+00'
  ),
  -- 5. Sep 5, 7:18 PM - review completed · Chain of Custody Log (Jon Bell)
  (
    'f0000005-0005-4000-d000-000000000005',
    '55555555-5555-4555-a555-555555555555', -- Jon Bell
    'bbbbbbbb-2222-4bbb-bbbb-222222222222', -- MAT-2024-022
    '20000000-0000-4000-a000-000000000005', -- Chain of Custody Log
    'review_completed',
    'Chain of Custody Log',
    'No exceptions found',
    '{"decision": "completed", "notes": "No exceptions found"}'::jsonb,
    '2026-09-05 19:18:00+00'
  )
ON CONFLICT (id) DO NOTHING;

-- 10. Download Security Events (Custodial tracking corresponding to verified read access)
INSERT INTO public.download_security_events (
  id,
  document_id,
  document_version_id,
  user_id,
  matter_id,
  action_type,
  ip_address,
  user_agent,
  signed_url_expires_at,
  download_verified,
  metadata,
  created_at
)
VALUES
  (
    'e0000001-0001-4000-e000-000000000001',
    '30000000-0000-4000-a000-000000000006', -- Vendor Due Diligence Summary
    '30000006-0006-4000-b000-000000000001', -- Version 1
    '44444444-4444-4444-a444-444444444444', -- Priya Shah
    'cccccccc-3333-4ccc-cccc-333333333333', -- MAT-2024-011
    'signed_url_generated',
    '192.168.1.42',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    '2026-09-07 16:51:00+00',
    true,
    '{"reason": "privileged_custodial_review", "matter_reference": "MAT-2024-011"}'::jsonb,
    '2026-09-07 16:46:00+00'
  )
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 11. Court Cases (1:1 Linkage to Matters)
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
    'aaaaaaaa-1111-4aaa-aaaa-111111111111', -- Northstar v. Meridian
    'CRL-ND-2024-00891',
    'High Court of Delhi - Commercial & Cyber Division',
    'New Delhi Judicial District',
    'Corporate IP Theft & Cyber Intrusion',
    'FIR-402/2024',
    'Cyber Crime Police Station, Central District',
    '77777777-7777-4777-a777-777777777777', -- Hon. Justice V. K. Sharma
    '55555555-5555-4555-a555-555555555555', -- Jon Bell
    'Evidence Hearing',
    '2024-03-15',
    '2026-10-15 10:30:00+00',
    '2026-08-10 09:00:00+00',
    '2026-09-08 14:12:00+00'
  ),
  (
    '22222222-c002-4002-8002-222222222222',
    'bbbbbbbb-2222-4bbb-bbbb-222222222222', -- Project Lighthouse
    'INV-DEL-2024-0142',
    'Special CBI & Cyber Investigation Court',
    'New Delhi Cyber Crime Zone',
    'Digital Evidence Tampering & Data Exfiltration',
    'FIR-118/2024',
    'Special Cell Cyber Crime, Lodhi Colony',
    '77777777-7777-4777-a777-777777777777',
    '33333333-3333-4333-a333-333333333333', -- Darius Cole
    'Investigation',
    '2024-05-20',
    '2026-10-22 14:00:00+00',
    '2026-08-15 10:30:00+00',
    '2026-09-07 20:50:00+00'
  ),
  (
    '33333333-c003-4003-8003-333333333333',
    'cccccccc-3333-4ccc-cccc-333333333333', -- Atlas Vendor Review
    'COM-BLR-2024-0056',
    'City Civil and Sessions Court',
    'Bengaluru Commercial Jurisdiction',
    'Vendor Due Diligence Breach & Fraud',
    'FIR-089/2024',
    'Commercial Crimes Division, Bengaluru',
    '77777777-7777-4777-a777-777777777777',
    '44444444-4444-4444-a444-444444444444', -- Priya Shah
    'Pre-Trial',
    '2024-06-10',
    '2026-11-05 11:00:00+00',
    '2026-08-05 14:00:00+00',
    '2026-09-05 16:46:00+00'
  ),
  (
    '44444444-c004-4004-8004-444444444444',
    'dddddddd-4444-4ddd-dddd-444444444444', -- Aster Compliance Inquiry
    'REG-MUM-2023-0981',
    'Securities & Appellate Tribunal',
    'Mumbai Appellate Jurisdiction',
    'Regulatory Compliance Inquiry',
    'INQ-44/2023',
    'Regulatory Enforcement Cell, Nariman Point',
    '77777777-7777-4777-a777-777777777777',
    '55555555-5555-4555-a555-555555555555',
    'Closed',
    '2023-10-01',
    NULL,
    '2025-11-12 11:00:00+00',
    '2026-08-21 10:00:00+00'
  )
ON CONFLICT (id) DO UPDATE SET
  presiding_judge_id = EXCLUDED.presiding_judge_id,
  investigation_officer_id = EXCLUDED.investigation_officer_id,
  stage = EXCLUDED.stage,
  next_hearing_date = EXCLUDED.next_hearing_date,
  updated_at = EXCLUDED.updated_at;

-- ==============================================================================
-- 12. Case Participants (Multi-Role Case Mapping)
-- ==============================================================================
INSERT INTO public.case_participants (
  id,
  court_case_id,
  matter_id,
  user_id,
  participant_role,
  is_primary,
  assigned_by,
  assigned_at
)
VALUES
  -- Case 1: CRL-ND-2024-00891
  (
    'a1111111-0001-4001-8001-000000000001',
    '11111111-c001-4001-8001-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '77777777-7777-4777-a777-777777777777', -- Judge Sharma
    'judge',
    true,
    '11111111-1111-4111-a111-111111111111',
    '2026-08-10 09:30:00+00'
  ),
  (
    'a1111111-0001-4001-8001-000000000002',
    '11111111-c001-4001-8001-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    'defense_lawyer',
    true,
    '11111111-1111-4111-a111-111111111111',
    '2026-08-10 09:30:00+00'
  ),
  (
    'a1111111-0001-4001-8001-000000000003',
    '11111111-c001-4001-8001-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '88888888-8888-4888-a888-888888888888', -- Dr. Amitav Sen
    'forensic_examiner',
    true,
    '77777777-7777-4777-a777-777777777777',
    '2026-08-12 11:00:00+00'
  ),
  (
    'a1111111-0001-4001-8001-000000000004',
    '11111111-c001-4001-8001-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '99999999-9999-4999-a999-999999999999', -- Ananya Roy
    'victim',
    true,
    '77777777-7777-4777-a777-777777777777',
    '2026-08-10 10:00:00+00'
  ),
  (
    'a1111111-0001-4001-8001-000000000005',
    '11111111-c001-4001-8001-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '55555555-5555-4555-a555-555555555555', -- Jon Bell
    'investigating_officer',
    true,
    '77777777-7777-4777-a777-777777777777',
    '2026-08-10 10:00:00+00'
  )
ON CONFLICT (court_case_id, user_id, participant_role) DO NOTHING;

-- ==============================================================================
-- 13. Forensic Reports (Tamper-Proof Hardware & Extracted Evidence Records)
-- ==============================================================================
INSERT INTO public.forensic_reports (
  id,
  document_id,
  court_case_id,
  matter_id,
  examiner_id,
  lab_name,
  device_type,
  device_make_model,
  device_serial_number,
  extraction_tool,
  extraction_tool_version,
  acquisition_sha256,
  verification_sha256,
  hashes_match,
  intake_condition,
  findings_summary,
  section_65b_certified,
  is_finalized,
  created_at,
  finalized_at
)
VALUES
  (
    'b1111111-0001-4001-8001-000000000001',
    '10000000-0000-4000-a000-000000000001', -- Outside Counsel Memo
    '11111111-c001-4001-8001-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '88888888-8888-4888-a888-888888888888', -- Dr. Amitav Sen
    'Central Forensic Science Laboratory (CFSL) Cyber Evidence Wing',
    'NVMe Solid State Drive',
    'Samsung 980 PRO 2TB',
    'S5GXNF0R812390V',
    'FTK Imager Professional',
    'v4.7.1.2',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    true,
    'Tamper-evident evidence bag #CFSL-2024-912 sealed with red tamper tape intact.',
    'Bit-stream physical image successfully extracted. SHA-256 verification hash exactly matches acquisition hash. System security logs reveal unauthorized exfiltration session on 2024-03-12.',
    true,
    true,
    '2026-08-15 14:30:00+00',
    '2026-08-15 16:00:00+00'
  )
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 14. Evidence Custody Transfers (Append-Only Chain of Custody)
-- ==============================================================================
INSERT INTO public.evidence_custody_transfers (
  id,
  document_id,
  matter_id,
  court_case_id,
  releasing_party_id,
  receiving_party_id,
  transfer_type,
  purpose,
  security_seal_number,
  seal_intact,
  sha256_verified,
  transfer_timestamp,
  notes,
  created_at
)
VALUES
  (
    'c1111111-0001-4001-8001-000000000001',
    '10000000-0000-4000-a000-000000000001',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '11111111-c001-4001-8001-111111111111',
    '55555555-5555-4555-a555-555555555555', -- Jon Bell (IO)
    '88888888-8888-4888-a888-888888888888', -- Dr. Amitav Sen (Examiner)
    'INTAKE',
    'Physical evidence hardware intake for digital forensic image extraction and hash verification.',
    'CFSL-SEAL-88210A',
    true,
    true,
    '2026-08-12 11:30:00+00',
    'Chain of custody initiated at CFSL Cyber Evidence Wing.',
    '2026-08-12 11:30:00+00'
  ),
  (
    'c1111111-0001-4001-8001-000000000002',
    '10000000-0000-4000-a000-000000000001',
    'aaaaaaaa-1111-4aaa-aaaa-111111111111',
    '11111111-c001-4001-8001-111111111111',
    '88888888-8888-4888-a888-888888888888', -- Dr. Amitav Sen
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez (Defense Counsel)
    'COURT_SUBMISSION',
    'Submission of certified forensic imaging manifest and Section 65B compliance report to counsel for court submission.',
    'CFSL-SEAL-88210B',
    true,
    true,
    '2026-08-16 10:00:00+00',
    'Verified and counter-signed under digital forensic audit protocol.',
    '2026-08-16 10:00:00+00'
  )
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 15. Notifications
-- ==============================================================================
INSERT INTO public.notifications (
  id,
  recipient_id,
  court_case_id,
  title,
  message,
  type,
  is_read,
  created_at
)
VALUES
  (
    'd1111111-0001-4001-8001-000000000001',
    '77777777-7777-4777-a777-777777777777', -- Hon. Justice V. K. Sharma
    '11111111-c001-4001-8001-111111111111',
    'Forensic Report Lodged — CRL-ND-2024-00891',
    'Dr. Amitav Sen has filed a Section 65B certified forensic report regarding the extracted server telemetry image.',
    'evidence_submitted',
    false,
    '2026-08-16 10:15:00+00'
  ),
  (
    'd1111111-0001-4001-8001-000000000002',
    '22222222-2222-4222-a222-222222222222', -- Elena Marquez
    '11111111-c001-4001-8001-111111111111',
    'Hearing Date Scheduled',
    'Hon. Justice V. K. Sharma has listed case CRL-ND-2024-00891 for Evidence Hearing on October 15, 2026 at 10:30 AM.',
    'hearing_scheduled',
    false,
    '2026-08-18 09:00:00+00'
  ),
  (
    'd1111111-0001-4001-8001-000000000003',
    '99999999-9999-4999-a999-999999999999', -- Ananya Roy (Victim)
    '11111111-c001-4001-8001-111111111111',
    'Case Status Update: Evidence Hearing Scheduled',
    'Your case CRL-ND-2024-00891 has progressed to Evidence Hearing. Next judicial hearing: October 15, 2026.',
    'case_status_updated',
    false,
    '2026-08-18 09:05:00+00'
  )
ON CONFLICT (id) DO NOTHING;


