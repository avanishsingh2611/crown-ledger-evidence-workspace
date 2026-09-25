import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

interface CheckResult {
  suite: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: CheckResult[] = [];

function record(suite: string, name: string, passed: boolean, details: string) {
  results.push({ suite, name, passed, details });
  const icon = passed ? '✓' : '✗';
  console.log(`[${suite}] ${icon} ${name}: ${details}`);
}

async function runPhase4IntegrationVerification() {
  console.log('======================================================');
  console.log('   PHASE 4 FRONTEND TO BACKEND INTEGRATION VERIFICATION');
  console.log('======================================================\n');

  // 1. Authenticate Eleanor via Supabase Auth (Anon key)
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: 'eleanor.raines@crownledger.internal',
    password: 'TestPassword123!',
  });

  if (authError || !authData?.session) {
    record('AUTH', 'Frontend Supabase Client Auth Sign-in', false, authError?.message || 'No session');
    return;
  }
  const token = authData.session.access_token;
  record('AUTH', 'Frontend Supabase Client Auth Sign-in', true, `Obtained verified JWT for Eleanor Raines (Admin)`);

  // 2. Connect GET /api/auth/me
  const authMeRes = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const authMe = await authMeRes.json();
  const authMePassed =
    authMeRes.status === 200 &&
    authMe.user?.id === '11111111-1111-4111-a111-111111111111' &&
    authMe.user?.role === 'workspace_admin';
  record(
    'USER/PROFILE',
    'GET /api/auth/me returns authenticated identity & profiles',
    authMePassed,
    `Status: ${authMeRes.status}, User: ${authMe.user?.fullName} (${authMe.user?.role}), Profiles: ${authMe.availableProfiles?.length}`
  );

  // 3. Connect GET /api/matters
  const mattersRes = await fetch('http://localhost:3000/api/matters', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const mattersData = await mattersRes.json();
  const mattersPassed = mattersRes.status === 200 && mattersData.data?.length === 4;
  record(
    'MATTERS',
    'GET /api/matters returns all 4 cases with real database counts',
    mattersPassed,
    `Total matters: ${mattersData.total || mattersData.data?.length}`
  );

  // 4. Connect GET /api/documents
  const docsRes = await fetch('http://localhost:3000/api/documents', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const docsData = await docsRes.json();
  const docsPassed = docsRes.status === 200 && docsData.data?.length === 8;
  record(
    'DOCUMENTS',
    'GET /api/documents returns all 8 legal evidence records',
    docsPassed,
    `Total docs: ${docsData.total || docsData.data?.length}`
  );

  // 5. Connect Search GET /api/documents/search
  const searchRes = await fetch('http://localhost:3000/api/documents/search?q=Outside', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const searchData = await searchRes.json();
  const searchPassed = searchRes.status === 200 && searchData.data?.length > 0;
  record(
    'SEARCH',
    'GET /api/documents/search filters records dynamically',
    searchPassed,
    `Query "Outside" matched ${searchData.data?.length} doc(s): "${searchData.data?.[0]?.title}"`
  );

  // 6. Connect Dashboard & Metrics GET /api/stats
  const statsRes = await fetch('http://localhost:3000/api/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const statsData = await statsRes.json();
  const s = statsData.data;
  const statsPassed =
    statsRes.status === 200 &&
    s.totalDocuments === 8 &&
    s.matterCounts?.length === 4 &&
    s.needsReview === 3 &&
    s.reviewed === 4 &&
    s.restricted === 1;
  record(
    'METRICS',
    'GET /api/stats matches verified database counts (Total: 8, Matters: 4, Needs Review: 3, Reviewed: 4, Restricted: 1)',
    statsPassed,
    `Total: ${s?.totalDocuments}, NeedsReview: ${s?.needsReview}, Reviewed: ${s?.reviewed}, Restricted: ${s?.restricted}`
  );

  // 7. Connect Review Workflow & Certification
  const targetDocId = '10000000-0000-4000-a000-000000000002'; // Source Code Extract
  const reviewRes = await fetch(`http://localhost:3000/api/documents/${targetDocId}/reviews`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'reviewed',
      decisionNotes: 'Phase 4 integration review certification test.',
    }),
  });
  const reviewData = await reviewRes.json();
  const reviewPassed = reviewRes.status === 200 && reviewData.success === true;
  record(
    'REVIEWS',
    'POST /api/documents/:documentId/reviews certifies document review record',
    reviewPassed,
    `Status: ${reviewRes.status}, Message: "${reviewData.message}"`
  );

  // 8. Connect Restricted Documents & Signed URL Generation
  const signedUrlRes = await fetch(`http://localhost:3000/api/documents/${targetDocId}/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      versionNumber: 1,
      expiresInSeconds: 300,
    }),
  });
  const signedUrlData = await signedUrlRes.json();
  const signedUrlPassed =
    signedUrlRes.status === 200 &&
    signedUrlData.ttlSeconds === 300 &&
    signedUrlData.signedUrl?.length > 10;
  record(
    'STORAGE',
    'POST /api/documents/:documentId/signed-url issues verified 300s TTL signed download URL',
    signedUrlPassed,
    `Status: ${signedUrlRes.status}, TTL: ${signedUrlData.ttlSeconds}s, EventId: ${signedUrlData.securityEventId}`
  );

  // 9. Connect Audit Logs GET /api/audit-logs
  const auditRes = await fetch('http://localhost:3000/api/audit-logs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const auditData = await auditRes.json();
  const auditPassed = auditRes.status === 200 && auditData.data?.length > 0;
  record(
    'AUDIT',
    'GET /api/audit-logs connects to real custodial audit trail ledger',
    auditPassed,
    `Total logs: ${auditData.total || auditData.data?.length}`
  );

  // 10. Verify Elena (Assigned Counsel) vs Priya (Unassigned Counsel) Ethical Wall
  const { data: priyaAuth } = await supabaseClient.auth.signInWithPassword({
    email: 'priya.shah@crownledger.internal',
    password: 'TestPassword123!',
  });
  const priyaToken = priyaAuth?.session?.access_token;
  const priyaMatterRes = await fetch('http://localhost:3000/api/matters/MAT-2024-018', {
    headers: { Authorization: `Bearer ${priyaToken}` },
  });
  const ethicalWallPassed = priyaMatterRes.status === 403;
  record(
    'SECURITY',
    'Ethical wall enforcement returns 403 for unassigned counsel',
    ethicalWallPassed,
    `Priya status: ${priyaMatterRes.status} (Forbidden as expected)`
  );

  // Summary
  console.log('\n======================================================');
  console.log('                 INTEGRATION SUMMARY');
  console.log('======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Checks: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('Overall Status: PHASE 4 FRONTEND-TO-BACKEND INTEGRATION VERIFIED (PASS)\n');
  } else {
    console.error('Overall Status: INTEGRATION FAILED (FAIL)\n');
    process.exit(1);
  }
}

runPhase4IntegrationVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
