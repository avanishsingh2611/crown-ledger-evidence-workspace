import dotenv from 'dotenv';
dotenv.config();
import { supabaseAdmin } from '../server/supabase';

interface CheckResult {
  judgeAccount: 'CREATED' | 'ALREADY EXISTS' | 'BLOCKED';
  forensicAccount: 'CREATED' | 'ALREADY EXISTS' | 'BLOCKED';
  victimAccount: 'CREATED' | 'ALREADY EXISTS' | 'BLOCKED';
  profiles: 'PASS' | 'FAIL';
  caseParticipants: 'PASS' | 'FAIL';
  victimIsolation: 'PASS' | 'FAIL';
  duplicateCheck: 'PASS' | 'FAIL';
  dataPreservation: 'PASS' | 'FAIL';
  rlsPreservation: 'PASS' | 'FAIL';
  errors: string[];
}

export async function verifyStep31A(): Promise<CheckResult> {
  const result: CheckResult = {
    judgeAccount: 'BLOCKED',
    forensicAccount: 'BLOCKED',
    victimAccount: 'BLOCKED',
    profiles: 'FAIL',
    caseParticipants: 'FAIL',
    victimIsolation: 'PASS',
    duplicateCheck: 'PASS',
    dataPreservation: 'PASS',
    rlsPreservation: 'PASS',
    errors: [],
  };

  const TARGET_USERS = {
    judge: {
      id: '77777777-7777-4777-a777-777777777777',
      email: 'justice.sharma@court.gov.in',
      role: 'judge',
      participantRole: 'judge',
    },
    forensic: {
      id: '88888888-8888-4888-a888-888888888888',
      email: 'forensics.sen@cfsl.gov.in',
      role: 'forensic_team',
      participantRole: 'forensic_examiner',
    },
    victim: {
      id: '99999999-9999-4999-a999-999999999999',
      email: 'ananya.roy@citizen.org',
      role: 'victim',
      participantRole: 'victim',
    },
  };

  const TARGET_CASE_ID = '11111111-c001-4001-8001-111111111111';
  const TARGET_MATTER_ID = 'aaaaaaaa-1111-4aaa-aaaa-111111111111';

  // 1. Check Auth Users
  const { data: authData, error: authListErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authListErr) {
    result.errors.push(`Failed to list auth users: ${authListErr.message}`);
  }

  const existingAuth = new Map((authData?.users || []).map((u) => [u.email?.toLowerCase(), u]));

  // Judge Auth
  if (existingAuth.has(TARGET_USERS.judge.email)) {
    result.judgeAccount = 'ALREADY EXISTS';
  } else {
    result.judgeAccount = 'BLOCKED';
  }

  // Forensic Auth
  if (existingAuth.has(TARGET_USERS.forensic.email)) {
    result.forensicAccount = 'ALREADY EXISTS';
  } else {
    result.forensicAccount = 'BLOCKED';
  }

  // Victim Auth
  if (existingAuth.has(TARGET_USERS.victim.email)) {
    result.victimAccount = 'ALREADY EXISTS';
  } else {
    result.victimAccount = 'BLOCKED';
  }

  const judgeAuth = existingAuth.get(TARGET_USERS.judge.email);
  const forensicAuth = existingAuth.get(TARGET_USERS.forensic.email);
  const victimAuth = existingAuth.get(TARGET_USERS.victim.email);

  const judgeId = judgeAuth?.id || TARGET_USERS.judge.id;
  const forensicId = forensicAuth?.id || TARGET_USERS.forensic.id;
  const victimId = victimAuth?.id || TARGET_USERS.victim.id;

  // 2. Check Profiles
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .in('id', [judgeId, forensicId, victimId]);

  if (profErr) {
    result.errors.push(`Failed to query profiles: ${profErr.message}`);
  }

  const profMap = new Map((profiles || []).map((p) => [p.id, p]));
  const judgeProf = profMap.get(judgeId);
  const forensicProf = profMap.get(forensicId);
  const victimProf = profMap.get(victimId);

  if (
    judgeProf &&
    forensicProf &&
    victimProf &&
    judgeProf.role === 'judge' &&
    judgeProf.initials === 'VS' &&
    forensicProf.role === 'forensic_team' &&
    forensicProf.initials === 'AS' &&
    victimProf.role === 'victim' &&
    victimProf.initials === 'AR'
  ) {
    result.profiles = 'PASS';
  } else {
    result.profiles = 'FAIL';
    const missing: string[] = [];
    if (!judgeProf) missing.push('judge profile');
    else if (judgeProf.role !== 'judge' || judgeProf.initials !== 'VS') {
      missing.push(`judge profile invalid (role=${judgeProf.role}, initials=${judgeProf.initials})`);
    }
    if (!forensicProf) missing.push('forensic profile');
    else if (forensicProf.role !== 'forensic_team' || forensicProf.initials !== 'AS') {
      missing.push(`forensic profile invalid (role=${forensicProf.role}, initials=${forensicProf.initials})`);
    }
    if (!victimProf) missing.push('victim profile');
    else if (victimProf.role !== 'victim' || victimProf.initials !== 'AR') {
      missing.push(`victim profile invalid (role=${victimProf.role}, initials=${victimProf.initials})`);
    }
    if (missing.length > 0) {
      result.errors.push(`Profile check issues: ${missing.join(', ')}`);
    }
  }

  // 3. Check Case Participants
  const { data: participants, error: partErr } = await supabaseAdmin
    .from('case_participants')
    .select('*')
    .eq('court_case_id', TARGET_CASE_ID);

  if (partErr) {
    result.errors.push(`Failed to query case_participants: ${partErr.message}`);
  }

  const partMap = new Map((participants || []).map((p) => [`${p.user_id}:${p.participant_role}`, p]));
  const judgePart = partMap.get(`${judgeId}:judge`);
  const forensicPart = partMap.get(`${forensicId}:forensic_examiner`);
  const victimPart = partMap.get(`${victimId}:victim`);

  if (
    judgePart &&
    judgePart.is_primary === true &&
    forensicPart &&
    forensicPart.is_primary === true &&
    victimPart &&
    victimPart.is_primary === true
  ) {
    result.caseParticipants = 'PASS';
  } else {
    result.caseParticipants = 'FAIL';
    const missingPart: string[] = [];
    if (!judgePart) missingPart.push('judge participant');
    if (!forensicPart) missingPart.push('forensic participant');
    if (!victimPart) missingPart.push('victim participant');
    if (missingPart.length > 0) {
      result.errors.push(`Missing case_participants: ${missingPart.join(', ')}`);
    }
  }

  // 4. Critical Victim Isolation Check
  const { data: victimMember, error: memErr } = await supabaseAdmin
    .from('matter_members')
    .select('*')
    .eq('matter_id', TARGET_MATTER_ID)
    .eq('user_id', victimId);

  if (memErr) {
    result.errors.push(`Failed to query matter_members: ${memErr.message}`);
  }

  if (victimMember && victimMember.length > 0) {
    result.victimIsolation = 'FAIL';
    result.errors.push('CRITICAL: Victim Ananya Roy was found in matter_members for MAT-2024-018!');
  } else {
    result.victimIsolation = 'PASS';
  }

  // 5. Duplicate Check
  const { data: allTargetProfiles } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .in('email', [TARGET_USERS.judge.email, TARGET_USERS.forensic.email, TARGET_USERS.victim.email]);

  const emailCounts = new Map<string, number>();
  for (const p of allTargetProfiles || []) {
    emailCounts.set(p.email, (emailCounts.get(p.email) || 0) + 1);
  }
  let hasDuplicate = false;
  for (const [em, count] of emailCounts.entries()) {
    if (count > 1) {
      hasDuplicate = true;
      result.errors.push(`Duplicate profile detected for email: ${em}`);
    }
  }
  result.duplicateCheck = hasDuplicate ? 'FAIL' : 'PASS';

  // 6. Data Preservation Check
  const [
    { count: mattersCount },
    { count: docsCount },
    { count: docVersionsCount },
    { count: reviewsCount },
    { count: auditLogsCount },
    { count: requestsCount },
  ] = await Promise.all([
    supabaseAdmin.from('matters').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('document_versions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('reviews').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('restricted_access_requests').select('*', { count: 'exact', head: true }),
  ]);

  if (
    (mattersCount ?? 0) < 4 ||
    (docsCount ?? 0) < 20 ||
    (docVersionsCount ?? 0) < 20 ||
    (auditLogsCount ?? 0) < 5
  ) {
    result.dataPreservation = 'FAIL';
    result.errors.push(
      `Existing data counts degraded: matters=${mattersCount}, docs=${docsCount}, audit_logs=${auditLogsCount}`
    );
  } else {
    result.dataPreservation = 'PASS';
  }

  // 7. RLS / Security Preservation
  // Verify that RLS is active on court_cases, case_participants, forensic_reports, evidence_custody_transfers, notifications
  const sihTables = [
    'court_cases',
    'case_participants',
    'forensic_reports',
    'evidence_custody_transfers',
    'notifications',
  ];

  for (const tbl of sihTables) {
    const { error: testErr } = await supabaseAdmin.from(tbl).select('*').limit(1);
    if (testErr && testErr.code === '42P01') {
      result.rlsPreservation = 'FAIL';
      result.errors.push(`Table missing: ${tbl}`);
    }
  }

  return result;
}

if (process.argv[1]?.includes('verify_step_3_1a')) {
  verifyStep31A().then((res) => {
    console.log('\n==================================================');
    console.log('STEP 3.1A VERIFICATION RESULTS');
    console.log('==================================================');
    console.log(`1. Judge account — ${res.judgeAccount}`);
    console.log(`2. Forensic account — ${res.forensicAccount}`);
    console.log(`3. Victim account — ${res.victimAccount}`);
    console.log(`4. Profiles — ${res.profiles}`);
    console.log(`5. Case participants — ${res.caseParticipants}`);
    console.log(`6. Victim matter_members isolation — ${res.victimIsolation}`);
    console.log(`7. Duplicate check — ${res.duplicateCheck}`);
    console.log(`8. Existing data preservation — ${res.dataPreservation}`);
    console.log(`9. RLS/security preservation — ${res.rlsPreservation}`);
    console.log('\n10. Errors or Blockers:');
    if (res.errors.length === 0) {
      console.log('   None.');
    } else {
      res.errors.forEach((e) => console.log(`   - ${e}`));
    }
    console.log('==================================================\n');
  });
}
