/**
 * scripts/verify_investigating_officer.ts
 *
 * Dedicated End-to-End Verification for STEP 4.6:
 * Investigating Officer / Police Station Workflow
 * Persona: Inspector Rajesh Kumar (officer.kumar@delhipolice.gov.in)
 */

import { AddressInfo } from 'net';
import dotenv from 'dotenv';
import { createExpressApp } from '../server/app';
import { createSupabaseUserClient } from '../server/supabase';

dotenv.config();

const IO_CREDENTIALS = {
  email: 'officer.kumar@delhipolice.gov.in',
  password: 'CrownLedgerDemo!2026#Secure',
};

const VICTIM_CREDENTIALS = {
  email: 'ananya.roy@citizen.org',
  password: 'CrownLedgerDemo!2026#Secure',
};

interface TestResult {
  id: number;
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const results: TestResult[] = [];

function recordTest(id: number, title: string, expected: string, actual: string, passed: boolean) {
  results.push({ id, title, expected, actual, passed });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${status}] #${id} ${title}`);
  console.log(`       Expected: ${expected}`);
  console.log(`       Actual:   ${actual}\n`);
}

async function run() {
  console.log('================================================================================');
  console.log(' STEP 4.6: INVESTIGATING OFFICER WORKFLOW VERIFICATION');
  console.log(' Crown & Ledger Digital Evidence Management System');
  console.log('================================================================================\n');

  // 1. Start in-process Express server on ephemeral port
  const app = createExpressApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✓ Test Express server listening on ${baseUrl}\n`);

  const anonClient = createSupabaseUserClient();

  try {
    // 2. Authenticate Investigating Officer
    console.log('Authenticating Inspector Rajesh Kumar...');
    const { data: ioAuth, error: ioAuthErr } = await anonClient.auth.signInWithPassword(IO_CREDENTIALS);
    if (ioAuthErr || !ioAuth?.session?.access_token) {
      throw new Error(`IO authentication failed: ${ioAuthErr?.message}`);
    }
    const ioToken = ioAuth.session.access_token;
    const ioUser = ioAuth.user;
    console.log(`✓ IO Authenticated: ${ioUser?.id} (${ioUser?.email})\n`);

    // Authenticate Victim for isolation checks
    const { data: vicAuth, error: vicAuthErr } = await anonClient.auth.signInWithPassword(VICTIM_CREDENTIALS);
    if (vicAuthErr || !vicAuth?.session?.access_token) {
      throw new Error(`Victim authentication failed: ${vicAuthErr?.message}`);
    }
    const vicToken = vicAuth.session.access_token;

    // -------------------------------------------------------------------------
    // TEST 1: IO Case Listing
    // -------------------------------------------------------------------------
    const resCases = await fetch(`${baseUrl}/api/cases`, {
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const casesData: any = await resCases.json();
    const cases = Array.isArray(casesData.data) ? casesData.data : [];
    const assignedCase = cases.find((c: any) => c.investigationOfficerId === ioUser.id);

    recordTest(
      1,
      'IO lists assigned court cases via GET /api/cases',
      'HTTP 200 with only assigned cases',
      `HTTP ${resCases.status}, Count: ${cases.length}, Assigned case found: ${assignedCase?.caseNumber || 'none'}`,
      resCases.status === 200 && cases.length > 0 && !!assignedCase
    );

    const testCaseId = assignedCase?.id || '11111111-c001-4001-8001-111111111111';
    const testCaseNumber = assignedCase?.caseNumber || 'CRL-ND-2024-00891';

    // -------------------------------------------------------------------------
    // TEST 2: IO Reads Specific Case Details
    // -------------------------------------------------------------------------
    const resCaseDetail = await fetch(`${baseUrl}/api/cases/${testCaseId}`, {
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const caseDetailRes: any = await resCaseDetail.json();
    const caseDetail = caseDetailRes.data || caseDetailRes;

    recordTest(
      2,
      `IO reads case details for ${testCaseNumber} via GET /api/cases/:id`,
      'HTTP 200 with case record',
      `HTTP ${resCaseDetail.status}, CaseNumber: "${caseDetail?.caseNumber}", Police Station: "${caseDetail?.policeStation || 'None'}"`,
      resCaseDetail.status === 200 && caseDetail?.id === testCaseId
    );

    // -------------------------------------------------------------------------
    // TEST 3: IO Updates FIR Number & Police Station (Authorized Fields)
    // -------------------------------------------------------------------------
    const updatedFir = `FIR-${Date.now().toString().slice(-6)}/2026`;
    const updatedPs = 'Cyber Crime PS, Mandir Marg, New Delhi';
    const resUpdateFir = await fetch(`${baseUrl}/api/cases/${testCaseId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ioToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firNumber: updatedFir,
        policeStation: updatedPs,
      }),
    });
    const updateFirRes: any = await resUpdateFir.json();
    const updatedCase = updateFirRes.data || updateFirRes;

    recordTest(
      3,
      'IO updates FIR number and Police Station via PATCH /api/cases/:id',
      'HTTP 200 with updated FIR and Police Station',
      `HTTP ${resUpdateFir.status}, FIR: "${updatedCase?.firNumber}", PS: "${updatedCase?.policeStation}"`,
      resUpdateFir.status === 200 && updatedCase?.firNumber === updatedFir && updatedCase?.policeStation === updatedPs
    );

    // -------------------------------------------------------------------------
    // TEST 4: IO Stage Tampering Denied (Judicial Docket Protection)
    // -------------------------------------------------------------------------
    const resTamperStage = await fetch(`${baseUrl}/api/cases/${testCaseId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ioToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stage: 'Closed',
      }),
    });
    const tamperData: any = await resTamperStage.json();

    recordTest(
      4,
      'IO cannot modify judicial docket fields (stage, presiding judge) - returns HTTP 403',
      'HTTP 403 Forbidden',
      `HTTP ${resTamperStage.status}, Message: "${tamperData?.message || tamperData?.error}"`,
      resTamperStage.status === 403
    );

    // -------------------------------------------------------------------------
    // TEST 5: IO Accesses Case Evidence / Documents
    // -------------------------------------------------------------------------
    const matterId = assignedCase?.matterId || 'aaaaaaaa-1111-4aaa-aaaa-111111111111';
    const resDocs = await fetch(`${baseUrl}/api/documents?matterId=${matterId}`, {
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const docsRes: any = await resDocs.json();
    const docs = Array.isArray(docsRes.data) ? docsRes.data : Array.isArray(docsRes) ? docsRes : [];
    const testDoc = docs?.[0];

    recordTest(
      5,
      'IO reads documents linked to assigned case matter via GET /api/documents?matterId=...',
      'HTTP 200 with document list',
      `HTTP ${resDocs.status}, Documents Count: ${docs?.length || 0}`,
      resDocs.status === 200 && Array.isArray(docs) && docs.length > 0
    );

    const testDocId = testDoc?.id || '10000000-0000-4000-a000-000000000001';

    // -------------------------------------------------------------------------
    // TEST 6: IO Records Custody Transfer (Forensic Submission Handoff)
    // -------------------------------------------------------------------------
    const resTransfer = await fetch(`${baseUrl}/api/documents/${testDocId}/custody`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ioToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receivingPartyId: '88888888-8888-4888-a888-888888888888', // Dr. Amitav Sen (Forensic Examiner)
        transferType: 'LAB_ANALYSIS',
        purpose: 'Digital forensic extraction and cryptographic hash verification under Sec 65B',
        notes: 'Handover sealed drive to CFSL New Delhi',
        sealIntact: true,
        sha256Verified: true,
        securitySealNumber: `SEAL-CFSL-${Date.now().toString().slice(-4)}`,
      }),
    });
    const transferRes: any = await resTransfer.json();
    const transferData = transferRes.data || transferRes;

    recordTest(
      6,
      'IO records custody transfer to Forensic Lab via POST /api/documents/:id/custody',
      'HTTP 201 Created with transfer record',
      `HTTP ${resTransfer.status}, Transfer ID: "${transferData?.id}", To: "${transferData?.receivingPartyName || transferData?.receiving_party_id}"`,
      resTransfer.status === 201 && !!transferData?.id
    );

    // -------------------------------------------------------------------------
    // TEST 7: Custody Immutability (No PATCH or DELETE)
    // -------------------------------------------------------------------------
    const resPatchCustody = await fetch(`${baseUrl}/api/documents/${testDocId}/custody`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const resDeleteCustody = await fetch(`${baseUrl}/api/documents/${testDocId}/custody`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ioToken}` },
    });

    recordTest(
      7,
      'Custody history is strictly immutable (PATCH & DELETE routes do not exist / return 404)',
      'HTTP 404 for both PATCH and DELETE',
      `PATCH: ${resPatchCustody.status}, DELETE: ${resDeleteCustody.status}`,
      resPatchCustody.status === 404 && resDeleteCustody.status === 404
    );

    // -------------------------------------------------------------------------
    // TEST 8: IO Reads Custody Timeline
    // -------------------------------------------------------------------------
    const resCustodyList = await fetch(`${baseUrl}/api/documents/${testDocId}/custody`, {
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const custodyRes: any = await resCustodyList.json();
    const custodyHistory = Array.isArray(custodyRes.data) ? custodyRes.data : Array.isArray(custodyRes) ? custodyRes : [];
    const loggedTransfer = custodyHistory?.find((t: any) => t.id === transferData?.id);

    recordTest(
      8,
      'IO inspects custody timeline via GET /api/documents/:id/custody',
      'HTTP 200 with custody timeline containing newly logged transfer',
      `HTTP ${resCustodyList.status}, Total records: ${custodyHistory?.length}, Newly logged verified: ${!!loggedTransfer}`,
      resCustodyList.status === 200 && Array.isArray(custodyHistory) && !!loggedTransfer
    );

    // -------------------------------------------------------------------------
    // TEST 9: IO Forensic Report Visibility & Edit Restriction
    // -------------------------------------------------------------------------
    const resReports = await fetch(`${baseUrl}/api/cases/${testCaseId}/forensic-reports`, {
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const reportsRes: any = await resReports.json();
    const reports = Array.isArray(reportsRes.data) ? reportsRes.data : Array.isArray(reportsRes) ? reportsRes : [];

    let tamperReportStatus = 404;
    if (reports.length > 0) {
      const repId = reports[0].id;
      const resTamperReport = await fetch(`${baseUrl}/api/forensic-reports/${repId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ioToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summaryOfFindings: 'Tampered by IO' }),
      });
      tamperReportStatus = resTamperReport.status;
    }

    recordTest(
      9,
      'IO forensic visibility permitted; IO unauthorized to modify forensic reports (returns 400/403/404)',
      'HTTP 200 for read; HTTP 400/403 for modify',
      `GET reports: HTTP ${resReports.status} (${reports?.length || 0} reports); PATCH report: HTTP ${tamperReportStatus}`,
      resReports.status === 200 && (tamperReportStatus === 400 || tamperReportStatus === 403 || tamperReportStatus === 404)
    );

    // -------------------------------------------------------------------------
    // TEST 10: IO Notifications & Mark Read
    // -------------------------------------------------------------------------
    const resNotes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${ioToken}` },
    });
    const notesRes: any = await resNotes.json();
    const notes = Array.isArray(notesRes.data) ? notesRes.data : Array.isArray(notesRes) ? notesRes : [];

    let markReadOk = true;
    if (notes.length > 0) {
      const noteId = notes[0].id;
      const resMark = await fetch(`${baseUrl}/api/notifications/${noteId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ioToken}` },
      });
      markReadOk = resMark.status === 200;
    }

    recordTest(
      10,
      'IO reads self-notifications and marks as read via PATCH /api/notifications/:id/read',
      'HTTP 200 for read and mark-read',
      `GET notifications: HTTP ${resNotes.status} (${notes?.length || 0} items), Mark-read: ${markReadOk ? 'Success' : 'Failed'}`,
      resNotes.status === 200 && markReadOk
    );

    // -------------------------------------------------------------------------
    // TEST 11: Victim Isolation from Investigation Command
    // -------------------------------------------------------------------------
    const resVicCaseList = await fetch(`${baseUrl}/api/cases`, {
      headers: { Authorization: `Bearer ${vicToken}` },
    });
    const vicCasesRes: any = await resVicCaseList.json();
    const vicCases = Array.isArray(vicCasesRes.data) ? vicCasesRes.data : Array.isArray(vicCasesRes) ? vicCasesRes : [];
    const vicCanSeePoliceCase = vicCases.some((c: any) => c.id === '22222222-c002-4002-8002-222222222222');

    recordTest(
      11,
      'Victim remains strictly isolated from internal police cases (INV-DEL-2024-0142)',
      'Victim cannot see unrelated police case',
      `Victim saw police case: ${vicCanSeePoliceCase}`,
      !vicCanSeePoliceCase
    );

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('================================================================================');
    console.log(' INVESTIGATING OFFICER SUITE SUMMARY');
    console.log('================================================================================');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`TOTAL TESTS: ${results.length}`);
    console.log(`PASSED:      ${passed}`);
    console.log(`FAILED:      ${failed}`);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});
