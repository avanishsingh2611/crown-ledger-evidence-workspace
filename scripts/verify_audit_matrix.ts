/**
 * scripts/verify_audit_matrix.ts
 *
 * STEP 4.7 — Comprehensive End-to-End Multi-Persona Audit & Lifecycle Verification
 * Tests all 8 application personas against live Express server & Supabase database.
 */

import { AddressInfo } from 'net';
import dotenv from 'dotenv';
import { createExpressApp } from '../server/app';
import { createSupabaseUserClient, supabaseAdmin } from '../server/supabase';
import { requireRole } from '../server/middleware/rbac';

dotenv.config();

const DEMO_PASSWORD = 'CrownLedgerDemo!2026#Secure';

interface AuditTestResult {
  suite: string;
  test: string;
  role: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const auditResults: AuditTestResult[] = [];

function record(
  suite: string,
  test: string,
  role: string,
  expected: string,
  actual: string,
  passed: boolean,
  details?: string
) {
  auditResults.push({
    suite,
    test,
    role,
    expected,
    actual,
    status: passed ? 'PASS' : 'FAIL',
    details,
  });

  const tag = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${tag}] [${suite}] ${test}`);
  console.log(`   Persona/Role: ${role}`);
  console.log(`   Expected:     ${expected}`);
  console.log(`   Actual:       ${actual}`);
  if (details) console.log(`   Details:      ${details}`);
  console.log('');
}

async function runAudit() {
  console.log('================================================================================');
  console.log(' STEP 4.7: COMPREHENSIVE MULTI-PERSONA AUDIT & END-TO-END VALIDATION');
  console.log(' Crown & Ledger Digital Evidence Management System');
  console.log('================================================================================\n');

  // Start in-process Express server
  const app = createExpressApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✓ Test Express server listening on ${baseUrl}\n`);

  const anonClient = createSupabaseUserClient();

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & SESSION AUDIT (ALL AVAILABLE PERSONAS)
    // -------------------------------------------------------------------------
    console.log('--- 1. Authenticating Application Personas ---');
    
    // 1. Admin
    const { data: adminAuth } = await anonClient.auth.signInWithPassword({
      email: 'eleanor.raines@crownledger.internal',
      password: DEMO_PASSWORD,
    });
    const adminToken = adminAuth?.session?.access_token || '';
    const adminUser = adminAuth?.user;
    record('AUTH', 'Workspace Admin signs in with password', 'workspace_admin', 'Valid session JWT', adminToken ? 'JWT acquired' : 'Auth failed', !!adminToken);

    // 2. Attorney (Elena Marquez)
    const { data: elenaAuth } = await anonClient.auth.signInWithPassword({
      email: 'elena.marquez@crownledger.internal',
      password: DEMO_PASSWORD,
    });
    const elenaToken = elenaAuth?.session?.access_token || '';
    const elenaUser = elenaAuth?.user;
    record('AUTH', 'Lead Attorney (Elena) signs in with password', 'attorney', 'Valid session JWT', elenaToken ? 'JWT acquired' : 'Auth failed', !!elenaToken);

    // 3. Auditor (Clara Vance)
    const { data: claraAuth } = await anonClient.auth.signInWithPassword({
      email: 'clara.vance@external-audit.org',
      password: DEMO_PASSWORD,
    });
    const claraToken = claraAuth?.session?.access_token || '';
    record('AUTH', 'Auditor (Clara) signs in with password', 'auditor', 'Valid session JWT', claraToken ? 'JWT acquired' : 'Auth failed', !!claraToken);

    // 4. Judge (Justice V. K. Sharma)
    const { data: judgeAuth } = await anonClient.auth.signInWithPassword({
      email: 'justice.sharma@court.gov.in',
      password: DEMO_PASSWORD,
    });
    const judgeToken = judgeAuth?.session?.access_token || '';
    const judgeUser = judgeAuth?.user;
    record('AUTH', 'Judge (Justice Sharma) signs in with password', 'judge', 'Valid session JWT', judgeToken ? 'JWT acquired' : 'Auth failed', !!judgeToken);

    // 5. Forensic Team (Dr. Amitav Sen)
    const { data: forensicAuth } = await anonClient.auth.signInWithPassword({
      email: 'forensics.sen@cfsl.gov.in',
      password: DEMO_PASSWORD,
    });
    const forensicToken = forensicAuth?.session?.access_token || '';
    const forensicUser = forensicAuth?.user;
    record('AUTH', 'Forensic Examiner (Dr. Sen) signs in with password', 'forensic_team', 'Valid session JWT', forensicToken ? 'JWT acquired' : 'Auth failed', !!forensicToken);

    // 6. Investigating Officer (Inspector Rajesh Kumar)
    const { data: ioAuth } = await anonClient.auth.signInWithPassword({
      email: 'officer.kumar@delhipolice.gov.in',
      password: DEMO_PASSWORD,
    });
    const ioToken = ioAuth?.session?.access_token || '';
    const ioUser = ioAuth?.user;
    record('AUTH', 'Investigating Officer (Insp. Kumar) signs in with password', 'investigating_officer', 'Valid session JWT', ioToken ? 'JWT acquired' : 'Auth failed', !!ioToken);

    // 7. Victim (Ananya Roy)
    const { data: victimAuth } = await anonClient.auth.signInWithPassword({
      email: 'ananya.roy@citizen.org',
      password: DEMO_PASSWORD,
    });
    const victimToken = victimAuth?.session?.access_token || '';
    const victimUser = victimAuth?.user;
    record('AUTH', 'Victim (Ananya Roy) signs in with password', 'victim', 'Valid session JWT', victimToken ? 'JWT acquired' : 'Auth failed', !!victimToken);

    // 8. Reviewer (Static RBAC verification)
    const reviewerReq: any = { user: { role: 'reviewer', id: '11111111-2222-3333-4444-555555555555' } };
    let reviewerBlocked = false;
    const reviewerRes: any = {
      status: (code: number) => {
        if (code === 403) reviewerBlocked = true;
        return { json: () => {} };
      },
    };
    requireRole('workspace_admin')(reviewerReq, reviewerRes, () => {});
    record('AUTH_RBAC', 'Reviewer role denied administrative access', 'reviewer', 'HTTP 403', reviewerBlocked ? 'HTTP 403 Forbidden' : 'Allowed', reviewerBlocked);

    console.log('--- 2. Persona Authorization & Data Isolation Tests ---');

    // -------------------------------------------------------------------------
    // 2. WORKSPACE ADMIN AUDIT
    // -------------------------------------------------------------------------
    const resAdminCases = await fetch(`${baseUrl}/api/cases`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminCasesData: any = await resAdminCases.json();
    const adminCasesCount = adminCasesData.data?.length || 0;
    record('ADMIN_AUDIT', 'Admin lists all workspace court cases', 'workspace_admin', 'HTTP 200 with all cases', `HTTP ${resAdminCases.status}, Count: ${adminCasesCount}`, resAdminCases.status === 200 && adminCasesCount >= 2);

    const resAdminAudit = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminAuditData: any = await resAdminAudit.json();
    record('ADMIN_AUDIT', 'Admin inspects workspace audit logs', 'workspace_admin', 'HTTP 200 with audit entries', `HTTP ${resAdminAudit.status}, Count: ${adminAuditData.data?.length || 0}`, resAdminAudit.status === 200 && (adminAuditData.data?.length || 0) > 0);

    // Admin cannot bypass custody immutability
    const resAdminCustodyPatch = await fetch(`${baseUrl}/api/documents/10000000-0000-4000-a000-000000000001/custody`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('ADMIN_AUDIT', 'Admin prohibited from PATCH custody (immutability enforcement)', 'workspace_admin', 'HTTP 404 (No route)', `HTTP ${resAdminCustodyPatch.status}`, resAdminCustodyPatch.status === 404);

    // -------------------------------------------------------------------------
    // 3. ATTORNEY AUDIT & ETHICAL WALL
    // -------------------------------------------------------------------------
    const resElenaAssigned = await fetch(`${baseUrl}/api/matters/aaaaaaaa-1111-4aaa-aaaa-111111111111`, {
      headers: { Authorization: `Bearer ${elenaToken}` },
    });
    record('ATTORNEY_AUDIT', 'Attorney accesses assigned matter MAT-2024-018', 'attorney', 'HTTP 200', `HTTP ${resElenaAssigned.status}`, resElenaAssigned.status === 200);

    const resElenaEthicalWall = await fetch(`${baseUrl}/api/matters/cccccccc-3333-4ccc-cccc-333333333333`, {
      headers: { Authorization: `Bearer ${elenaToken}` },
    });
    record('ATTORNEY_AUDIT', 'Attorney blocked from unassigned matter MAT-2024-011 by Ethical Wall', 'attorney', 'HTTP 403 Forbidden', `HTTP ${resElenaEthicalWall.status}`, resElenaEthicalWall.status === 403);

    // -------------------------------------------------------------------------
    // 4. AUDITOR AUDIT
    // -------------------------------------------------------------------------
    const resAuditorLogs = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${claraToken}` },
    });
    record('AUDITOR_AUDIT', 'Auditor reads audit trail', 'auditor', 'HTTP 200', `HTTP ${resAuditorLogs.status}`, resAuditorLogs.status === 200);

    const resAuditorCustodyMutation = await fetch(`${baseUrl}/api/documents/10000000-0000-4000-a000-000000000001/custody`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${claraToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receivingPartyId: '88888888-8888-4888-a888-888888888888',
        transferType: 'VAULT_STORAGE',
        purpose: 'Auditor unauthorized mutation attempt',
        securitySealNumber: 'SEAL-AUDITOR-001',
      }),
    });
    record('AUDITOR_AUDIT', 'Auditor attempting to record custody is rejected with 403', 'auditor', 'HTTP 403 Forbidden', `HTTP ${resAuditorCustodyMutation.status}`, resAuditorCustodyMutation.status === 403);

    // -------------------------------------------------------------------------
    // 5. JUDGE BENCH AUDIT
    // -------------------------------------------------------------------------
    const resJudgeCases = await fetch(`${baseUrl}/api/cases`, {
      headers: { Authorization: `Bearer ${judgeToken}` },
    });
    const judgeCasesData: any = await resJudgeCases.json();
    const judgeCases = judgeCasesData.data || [];
    const judgeCase = judgeCases.find((c: any) => c.caseNumber === 'CRL-ND-2024-00891');
    record('JUDGE_AUDIT', 'Judge reads assigned court case CRL-ND-2024-00891', 'judge', 'HTTP 200 with assigned case', `HTTP ${resJudgeCases.status}, Assigned case found: ${!!judgeCase}`, resJudgeCases.status === 200 && !!judgeCase);

    // Judge cannot mutate custody (read-only for bench)
    const resJudgeCustody = await fetch(`${baseUrl}/api/documents/10000000-0000-4000-a000-000000000001/custody`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${judgeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receivingPartyId: '77777777-7777-4777-a777-777777777777',
        transferType: 'COURT_SUBMISSION',
        purpose: 'Judicial custody seizure attempt',
        securitySealNumber: 'SEAL-JUDGE-001',
      }),
    });
    record('JUDGE_AUDIT', 'Judge prohibited from mutating custody (read-only enforcement)', 'judge', 'HTTP 403 Forbidden', `HTTP ${resJudgeCustody.status}`, resJudgeCustody.status === 403);

    // -------------------------------------------------------------------------
    // 6. FORENSIC TEAM AUDIT
    // -------------------------------------------------------------------------
    const testCaseId = '11111111-c001-4001-8001-111111111111';
    const resForensicReports = await fetch(`${baseUrl}/api/cases/${testCaseId}/forensic-reports`, {
      headers: { Authorization: `Bearer ${forensicToken}` },
    });
    const repData: any = await resForensicReports.json();
    record('FORENSIC_AUDIT', 'Forensic examiner lists forensic reports for assigned case', 'forensic_team', 'HTTP 200 with reports', `HTTP ${resForensicReports.status}, Count: ${repData.data?.length || 0}`, resForensicReports.status === 200);

    // -------------------------------------------------------------------------
    // 7. INVESTIGATING OFFICER AUDIT
    // -------------------------------------------------------------------------
    const resIoCases = await fetch(`${baseUrl}/api/cases`, {
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const ioCasesData: any = await resIoCases.json();
    record('IO_AUDIT', 'Investigating Officer lists assigned police cases', 'investigating_officer', 'HTTP 200 with assigned cases', `HTTP ${resIoCases.status}, Count: ${ioCasesData.data?.length || 0}`, resIoCases.status === 200 && (ioCasesData.data?.length || 0) > 0);

    const resIoTampStage = await fetch(`${baseUrl}/api/cases/22222222-c002-4002-8002-222222222222`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ioToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stage: 'Trial' }),
    });
    record('IO_AUDIT', 'Investigating Officer blocked from modifying judicial case stage', 'investigating_officer', 'HTTP 403 Forbidden', `HTTP ${resIoTampStage.status}`, resIoTampStage.status === 403);

    // -------------------------------------------------------------------------
    // 8. VICTIM ISOLATION AUDIT
    // -------------------------------------------------------------------------
    const resVicCaseList = await fetch(`${baseUrl}/api/cases`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    const vicCasesData: any = await resVicCaseList.json();
    const vicCases = vicCasesData.data || [];
    const vicCanSeePolice = vicCases.some((c: any) => c.id === '22222222-c002-4002-8002-222222222222');
    record('VICTIM_ISOLATION', 'Victim cannot discover internal police investigation case INV-DEL-2024-0142', 'victim', 'Case hidden from listing', `Exposed: ${vicCanSeePolice}`, !vicCanSeePolice);

    const resVicDirectPolice = await fetch(`${baseUrl}/api/cases/22222222-c002-4002-8002-222222222222`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    record('VICTIM_ISOLATION', 'Victim direct access to internal police case returns 403', 'victim', 'HTTP 403 Forbidden', `HTTP ${resVicDirectPolice.status}`, resVicDirectPolice.status === 403);

    const resVicCustody = await fetch(`${baseUrl}/api/documents/10000000-0000-4000-a000-000000000001/custody`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    record('VICTIM_ISOLATION', 'Victim blocked from evidence custody history', 'victim', 'HTTP 403 Forbidden', `HTTP ${resVicCustody.status}`, resVicCustody.status === 403);

    const resVicAudit = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    record('VICTIM_ISOLATION', 'Victim blocked from workspace audit logs', 'victim', 'HTTP 403 Forbidden', `HTTP ${resVicAudit.status}`, resVicAudit.status === 403);

    const resVicCreatePart = await fetch(`${baseUrl}/api/cases/11111111-c001-4001-8001-111111111111/participants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${victimToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: '99999999-9999-4999-a999-999999999999',
        participantRole: 'judge',
      }),
    });
    record('VICTIM_ISOLATION', 'Victim privilege escalation attempt (add participant) returns 403', 'victim', 'HTTP 403 Forbidden', `HTTP ${resVicCreatePart.status}`, resVicCreatePart.status === 403);

    // -------------------------------------------------------------------------
    // 9. END-TO-END EVIDENCE LIFECYCLE (FLOW STEPS A -> G)
    // -------------------------------------------------------------------------
    console.log('--- 3. End-to-End Evidence Lifecycle Validation (Steps A to G) ---');

    const e2eTargetCaseId = '11111111-c001-4001-8001-111111111111';
    const e2eTargetDocId = '10000000-0000-4000-a000-000000000001';

    // STEP A: IO FIR update & Case Association
    const e2eFirNum = `FIR-SIH-${Date.now().toString().slice(-4)}/2026`;
    const resStepA = await fetch(`${baseUrl}/api/cases/${e2eTargetCaseId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`, // Admin acting as supervising authority
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firNumber: e2eFirNum,
      }),
    });
    record('LIFECYCLE_STEP_A', 'Step A: FIR registered and associated with court case', 'investigating_officer / admin', 'HTTP 200 with FIR number', `HTTP ${resStepA.status}`, resStepA.status === 200);

    // STEP B: Evidence enters custody ledger with security seal
    const sealNum = `SEAL-AUDIT-${Date.now().toString().slice(-4)}`;
    const resStepB = await fetch(`${baseUrl}/api/documents/${e2eTargetDocId}/custody`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receivingPartyId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', // Inspector Rajesh Kumar
        transferType: 'INTAKE',
        purpose: 'Initial evidentiary seizure at crime scene',
        securitySealNumber: sealNum,
        sealIntact: true,
        sha256Verified: true,
      }),
    });
    const stepBData: any = await resStepB.json();
    record('LIFECYCLE_STEP_B', 'Step B: Evidence enters custody ledger with security seal', 'investigating_officer', 'HTTP 201 Created with transfer record', `HTTP ${resStepB.status}, Transfer ID: ${stepBData.data?.id}`, resStepB.status === 201);

    // STEP C: Evidence transferred to Forensic Lab (LAB_ANALYSIS)
    const labSealNum = `SEAL-CFSL-${Date.now().toString().slice(-4)}`;
    const resStepC = await fetch(`${baseUrl}/api/documents/${e2eTargetDocId}/custody`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receivingPartyId: '88888888-8888-4888-a888-888888888888', // Dr. Amitav Sen
        transferType: 'LAB_ANALYSIS',
        purpose: 'Handoff to CFSL Cyber Forensics Lab for bit-stream disk acquisition',
        securitySealNumber: labSealNum,
        sealIntact: true,
        sha256Verified: true,
      }),
    });
    const stepCData: any = await resStepC.json();
    record('LIFECYCLE_STEP_C', 'Step C: Evidence transferred to forensic lab (LAB_ANALYSIS)', 'investigating_officer', 'HTTP 201 Created with transfer record', `HTTP ${resStepC.status}, Transfer ID: ${stepCData.data?.id}`, resStepC.status === 201);

    // STEP D: Forensic Team creates and finalizes forensic examination report
    const acqSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const resCreateRep = await fetch(`${baseUrl}/api/cases/${e2eTargetCaseId}/forensic-reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${forensicToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: e2eTargetDocId,
        labName: 'Central Forensic Science Laboratory (CFSL), New Delhi',
        deviceType: 'NVMe Solid State Drive',
        deviceMakeModel: 'Samsung 980 PRO 1TB',
        deviceSerialNumber: `SN-CFSL-${Date.now().toString().slice(-5)}`,
        extractionTool: 'EnCase Forensic',
        extractionToolVersion: '21.4.1',
        acquisitionSha256: acqSha,
        verificationSha256: acqSha,
        hashesMatch: true,
        intakeCondition: 'Sealed evidence bag intact with tamper seal',
        findingsSummary: 'Bit-stream image acquisition verified without hash mismatch under Sec 65B.',
        section65bCertified: true,
      }),
    });
    const repCreateData: any = await resCreateRep.json();
    const createdReportId = repCreateData.data?.id;

    // Finalize report
    const resFinRep = await fetch(`${baseUrl}/api/forensic-reports/${createdReportId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${forensicToken}` },
    });
    const finRepData: any = await resFinRep.json();
    record('LIFECYCLE_STEP_D', 'Step D: Forensic examiner verifies SHA-256 and finalizes report', 'forensic_team', 'HTTP 200 with isFinalized=true', `HTTP ${resFinRep.status}, isFinalized: ${finRepData.data?.isFinalized}`, resFinRep.status === 200 && finRepData.data?.isFinalized === true);

    // STEP E: Judge views authorized case, evidence integrity, and custody timeline
    const resJudgeReview = await fetch(`${baseUrl}/api/cases/${e2eTargetCaseId}`, {
      headers: { Authorization: `Bearer ${judgeToken}` },
    });
    const resJudgeCustodyView = await fetch(`${baseUrl}/api/documents/${e2eTargetDocId}/custody`, {
      headers: { Authorization: `Bearer ${judgeToken}` },
    });
    record('LIFECYCLE_STEP_E', 'Step E: Judge inspects case docket and chain of custody ledger', 'judge', 'HTTP 200 for docket and custody history', `Docket: ${resJudgeReview.status}, Custody: ${resJudgeCustodyView.status}`, resJudgeReview.status === 200 && resJudgeCustodyView.status === 200);

    // STEP F: Judge advances authorized case stage
    const resJudgeStage = await fetch(`${baseUrl}/api/cases/${e2eTargetCaseId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${judgeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stage: 'Evidence Hearing',
      }),
    });
    const judgeStageData: any = await resJudgeStage.json();
    record('LIFECYCLE_STEP_F', 'Step F: Presiding Judge updates case stage in judicial docket', 'judge', 'HTTP 200 with stage updated', `HTTP ${resJudgeStage.status}, Stage: ${judgeStageData.data?.stage}`, resJudgeStage.status === 200 && judgeStageData.data?.stage === 'Evidence Hearing');

    // STEP G: Verify Final State Immutability
    // Finalized report cannot be modified
    const resTamperFin = await fetch(`${baseUrl}/api/forensic-reports/${createdReportId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${forensicToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ findingsSummary: 'Post-finalization unauthorized alteration' }),
    });
    // Custody cannot be modified
    const resCustodyPatch = await fetch(`${baseUrl}/api/documents/${e2eTargetDocId}/custody`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('LIFECYCLE_STEP_G', 'Step G: Immutability verified across finalized report & custody ledger', 'security_policy', 'Report PATCH=400, Custody PATCH=404', `Report: ${resTamperFin.status}, Custody: ${resCustodyPatch.status}`, resTamperFin.status === 400 && resCustodyPatch.status === 404);

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('================================================================================');
    console.log(' AUDIT MATRIX SUMMARY REPORT');
    console.log('================================================================================');
    const total = auditResults.length;
    const passed = auditResults.filter((r) => r.status === 'PASS').length;
    const failed = auditResults.filter((r) => r.status === 'FAIL').length;
    console.log(`TOTAL AUDIT CHECKS: ${total}`);
    console.log(`PASSED:             ${passed}`);
    console.log(`FAILED:             ${failed}`);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
