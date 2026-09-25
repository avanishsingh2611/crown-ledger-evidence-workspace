import fs from 'fs';
import path from 'path';

function validateMigration() {
  console.log('====================================================');
  console.log('STEP 2B — MIGRATION & SCHEMA VALIDATION SUITE');
  console.log('====================================================\n');

  const migrationPath = path.resolve('supabase/migrations/20260921000001_sih_court_and_roles_schema.sql');
  const seedPath = path.resolve('supabase/seed.sql');

  if (!fs.existsSync(migrationPath)) throw new Error('Migration file not found: ' + migrationPath);
  if (!fs.existsSync(seedPath)) throw new Error('Seed file not found: ' + seedPath);

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  // 1. Validate Roles Extension
  console.log('1. VALIDATING USER ROLE ENUM EXTENSIONS:');
  const expectedRoles = ['judge', 'victim', 'forensic_team'];
  for (const role of expectedRoles) {
    const hasRole = migrationSql.includes(`'${role}'`);
    console.log(`  - Role [${role}]: ${hasRole ? '✓ PRESENT' : '✗ MISSING'}`);
    if (!hasRole) throw new Error(`Role missing from migration: ${role}`);
  }

  // 2. Validate New Tables
  console.log('\n2. VALIDATING NEW DATABASE TABLES:');
  const expectedTables = [
    'public.court_cases',
    'public.case_participants',
    'public.forensic_reports',
    'evidence_custody_transfers',
    'public.notifications',
  ];
  for (const table of expectedTables) {
    const hasTable = migrationSql.includes(table);
    console.log(`  - Table [${table}]: ${hasTable ? '✓ CREATED' : '✗ MISSING'}`);
    if (!hasTable) throw new Error(`Table missing from migration: ${table}`);
  }

  // 3. Validate RLS Activation
  console.log('\n3. VALIDATING ROW LEVEL SECURITY (RLS):');
  for (const table of expectedTables) {
    const rlsRegex = new RegExp(`ALTER TABLE\\s+public\\.${table.replace('public.', '')}\\s+ENABLE ROW LEVEL SECURITY;`);
    const rlsEnabled = rlsRegex.test(migrationSql);
    console.log(`  - RLS on [${table}]: ${rlsEnabled ? '✓ ENABLED' : '✗ MISSING'}`);
    if (!rlsEnabled) throw new Error(`RLS missing for ${table}`);
  }

  // 4. Validate Append-Only & Tamper Resistance
  console.log('\n4. VALIDATING TAMPER RESISTANCE & APPEND-ONLY TRIGGERS:');
  const hasCustodyTrigger = migrationSql.includes('trg_protect_evidence_custody');
  const hasForensicTrigger = migrationSql.includes('trg_protect_forensic_reports');
  const hasParticipantSync = migrationSql.includes('trg_sync_case_participant');
  const hasCustodyRevoke = migrationSql.includes('REVOKE UPDATE, DELETE, TRUNCATE ON public.evidence_custody_transfers');

  console.log(`  - Append-only trigger on evidence_custody_transfers: ${hasCustodyTrigger ? '✓ VERIFIED' : '✗ MISSING'}`);
  console.log(`  - Immutability trigger on finalized forensic_reports: ${hasForensicTrigger ? '✓ VERIFIED' : '✗ MISSING'}`);
  console.log(`  - Participant synchronization trigger: ${hasParticipantSync ? '✓ VERIFIED' : '✗ MISSING'}`);
  console.log(`  - Direct REVOKE on evidence_custody_transfers: ${hasCustodyRevoke ? '✓ VERIFIED' : '✗ MISSING'}`);

  if (!hasCustodyTrigger || !hasForensicTrigger || !hasParticipantSync || !hasCustodyRevoke) {
    throw new Error('Tamper resistance verification failed');
  }

  // 5. Validate Demo Identities in Seed
  console.log('\n5. VALIDATING DEMO IDENTITIES IN SEED:');
  const demoUsers = [
    { name: 'Hon. Justice V. K. Sharma', role: 'judge', email: 'justice.sharma@court.gov.in' },
    { name: 'Dr. Amitav Sen', role: 'forensic_team', email: 'forensics.sen@cfsl.gov.in' },
    { name: 'Ananya Roy', role: 'victim', email: 'ananya.roy@citizen.org' },
  ];

  for (const user of demoUsers) {
    const inAuth = seedSql.includes(user.email);
    const inProfiles = seedSql.includes(user.name);
    console.log(`  - Demo user ${user.name} (${user.role}): ${inAuth && inProfiles ? '✓ VERIFIED IN AUTH & PROFILES' : '✗ MISSING'}`);
    if (!inAuth || !inProfiles) throw new Error(`Missing demo user in seed: ${user.name}`);
  }

  // 6. Validate Seed Password Standardization
  console.log('\n6. VALIDATING STANDARDIZED DEMO PASSWORD IN SEED:');
  const hasStandardPass = seedSql.includes('CrownLedgerDemo!2026#Secure');
  console.log(`  - Demo password standardization: ${hasStandardPass ? '✓ VERIFIED' : '✗ FAILED'}`);
  if (!hasStandardPass) throw new Error('Standard password not found in seed.sql');

  // 7. Validate Court Cases Linkage to Matters
  console.log('\n7. VALIDATING COURT CASES 1:1 MATTER LINKAGE:');
  const case1 = seedSql.includes('CRL-ND-2024-00891') && seedSql.includes('aaaaaaaa-1111-4aaa-aaaa-111111111111');
  const case2 = seedSql.includes('INV-DEL-2024-0142') && seedSql.includes('bbbbbbbb-2222-4bbb-bbbb-222222222222');
  const case3 = seedSql.includes('COM-BLR-2024-0056') && seedSql.includes('cccccccc-3333-4ccc-cccc-333333333333');
  const case4 = seedSql.includes('REG-MUM-2023-0981') && seedSql.includes('dddddddd-4444-4ddd-dddd-444444444444');

  console.log(`  - Case CRL-ND-2024-00891 -> MAT-2024-018: ${case1 ? '✓ LINKED' : '✗ FAILED'}`);
  console.log(`  - Case INV-DEL-2024-0142 -> MAT-2024-022: ${case2 ? '✓ LINKED' : '✗ FAILED'}`);
  console.log(`  - Case COM-BLR-2024-0056 -> MAT-2024-011: ${case3 ? '✓ LINKED' : '✗ FAILED'}`);
  console.log(`  - Case REG-MUM-2023-0981 -> MAT-2023-044: ${case4 ? '✓ LINKED' : '✗ FAILED'}`);

  if (!case1 || !case2 || !case3 || !case4) {
    throw new Error('Court cases linkage to matters failed');
  }

  // 8. Validate Victim Strict Isolation
  console.log('\n8. VALIDATING VICTIM RESTRICTED DOCUMENT ISOLATION:');
  const victimDocPolicy = migrationSql.includes('Victims can view public documents in assigned cases');
  const victimVersionPolicy = migrationSql.includes('Victims can view public document versions in assigned cases');
  const victimExcludedFromMembers = migrationSql.includes("IF NEW.participant_role = 'victim' THEN");

  console.log(`  - Victim public-only documents RLS policy: ${victimDocPolicy ? '✓ VERIFIED' : '✗ MISSING'}`);
  console.log(`  - Victim public-only document versions RLS policy: ${victimVersionPolicy ? '✓ VERIFIED' : '✗ MISSING'}`);
  console.log(`  - Victim excluded from blanket matter_members sync: ${victimExcludedFromMembers ? '✓ VERIFIED' : '✗ MISSING'}`);

  if (!victimDocPolicy || !victimVersionPolicy || !victimExcludedFromMembers) {
    throw new Error('Victim strict isolation verification failed');
  }

  console.log('\n====================================================');
  console.log('✓ ALL STEP 2B MIGRATION & SCHEMA CHECKS PASSED');
  console.log('====================================================\n');
}

validateMigration();
