import dotenv from 'dotenv';
dotenv.config();
import { supabaseAdmin } from '../server/supabase';

interface DemoUserConfig {
  name: string;
  email: string;
  role: 'judge' | 'forensic_team' | 'victim';
  initials: string;
  targetUuid: string;
  participantRole: 'judge' | 'forensic_examiner' | 'victim';
  isPrimary: boolean;
}

const DEMO_USERS: DemoUserConfig[] = [
  {
    name: 'Hon. Justice V. K. Sharma',
    email: 'justice.sharma@court.gov.in',
    role: 'judge',
    initials: 'VS',
    targetUuid: '77777777-7777-4777-a777-777777777777',
    participantRole: 'judge',
    isPrimary: true,
  },
  {
    name: 'Dr. Amitav Sen',
    email: 'forensics.sen@cfsl.gov.in',
    role: 'forensic_team',
    initials: 'AS',
    targetUuid: '88888888-8888-4888-a888-888888888888',
    participantRole: 'forensic_examiner',
    isPrimary: true,
  },
  {
    name: 'Ananya Roy',
    email: 'ananya.roy@citizen.org',
    role: 'victim',
    initials: 'AR',
    targetUuid: '99999999-9999-4999-a999-999999999999',
    participantRole: 'victim',
    isPrimary: true,
  },
];

const TARGET_CASE_NUMBER = 'CRL-ND-2024-00891';
const TARGET_MATTER_REF = 'MAT-2024-018';

// Standard demo password from repository
const DEMO_PASSWORD = 'CrownLedgerDemo!2026#Secure';

export async function provisionDemoUsers() {
  console.log('==================================================');
  console.log('STEP 3.1A — PROVISION SIH DEMO USERS VIA AUTH API');
  console.log('==================================================\n');

  // 1. Fetch Existing Target Court Case & Matter
  const { data: courtCase, error: caseErr } = await supabaseAdmin
    .from('court_cases')
    .select('id, matter_id, case_number')
    .eq('case_number', TARGET_CASE_NUMBER)
    .single();

  if (caseErr || !courtCase) {
    throw new Error(`Target court case ${TARGET_CASE_NUMBER} not found: ${caseErr?.message}`);
  }

  const { data: matter, error: matterErr } = await supabaseAdmin
    .from('matters')
    .select('id, reference_code')
    .eq('id', courtCase.matter_id)
    .single();

  if (matterErr || !matter) {
    throw new Error(`Underlying matter ${TARGET_MATTER_REF} not found: ${matterErr?.message}`);
  }

  console.log(`✓ Verified target court case: ${courtCase.case_number} (${courtCase.id})`);
  console.log(`✓ Verified underlying matter: ${matter.reference_code} (${matter.id})\n`);

  // 2. Fetch existing auth users to prevent duplicates
  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    throw new Error(`Failed to list auth users: ${listErr.message}`);
  }

  const existingAuthMap = new Map((listData?.users || []).map((u) => [u.email?.toLowerCase(), u]));

  const createdUserIds: Record<string, string> = {};

  // 3. Create or Preserve Auth Users via Auth Admin API
  for (const target of DEMO_USERS) {
    const existing = existingAuthMap.get(target.email.toLowerCase());

    if (existing) {
      console.log(`✓ Auth User already exists: ${target.name} (${target.email}) -> UUID: ${existing.id}`);
      createdUserIds[target.email] = existing.id;
    } else {
      console.log(`Creating Auth User via supabaseAdmin.auth.admin.createUser: ${target.name} (${target.email})...`);

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: target.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: target.name,
          initials: target.initials,
          role: target.role,
        },
        app_metadata: {
          provider: 'email',
          providers: ['email'],
        },
        // Request specific UUID if supported by GoTrue
        ...(target.targetUuid ? { id: target.targetUuid } : {}),
      } as any);

      if (createErr || !newUser.user) {
        console.error(`✗ Failed to create auth user for ${target.email}:`, createErr?.message);
        throw new Error(`Auth user creation failed for ${target.email}: ${createErr?.message}`);
      }

      console.log(`✓ Successfully created auth user: ${target.name} -> UUID: ${newUser.user.id}`);
      createdUserIds[target.email] = newUser.user.id;
    }
  }

  // 4. Verify & Update Profiles
  console.log('\n--- Updating Public Profiles ---');
  for (const target of DEMO_USERS) {
    const userId = createdUserIds[target.email];

    // Check if profile exists (from auth trigger)
    const { data: existingProf } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existingProf) {
      console.log(`Updating profile for ${target.name} (${userId})...`);
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: target.name,
          name: target.name,
          email: target.email,
          role: target.role,
          initials: target.initials,
          status: 'ACTIVE',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateErr) {
        throw new Error(`Failed to update profile for ${target.email}: ${updateErr.message}`);
      }
      console.log(`✓ Profile updated: role=${target.role}, initials=${target.initials}`);
    } else {
      console.log(`Profile not auto-created by trigger; inserting explicitly for ${target.name}...`);
      const { error: insertErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          full_name: target.name,
          name: target.name,
          email: target.email,
          role: target.role,
          initials: target.initials,
          status: 'ACTIVE',
          is_active: true,
        });

      if (insertErr) {
        throw new Error(`Failed to insert profile for ${target.email}: ${insertErr.message}`);
      }
      console.log(`✓ Profile inserted: role=${target.role}, initials=${target.initials}`);
    }
  }

  // 5. Case Participants
  console.log('\n--- Assigning Case Participants for CRL-ND-2024-00891 ---');
  for (const target of DEMO_USERS) {
    const userId = createdUserIds[target.email];

    const { data: existingPart } = await supabaseAdmin
      .from('case_participants')
      .select('id, participant_role, is_primary')
      .eq('court_case_id', courtCase.id)
      .eq('user_id', userId)
      .eq('participant_role', target.participantRole)
      .maybeSingle();

    if (existingPart) {
      console.log(`✓ Case participant already exists: ${target.name} as ${target.participantRole}`);
      if (!existingPart.is_primary && target.isPrimary) {
        await supabaseAdmin
          .from('case_participants')
          .update({ is_primary: true })
          .eq('id', existingPart.id);
        console.log(`  Updated is_primary = true`);
      }
    } else {
      console.log(`Assigning ${target.name} as ${target.participantRole} (primary=${target.isPrimary})...`);
      const { error: partErr } = await supabaseAdmin
        .from('case_participants')
        .insert({
          court_case_id: courtCase.id,
          matter_id: courtCase.matter_id,
          user_id: userId,
          participant_role: target.participantRole,
          is_primary: target.isPrimary,
        });

      if (partErr) {
        throw new Error(`Failed to insert case participant for ${target.email}: ${partErr.message}`);
      }
      console.log(`✓ Assigned ${target.name} as ${target.participantRole}`);
    }
  }

  // 6. Strict Victim Isolation Verification
  console.log('\n--- Verifying Strict Victim Isolation ---');
  const victimUserId = createdUserIds['ananya.roy@citizen.org'];
  const { data: victimInMembers, error: memberCheckErr } = await supabaseAdmin
    .from('matter_members')
    .select('id, access_role')
    .eq('matter_id', courtCase.matter_id)
    .eq('user_id', victimUserId);

  if (memberCheckErr) {
    throw new Error(`Failed to check matter_members: ${memberCheckErr.message}`);
  }

  if (victimInMembers && victimInMembers.length > 0) {
    console.error('CRITICAL VIOLATION: Victim Ananya Roy detected in matter_members!');
    throw new Error('SECURITY VIOLATION: Victim Ananya Roy found in matter_members!');
  } else {
    console.log(`✓ PASS: Victim Ananya Roy (${victimUserId}) is NOT in matter_members for MAT-2024-018.`);
  }

  console.log('\n==================================================');
  console.log('PROVISIONING COMPLETE');
  console.log('==================================================\n');
}

if (process.argv[1]?.includes('provision_sih_demo_users')) {
  provisionDemoUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Provisioning failed:', err.message);
      process.exit(1);
    });
}
