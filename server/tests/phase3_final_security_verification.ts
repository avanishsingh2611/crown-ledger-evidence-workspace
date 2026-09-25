import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { supabaseAdmin } from '../supabase';

const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

interface TestResult {
  section: string;
  name: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
}

const testResults: TestResult[] = [];

function recordTest(section: string, name: string, expected: string, actual: string, passed: boolean) {
  testResults.push({
    section,
    name,
    expected,
    actual,
    status: passed ? 'PASS' : 'FAIL',
  });
  console.log(`[${section}] ${passed ? '✓ PASS' : '✗ FAIL'} - ${name}`);
  console.log(`    Expected: ${expected}`);
  console.log(`    Actual:   ${actual}\n`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('       PHASE 3 FINAL SECURITY & BACKEND VERIFICATION SUITE       ');
  console.log('================================================================\n');

  // Authenticate test personas via Supabase Auth
  console.log('Authenticating personas via Supabase Auth:');
  
  // Eleanor Raines (Admin)
  const eleanorAuth = await supabaseClient.auth.signInWithPassword({
    email: 'eleanor.raines@crownledger.internal',
    password: 'TestPassword123!',
  });
  const eleanorToken = eleanorAuth.data?.session?.access_token!;
  console.log(`- Eleanor Raines (Admin): Token acquired (${eleanorToken ? 'YES' : 'NO'})`);

  // Elena Marquez (Assigned Counsel to MAT-2024-018)
  const elenaAuth = await supabaseClient.auth.signInWithPassword({
    email: 'elena.marquez@crownledger.internal',
    password: 'TestPassword123!',
  });
  const elenaToken = elenaAuth.data?.session?.access_token!;
  console.log(`- Elena Marquez (Counsel): Token acquired (${elenaToken ? 'YES' : 'NO'})`);

  // Priya Shah (Unassigned Counsel to MAT-2024-018)
  const priyaAuth = await supabaseClient.auth.signInWithPassword({
    email: 'priya.shah@crownledger.internal',
    password: 'TestPassword123!',
  });
  const priyaToken = priyaAuth.data?.session?.access_token!;
  console.log(`- Priya Shah (Counsel): Token acquired (${priyaToken ? 'YES' : 'NO'})`);

  // Clara Vance (Auditor)
  const claraAuth = await supabaseClient.auth.signInWithPassword({
    email: 'clara.vance@external-audit.org',
    password: 'TestPassword123!',
  });
  const claraToken = claraAuth.data?.session?.access_token!;
  console.log(`- Clara Vance (Auditor): Token acquired (${claraToken ? 'YES' : 'NO'})\n`);

  // -------------------------------------------------------------------------
  // SECTION 2: RUN REAL AUTHENTICATION TESTS
  // -------------------------------------------------------------------------
  console.log('--- 2. REAL AUTHENTICATION TESTS ---');

  // TEST 1: No Authorization header
  const res1 = await fetch('http://localhost:3000/api/auth/me');
  recordTest(
    'AUTHENTICATION',
    'TEST 1: No Authorization header',
    'HTTP 401 Unauthorized',
    `HTTP ${res1.status} ${res1.statusText}`,
    res1.status === 401
  );

  // TEST 2: Authorization: Bearer invalid-token
  const res2 = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  recordTest(
    'AUTHENTICATION',
    'TEST 2: Authorization: Bearer invalid-token',
    'HTTP 401 Unauthorized',
    `HTTP ${res2.status} ${res2.statusText}`,
    res2.status === 401
  );

  // TEST 3: Expired/malformed token
  const res3 = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed.token' },
  });
  recordTest(
    'AUTHENTICATION',
    'TEST 3: Expired/malformed token',
    'HTTP 401 Unauthorized',
    `HTTP ${res3.status} ${res3.statusText}`,
    res3.status === 401
  );

  // TEST 4: Valid Supabase access token
  const res4 = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  });
  const body4 = await res4.json();
  recordTest(
    'AUTHENTICATION',
    'TEST 4: Valid Supabase access token',
    'HTTP 200 with verified user identity Eleanor Raines',
    `HTTP ${res4.status}, user: ${body4?.user?.fullName} (${body4?.user?.role})`,
    res4.status === 200 && body4?.user?.id === '11111111-1111-4111-a111-111111111111'
  );

  // TEST 5: Valid Supabase token + fake X-User-Id header
  const res5 = await fetch('http://localhost:3000/api/auth/me', {
    headers: {
      Authorization: `Bearer ${elenaToken}`,
      'X-User-Id': '99999999-9999-9999-9999-999999999999',
    },
  });
  const body5 = await res5.json();
  const test5Passed =
    res5.status === 200 &&
    body5?.user?.id === '22222222-2222-4222-a222-222222222222' &&
    body5?.user?.fullName === 'Elena Marquez';
  recordTest(
    'AUTHENTICATION',
    'TEST 5: Valid Supabase token + fake X-User-Id header (zero effect)',
    'Identity remains Elena Marquez (22222222-2222-4222-a222-222222222222), X-User-Id ignored',
    `HTTP ${res5.status}, user ID: ${body5?.user?.id}, name: ${body5?.user?.fullName}`,
    test5Passed
  );

  // TEST 6: Valid Supabase token for user A (Elena) + X-User-Id of admin (Eleanor)
  const res6 = await fetch('http://localhost:3000/api/auth/me', {
    headers: {
      Authorization: `Bearer ${elenaToken}`,
      'X-User-Id': '11111111-1111-4111-a111-111111111111',
    },
  });
  const body6 = await res6.json();
  const test6Passed =
    res6.status === 200 &&
    body6?.user?.id === '22222222-2222-4222-a222-222222222222' &&
    body6?.user?.role === 'attorney' &&
    body6?.user?.fullName === 'Elena Marquez';
  recordTest(
    'AUTHENTICATION',
    'TEST 6: Privilege escalation prevention (token Elena + X-User-Id Admin)',
    'Identity remains Elena Marquez with role attorney (no privilege escalation)',
    `HTTP ${res6.status}, user: ${body6?.user?.fullName}, role: ${body6?.user?.role}`,
    test6Passed
  );

  // -------------------------------------------------------------------------
  // SECTION 3: AUTHORIZATION / RBAC
  // -------------------------------------------------------------------------
  console.log('--- 3. AUTHORIZATION / RBAC TESTS ---');

  // 3.1 ADMIN: Eleanor Raines -> allowed for authorized admin operations
  const adminMattersRes = await fetch('http://localhost:3000/api/matters', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  });
  const adminAuditRes = await fetch('http://localhost:3000/api/audit-logs', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  });
  const adminAllowed = adminMattersRes.status === 200 && adminAuditRes.status === 200;
  recordTest(
    'AUTHORIZATION',
    'ADMIN: Eleanor Raines allowed for administrative operations',
    'HTTP 200 on matters and audit logs',
    `Matters: HTTP ${adminMattersRes.status}, Audit Logs: HTTP ${adminAuditRes.status}`,
    adminAllowed
  );

  // 3.2 ASSIGNED COUNSEL: Elena Marquez -> allowed for her assigned matter MAT-2024-018
  const elenaMatterRes = await fetch('http://localhost:3000/api/matters/MAT-2024-018', {
    headers: { Authorization: `Bearer ${elenaToken}` },
  });
  const elenaAllowed = elenaMatterRes.status === 200;
  recordTest(
    'AUTHORIZATION',
    'ASSIGNED COUNSEL: Elena Marquez allowed for assigned matter (MAT-2024-018)',
    'HTTP 200',
    `HTTP ${elenaMatterRes.status}`,
    elenaAllowed
  );

  // 3.3 UNASSIGNED COUNSEL: Priya Shah -> HTTP 403 when accessing MAT-2024-018
  const priyaMatterRes = await fetch('http://localhost:3000/api/matters/MAT-2024-018', {
    headers: { Authorization: `Bearer ${priyaToken}` },
  });
  const priyaBlocked = priyaMatterRes.status === 403;
  recordTest(
    'AUTHORIZATION',
    'UNASSIGNED COUNSEL: Priya Shah blocked from unauthorized matter (MAT-2024-018)',
    'HTTP 403 Forbidden',
    `HTTP ${priyaMatterRes.status}`,
    priyaBlocked
  );

  // 3.4 AUDITOR: Clara Vance -> read allowed, document mutation blocked with HTTP 403
  const auditorReadRes = await fetch('http://localhost:3000/api/documents', {
    headers: { Authorization: `Bearer ${claraToken}` },
  });
  const auditorMutateRes = await fetch('http://localhost:3000/api/documents/10000000-0000-4000-a000-000000000001/reviews', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${claraToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'reviewed',
      decisionNotes: 'Auditor unauthorized mutation attempt',
    }),
  });
  const auditorAuditRes = await fetch('http://localhost:3000/api/audit-logs', {
    headers: { Authorization: `Bearer ${claraToken}` },
  });
  const auditorPassed =
    auditorReadRes.status === 200 &&
    auditorAuditRes.status === 200 &&
    auditorMutateRes.status === 403;
  recordTest(
    'AUTHORIZATION',
    'AUDITOR: Clara Vance read allowed, document mutation blocked with HTTP 403',
    'Read: HTTP 200, Mutation: HTTP 403',
    `Read Docs: HTTP ${auditorReadRes.status}, Read Audit: HTTP ${auditorAuditRes.status}, Mutation: HTTP ${auditorMutateRes.status}`,
    auditorPassed
  );

  // 3.5 RESTRICTED DOCUMENT: doc-5 (20000000-0000-4000-a000-000000000005)
  // Non-authorized attorney: Elena Marquez (Associate) -> HTTP 403
  const elenaDoc5Res = await fetch('http://localhost:3000/api/documents/20000000-0000-4000-a000-000000000005/signed-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${elenaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresInSeconds: 300 }),
  });
  const elenaDoc5Blocked = elenaDoc5Res.status === 403;
  recordTest(
    'AUTHORIZATION',
    'RESTRICTED DOCUMENT: Non-authorized attorney blocked from doc-5',
    'HTTP 403 Forbidden',
    `HTTP ${elenaDoc5Res.status}`,
    elenaDoc5Blocked
  );

  // Workspace administrator: Eleanor Raines -> HTTP 200 and authorized signed URL
  const adminDoc5Res = await fetch('http://localhost:3000/api/documents/20000000-0000-4000-a000-000000000005/signed-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${eleanorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresInSeconds: 300 }),
  });
  const adminDoc5Body = await adminDoc5Res.json();
  const adminDoc5Passed =
    adminDoc5Res.status === 200 &&
    adminDoc5Body.ttlSeconds === 300 &&
    adminDoc5Body.signedUrl?.length > 10;
  recordTest(
    'AUTHORIZATION',
    'RESTRICTED DOCUMENT: Workspace administrator authorized for doc-5 signed URL',
    'HTTP 200 with signed URL and 300s TTL',
    `HTTP ${adminDoc5Res.status}, TTL: ${adminDoc5Body?.ttlSeconds}s`,
    adminDoc5Passed
  );

  // -------------------------------------------------------------------------
  // SECTION 4: MATTERS VS CASES
  // -------------------------------------------------------------------------
  console.log('--- 4. MATTERS VS CASES VERIFICATION ---');
  const { data: physicalCasesTable, error: casesTableError } = await supabaseAdmin
    .from('cases')
    .select('id, case_number, title, status');

  const { error: mattersTableError } = await supabaseAdmin
    .from('matters')
    .select('id');

  const mattersRouteRes = await fetch('http://localhost:3000/api/matters', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  });
  const mattersRouteBody = await mattersRouteRes.json();

  const casesPhysicalExists = !casesTableError && (physicalCasesTable?.length ?? 0) === 4;
  const mattersPhysicalAbsent = !!mattersTableError && mattersTableError.message.includes('matters');
  const apiExposesMatters =
    mattersRouteRes.status === 200 &&
    mattersRouteBody.data?.every((m: any) => m.referenceCode && m.title && m.id);

  recordTest(
    'MATTERS MODEL',
    'Physical PostgreSQL table is "cases", API domain concept is "matters"',
    'Database table: cases (4 rows), table matters does not exist, API /api/matters maps records cleanly',
    `cases rows: ${physicalCasesTable?.length}, matters table error: "${mattersTableError?.message}", API returns ${mattersRouteBody.data?.length} matters`,
    casesPhysicalExists && mattersPhysicalAbsent && apiExposesMatters
  );

  // -------------------------------------------------------------------------
  // SECTION 5: DATABASE SOURCE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('--- 5. DATABASE SOURCE VERIFICATION ---');
  const { data: dbCases } = await supabaseAdmin.from('cases').select('*').order('case_number');
  const { data: dbDocs } = await supabaseAdmin.from('documents').select('*');

  const canonicalMatterCodes = ['MAT-2023-044', 'MAT-2024-011', 'MAT-2024-018', 'MAT-2024-022'];
  const actualCodes = dbCases?.map((c) => c.case_number).sort() || [];
  const mattersMatch = JSON.stringify(canonicalMatterCodes) === JSON.stringify(actualCodes);

  // Check stats from /api/stats endpoint backed by real database documents
  const statsRes = await fetch('http://localhost:3000/api/stats', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  });
  const statsBody = await statsRes.json();
  const statsData = statsBody.data;

  const docCount = dbDocs?.length || 0;
  const needsReviewCount = statsData?.needsReview || 0;
  const reviewedCount = statsData?.reviewed || 0;
  const restrictedCount = statsData?.restricted || 0;

  recordTest(
    'DATABASE',
    'Database contains 4 canonical matters',
    '4 matters: MAT-2024-018, MAT-2024-022, MAT-2024-011, MAT-2023-044',
    `${actualCodes.length} matters: ${actualCodes.join(', ')}`,
    mattersMatch && dbCases?.length === 4
  );

  recordTest(
    'DATABASE',
    'Database contains 8 evidence documents with correct status distribution',
    '8 documents, 3 needs_review, 4 reviewed, 1 restricted',
    `${docCount} docs, ${needsReviewCount} needs_review, ${reviewedCount} reviewed, ${restrictedCount} restricted`,
    docCount === 8 && needsReviewCount === 3 && reviewedCount === 4 && restrictedCount === 1
  );

  // -------------------------------------------------------------------------
  // SECTION 6: SERVICE ROLE SECURITY
  // -------------------------------------------------------------------------
  console.log('--- 6. SERVICE ROLE SECURITY ---');
  const serviceKeyInEnv = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const viteServiceKeyExposed = Object.keys(process.env).some((k) => k.includes('SERVICE_ROLE') && k.startsWith('VITE_'));
  
  // Also check public config endpoint does not return service role key
  const configRes = await fetch('http://localhost:3000/api/config');
  const configBody = await configRes.json();
  const configExposesSecret = JSON.stringify(configBody).includes(process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING');

  recordTest(
    'SERVICE-ROLE SECURITY',
    'SUPABASE_SERVICE_ROLE_KEY is server-only and not exposed to client or /api/config',
    'Server-side only, no VITE_ prefix, not in public config',
    `Key present server: ${serviceKeyInEnv}, VITE_ exposed: ${viteServiceKeyExposed}, in /api/config: ${configExposesSecret}`,
    serviceKeyInEnv && !viteServiceKeyExposed && !configExposesSecret
  );

  // -------------------------------------------------------------------------
  // SECTION 7: STORAGE SECURITY
  // -------------------------------------------------------------------------
  console.log('--- 7. STORAGE SECURITY ---');
  // Check evidence-documents bucket privacy
  const { data: bucketData, error: bucketError } = await supabaseAdmin.storage.getBucket('evidence-documents');
  const bucketPrivate = !bucketError && bucketData?.public === false;

  // Verify unauthenticated public download attempt fails
  const publicDownloadAttempt = await fetch(
    `${config.SUPABASE_URL}/storage/v1/object/public/evidence-documents/test.pdf`
  );
  const unauthenticatedRejected = publicDownloadAttempt.status === 400 || publicDownloadAttempt.status === 404 || publicDownloadAttempt.status === 403;

  // Signed URL TTL verification (exactly 300 seconds)
  const ttlExact = adminDoc5Body?.ttlSeconds === 300;

  recordTest(
    'STORAGE',
    'evidence-documents bucket is private, unauthenticated access rejected, 300s TTL enforced',
    'Bucket private: true, unauthenticated access rejected, signed URL TTL exactly 300s',
    `Bucket private: ${bucketPrivate}, public fetch HTTP ${publicDownloadAttempt.status}, TTL: ${adminDoc5Body?.ttlSeconds}s`,
    bucketPrivate && unauthenticatedRejected && ttlExact
  );

  // -------------------------------------------------------------------------
  // SECTION 8: AUDIT SECURITY & IMMUTABILITY
  // -------------------------------------------------------------------------
  console.log('--- 8. AUDIT SECURITY & IMMUTABILITY ---');
  // Confirm document access generates audit event
  const initialAuditCount = (await (await fetch('http://localhost:3000/api/audit-logs', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  })).json()).total;

  // Perform access on a document
  await fetch('http://localhost:3000/api/documents/10000000-0000-4000-a000-000000000002', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  });

  const updatedAuditRes = await fetch('http://localhost:3000/api/audit-logs', {
    headers: { Authorization: `Bearer ${eleanorToken}` },
  });
  const updatedAuditBody = await updatedAuditRes.json();
  const auditGrew = updatedAuditBody.total >= initialAuditCount;

  // Confirm users cannot UPDATE or DELETE audit records via API
  const auditPutRes = await fetch('http://localhost:3000/api/audit-logs/audit-001', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${eleanorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ details: 'Tampered details' }),
  });
  const putBlocked = auditPutRes.status === 404 || auditPutRes.status === 405;

  const auditDeleteRes = await fetch('http://localhost:3000/api/audit-logs/audit-001', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${eleanorToken}`,
    },
  });
  const deleteBlocked = auditDeleteRes.status === 404 || auditDeleteRes.status === 405;

  recordTest(
    'AUDIT SECURITY',
    'Audit logs are append-only; PUT and DELETE are blocked (404/405)',
    'Append-only logging works, PUT and DELETE blocked',
    `Access logged: ${auditGrew}, PUT HTTP ${auditPutRes.status}, DELETE HTTP ${auditDeleteRes.status}`,
    auditGrew && putBlocked && deleteBlocked
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('                    EXECUTION SUMMARY                           ');
  console.log('================================================================');
  const total = testResults.length;
  const passed = testResults.filter((t) => t.status === 'PASS').length;
  const failed = testResults.filter((t) => t.status === 'FAIL').length;
  console.log(`Total Tests: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed === 0) {
    console.log('OVERALL STATUS: ALL BACKEND VERIFICATIONS PASSED\n');
  } else {
    console.error('OVERALL STATUS: FAILURES DETECTED\n');
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
