import dotenv from 'dotenv';
import { supabaseAdmin } from '../server/supabase';

dotenv.config();

async function seedInvestigatingOfficer() {
  console.log('--- Aligning Investigating Officer Persona (Inspector Rajesh Kumar) ---');

  const officerId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const officerEmail = 'officer.kumar@delhipolice.gov.in';
  const officerPassword = 'CrownLedgerDemo!2026#Secure';
  const officerName = 'Inspector Rajesh Kumar';
  const officerInitials = 'RK';
  const officerTitle = 'Senior Investigating Officer · Cyber Crime Cell';

  // 1. Ensure user exists in Supabase Auth
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = userList?.users.find((u) => u.email === officerEmail || u.id === officerId);

  if (!existingUser) {
    console.log(`Creating Auth user for ${officerEmail}...`);
    const { data: createdUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      id: officerId,
      email: officerEmail,
      password: officerPassword,
      email_confirm: true,
      user_metadata: {
        full_name: officerName,
        initials: officerInitials,
        role: 'investigating_officer',
        title: officerTitle,
      },
    });

    if (authErr) {
      console.warn(`Auth creation note: ${authErr.message}`);
    } else {
      console.log(`✓ Auth user created: ${createdUser?.user?.id}`);
    }
  } else {
    console.log(`✓ Auth user already exists: ${existingUser.id}`);
  }

  // 2. Ensure profile exists in public.profiles
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', officerId)
    .maybeSingle();

  if (!existingProfile) {
    console.log(`Inserting profile for ${officerName}...`);
    // Use 'LAWYER' or 'investigating_officer' safely
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: officerId,
        email: officerEmail,
        full_name: officerName,
        initials: officerInitials,
        role: 'LAWYER', // Database enum compatibility; auth middleware resolves to investigating_officer
        is_active: true,
      });

    if (profileErr) {
      console.warn(`Profile insert note: ${profileErr.message}`);
    } else {
      console.log(`✓ Profile inserted`);
    }
  } else {
    console.log(`✓ Profile already exists`);
  }

  // 3. Link as investigation_officer_id on court_cases
  const caseId1 = '11111111-c001-4001-8001-111111111111'; // CRL-ND-2024-00891
  const matterId1 = 'aaaaaaaa-1111-4aaa-aaaa-111111111111';

  const caseId2 = '22222222-c002-4002-8002-222222222222'; // INV-DEL-2024-0142
  const matterId2 = 'bbbbbbbb-2222-4bbb-bbbb-222222222222';

  await supabaseAdmin
    .from('court_cases')
    .update({ investigation_officer_id: officerId })
    .in('id', [caseId1, caseId2]);

  console.log(`✓ Assigned as investigation_officer_id on court cases`);

  // 4. Ensure case participant record
  const { data: part1 } = await supabaseAdmin
    .from('case_participants')
    .select('id')
    .eq('court_case_id', caseId1)
    .eq('user_id', officerId)
    .maybeSingle();

  if (!part1) {
    const { error: partErr } = await supabaseAdmin
      .from('case_participants')
      .insert({
        court_case_id: caseId1,
        matter_id: matterId1,
        user_id: officerId,
        participant_role: 'investigating_officer',
        is_primary: true,
      });

    if (partErr) {
      console.warn(`Case participant 1 note: ${partErr.message}`);
    } else {
      console.log(`✓ Added to case_participants for case 1`);
    }
  }

  const { data: part2 } = await supabaseAdmin
    .from('case_participants')
    .select('id')
    .eq('court_case_id', caseId2)
    .eq('user_id', officerId)
    .maybeSingle();

  if (!part2) {
    const { error: partErr2 } = await supabaseAdmin
      .from('case_participants')
      .insert({
        court_case_id: caseId2,
        matter_id: matterId2,
        user_id: officerId,
        participant_role: 'investigating_officer',
        is_primary: true,
      });

    if (partErr2) {
      console.warn(`Case participant 2 note: ${partErr2.message}`);
    } else {
      console.log(`✓ Added to case_participants for case 2`);
    }
  }

  // 5. Ensure matter_members access (trigger does this automatically, but ensure for idempotency)
  try {
    await supabaseAdmin
      .from('matter_members')
      .upsert([
        { matter_id: matterId1, user_id: officerId, access_role: 'contributor' },
        { matter_id: matterId2, user_id: officerId, access_role: 'contributor' },
      ]);
  } catch {}

  console.log(`✓ Matter membership confirmed`);
  console.log(`\nInvestigating Officer Persona ready:`);
  console.log(`- Email: ${officerEmail}`);
  console.log(`- Password: ${officerPassword}`);
  console.log(`- Cases: CRL-ND-2024-00891, INV-DEL-2024-0142`);
}

seedInvestigatingOfficer()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
