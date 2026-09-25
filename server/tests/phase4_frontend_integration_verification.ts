import { config } from '../config';
import { createClient } from '@supabase/supabase-js';

const API_BASE = 'http://localhost:3000';
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

interface TestResult {
  num: number;
  name: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
}

const results: TestResult[] = [];

function record(num: number, name: string, expected: string, actual: string, passed: boolean) {
  results.push({
    num,
    name,
    expected,
    actual,
    status: passed ? 'PASS' : 'FAIL',
  });
  console.log(`[TEST ${num}] ${passed ? '✓ PASS' : '✗ FAIL'} - ${name}`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Actual:   ${actual}\n`);
}

async function runPhase4IntegrationTests() {
  console.log('================================================================');
  console.log('      PHASE 4 FRONTEND / BACKEND INTEGRATION TEST SUITE          ');
  console.log('================================================================\n');

  // TEST 1: Login / Authentication via Supabase Auth
  let eleanorToken = '';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'eleanor.raines@crownledger.internal',
      password: 'TestPassword123!',
    });
    if (error || !data.session) throw new Error(error?.message || 'No session returned');
    eleanorToken = data.session.access_token;
    record(1, 'Login / Authentication via Supabase Auth', 'Valid session token', `Acquired token (len=${eleanorToken.length})`, true);
  } catch (err: any) {
    record(1, 'Login / Authentication via Supabase Auth', 'Valid session token', `Failed: ${err.message}`, false);
  }

  // TEST 2: GET /api/auth/me
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    const passed = res.status === 200 && data.user?.role === 'workspace_admin' && data.availableProfiles?.length >= 4;
    record(2, 'GET /api/auth/me', 'HTTP 200 with role workspace_admin and profiles', `Status: ${res.status}, user: ${data.user?.fullName}, role: ${data.user?.role}, profiles: ${data.availableProfiles?.length}`, passed);
  } catch (err: any) {
    record(2, 'GET /api/auth/me', 'HTTP 200', `Error: ${err.message}`, false);
  }

  // TEST 3: Matters Loading (GET /api/matters)
  let matters: any[] = [];
  try {
    const res = await fetch(`${API_BASE}/api/matters`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    matters = data.data || [];
    const passed = res.status === 200 && matters.length === 4;
    record(3, 'Matters Loading (GET /api/matters)', 'HTTP 200 with exactly 4 matters', `Status: ${res.status}, count: ${matters.length} matters: ${matters.map((m: any) => m.referenceCode).join(', ')}`, passed);
  } catch (err: any) {
    record(3, 'Matters Loading (GET /api/matters)', 'HTTP 200 with 4 matters', `Error: ${err.message}`, false);
  }

  // TEST 4: Documents Loading (GET /api/documents)
  let documents: any[] = [];
  try {
    const res = await fetch(`${API_BASE}/api/documents`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    documents = data.data || [];
    const needsReview = documents.filter((d: any) => d.reviewStatus === 'needs_review').length;
    const reviewed = documents.filter((d: any) => d.reviewStatus === 'reviewed').length;
    const restricted = documents.filter((d: any) => d.reviewStatus === 'restricted').length;
    const passed = res.status === 200 && documents.length === 8 && needsReview === 3 && reviewed === 4 && restricted === 1;
    record(4, 'Documents Loading (GET /api/documents)', 'HTTP 200 with 8 docs (3 needs_review, 4 reviewed, 1 restricted)', `Status: ${res.status}, total: ${documents.length} (needs_review: ${needsReview}, reviewed: ${reviewed}, restricted: ${restricted})`, passed);
  } catch (err: any) {
    record(4, 'Documents Loading (GET /api/documents)', 'HTTP 200 with 8 docs', `Error: ${err.message}`, false);
  }

  // TEST 5: Search (GET /api/documents/search)
  try {
    const res = await fetch(`${API_BASE}/api/documents/search?q=Northstar`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    const searchDocs = data.data || [];
    const passed = res.status === 200 && searchDocs.length > 0 && searchDocs.every((d: any) => d.title.includes('Northstar') || d.matterReference.includes('MAT-2024-018') || (d.tags && d.tags.some((t: string) => t.toLowerCase().includes('northstar'))));
    record(5, 'Search (GET /api/documents/search)', 'HTTP 200 matching Northstar documents', `Status: ${res.status}, found: ${searchDocs.length} documents`, passed);
  } catch (err: any) {
    record(5, 'Search (GET /api/documents/search)', 'HTTP 200', `Error: ${err.message}`, false);
  }

  // TEST 6: Matter Filtering (GET /api/documents?matterId=...)
  try {
    const targetMatter = matters[0]?.id;
    const res = await fetch(`${API_BASE}/api/documents?matterId=${targetMatter}`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    const filtered = data.data || [];
    const passed = res.status === 200 && filtered.length > 0 && filtered.every((d: any) => d.matterId === targetMatter);
    record(6, 'Matter Filtering (GET /api/documents?matterId=...)', 'HTTP 200 matching only selected matter', `Status: ${res.status}, matter: ${targetMatter}, count: ${filtered.length}`, passed);
  } catch (err: any) {
    record(6, 'Matter Filtering', 'HTTP 200', `Error: ${err.message}`, false);
  }

  // TEST 7: Document Details (GET /api/documents/:documentId)
  const sampleDocId = documents[0]?.id;
  try {
    const res = await fetch(`${API_BASE}/api/documents/${sampleDocId}`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    const doc = data.data;
    const passed = res.status === 200 && doc.id === sampleDocId && doc.title && doc.currentVersion;
    record(7, 'Document Details (GET /api/documents/:documentId)', 'HTTP 200 with complete metadata and active version', `Status: ${res.status}, title: "${doc?.title}", currentVersion: v${doc?.currentVersion?.versionNumber}`, passed);
  } catch (err: any) {
    record(7, 'Document Details', 'HTTP 200', `Error: ${err.message}`, false);
  }

  // TEST 8: Version History (GET /api/documents/:documentId/versions)
  try {
    const res = await fetch(`${API_BASE}/api/documents/${sampleDocId}/versions`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    const versions = data.data || [];
    const passed = res.status === 200 && versions.length >= 1 && versions[0].versionNumber !== undefined;
    record(8, 'Version History (GET /api/documents/:documentId/versions)', 'HTTP 200 with versions array', `Status: ${res.status}, version count: ${versions.length}, latest: v${versions[0]?.versionNumber}`, passed);
  } catch (err: any) {
    record(8, 'Version History', 'HTTP 200', `Error: ${err.message}`, false);
  }

  // TEST 9: Review Status (GET /api/reviews)
  try {
    const res = await fetch(`${API_BASE}/api/reviews`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const data = await res.json();
    const reviews = data.data || [];
    const passed = res.status === 200 && Array.isArray(reviews) && reviews.length >= 1;
    record(9, 'Review Status (GET /api/reviews)', 'HTTP 200 with review records array', `Status: ${res.status}, reviews retrieved: ${reviews.length}`, passed);
  } catch (err: any) {
    record(9, 'Review Status', 'HTTP 200', `Error: ${err.message}`, false);
  }

  // TEST 10: Restricted Document Authorization (Admin allowed, Counsel denied)
  // Acquire Elena (Counsel) token
  let elenaToken = '';
  try {
    const elenaAuth = await supabase.auth.signInWithPassword({
      email: 'elena.marquez@crownledger.internal',
      password: 'TestPassword123!',
    });
    elenaToken = elenaAuth.data?.session?.access_token || '';
  } catch {}

  const restrictedDoc = documents.find((d: any) => d.reviewStatus === 'restricted') || documents[4];
  try {
    const resDenied = await fetch(`${API_BASE}/api/documents/${restrictedDoc.id}/signed-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${elenaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300 }),
    });

    const resAllowed = await fetch(`${API_BASE}/api/documents/${restrictedDoc.id}/signed-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${eleanorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300 }),
    });

    const passed = resDenied.status === 403 && resAllowed.status === 200;
    record(10, 'Restricted Document Authorization (RBAC / Ethical Wall)', 'Counsel: HTTP 403, Admin: HTTP 200', `Counsel status: ${resDenied.status}, Admin status: ${resAllowed.status}`, passed);
  } catch (err: any) {
    record(10, 'Restricted Document Authorization', 'Counsel: 403, Admin: 200', `Error: ${err.message}`, false);
  }

  // TEST 11: Signed URL Generation (POST /api/documents/:documentId/signed-url)
  try {
    const res = await fetch(`${API_BASE}/api/documents/${sampleDocId}/signed-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${eleanorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300 }),
    });
    const data = await res.json();
    const passed = res.status === 200 && data.signedUrl && data.ttlSeconds === 300 && data.securityEventId;
    record(11, 'Signed URL Generation (POST /api/documents/:documentId/signed-url)', 'HTTP 200 with signedUrl, ttlSeconds=300, and securityEventId', `Status: ${res.status}, signedUrl: ${data.signedUrl?.substring(0, 45)}..., ttl: ${data.ttlSeconds}s`, passed);
  } catch (err: any) {
    record(11, 'Signed URL Generation', 'HTTP 200 with signedUrl', `Error: ${err.message}`, false);
  }

  // TEST 12: Audit Logs (GET /api/audit-logs and GET /api/audit-logs/security-events)
  try {
    const resAudit = await fetch(`${API_BASE}/api/audit-logs?limit=10`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const resSec = await fetch(`${API_BASE}/api/audit-logs/security-events`, {
      headers: { Authorization: `Bearer ${eleanorToken}` },
    });
    const dataAudit = await resAudit.json();
    const dataSec = await resSec.json();
    const passed = resAudit.status === 200 && resSec.status === 200 && (dataAudit.data || []).length > 0;
    record(12, 'Audit Logs & Security Events (GET /api/audit-logs & /security-events)', 'HTTP 200 for both log feeds', `Audit status: ${resAudit.status} (${dataAudit.data?.length} entries), Security events: ${resSec.status} (${dataSec.data?.length} entries)`, passed);
  } catch (err: any) {
    record(12, 'Audit Logs & Security Events', 'HTTP 200', `Error: ${err.message}`, false);
  }

  // TEST 13: Logout / Session Expiration
  try {
    const { error } = await supabase.auth.signOut();
    const { data: sessionData } = await supabase.auth.getSession();
    const passed = !error && !sessionData?.session;
    record(13, 'Logout / Session Expiration', 'Session cleared completely', `SignOut error: ${error || 'none'}, session: ${sessionData?.session ? 'present' : 'null'}`, passed);
  } catch (err: any) {
    record(13, 'Logout / Session Expiration', 'Session null', `Error: ${err.message}`, false);
  }

  // TEST 14: 401 Handling (No token / expired token)
  try {
    const res = await fetch(`${API_BASE}/api/documents`, {
      headers: { Authorization: 'Bearer expired-or-invalid-token' },
    });
    const passed = res.status === 401;
    record(14, '401 Handling (Unauthorized)', 'HTTP 401 Unauthorized', `Status: ${res.status}`, passed);
  } catch (err: any) {
    record(14, '401 Handling', 'HTTP 401', `Error: ${err.message}`, false);
  }

  // TEST 15: 403 Handling (Access Restricted / Ethical Wall)
  try {
    const unassignedCounselAuth = await supabase.auth.signInWithPassword({
      email: 'priya.shah@crownledger.internal',
      password: 'TestPassword123!',
    });
    const priyaToken = unassignedCounselAuth.data?.session?.access_token || '';

    const res = await fetch(`${API_BASE}/api/matters/MAT-2024-018`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    });
    const passed = res.status === 403;
    record(15, '403 Handling (Forbidden / Ethical Wall)', 'HTTP 403 Forbidden with proper access-denied response', `Status: ${res.status}`, passed);
  } catch (err: any) {
    record(15, '403 Handling', 'HTTP 403', `Error: ${err.message}`, false);
  }

  console.log('================================================================');
  const allPassed = results.every((r) => r.status === 'PASS');
  console.log(`PHASE 4 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length} / ${results.length} PASSED`);
  console.log(`OVERALL RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runPhase4IntegrationTests().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
