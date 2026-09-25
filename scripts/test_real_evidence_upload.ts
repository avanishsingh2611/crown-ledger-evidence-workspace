import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const API_BASE = 'http://localhost:3000';
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

async function runTests() {
  console.log('============================================================');
  console.log('PHASE 7 — REAL EVIDENCE UPLOAD WORKFLOW VERIFICATION');
  console.log('============================================================\n');

  // Step 1: Login as workspace_admin (Eleanor Raines)
  console.log('1. Authenticating as Eleanor Raines (workspace_admin)...');
  const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
    email: 'eleanor.raines@crownledger.internal',
    password: 'CrownLedgerDemo!2026#Secure',
  });
  if (adminErr || !adminAuth.session) {
    throw new Error(`Admin login failed: ${adminErr?.message}`);
  }
  const adminToken = adminAuth.session.access_token;
  console.log('   ✓ Eleanor Raines authenticated.\n');

  // Step 2: Fetch matters to select an active matter and archived matter
  console.log('2. Selecting active matter for upload test...');
  const mattersRes = await fetch(`${API_BASE}/api/matters`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const mattersJson = await mattersRes.json();
  const activeMatter = mattersJson.data.find((m: any) => m.status === 'active');
  const archivedMatter = mattersJson.data.find((m: any) => m.status === 'archived');
  if (!activeMatter) throw new Error('No active matter found');
  console.log(`   ✓ Active matter selected: ${activeMatter.referenceCode} — ${activeMatter.title}`);
  if (archivedMatter) {
    console.log(`   ✓ Archived matter identified: ${archivedMatter.referenceCode} — ${archivedMatter.title}\n`);
  }

  // Step 3: Test Real Upload with valid PDF and classification 'restricted'
  console.log('3. Uploading real evidence PDF with cryptographic SHA-256 and RESTRICTED classification...');
  const testPdfContent = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n`;
  const testBuffer = Buffer.from(testPdfContent, 'utf-8');
  const clientSha256 = crypto.createHash('sha256').update(testBuffer).digest('hex');
  const testFilename = `Forensic_Exhibit_Phase7_${Date.now()}.pdf`;

  const formData = new FormData();
  formData.append('file', new Blob([testBuffer], { type: 'application/pdf' }), testFilename);
  formData.append('matterId', activeMatter.id);
  formData.append('title', `Forensic Chain Evidence ${Date.now()}`);
  formData.append('classification', 'restricted');
  formData.append('changeSummary', 'Initial custodial evidence deposit via Phase 7 workflow');
  formData.append('tags', 'forensic,chain-of-custody');

  const uploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    body: formData,
  });

  const uploadJson = await uploadRes.json();
  console.log(`   Upload response status: HTTP ${uploadRes.status}`);
  if (uploadRes.status !== 201) {
    console.error('   ✗ Upload failed:', uploadJson);
    throw new Error(`Upload failed with status ${uploadRes.status}: ${JSON.stringify(uploadJson)}`);
  }
  const uploadedDoc = uploadJson.data;
  console.log(`   ✓ Document created with ID: ${uploadedDoc.id}`);
  console.log(`   ✓ Document title: "${uploadedDoc.title}"`);
  console.log(`   ✓ Classification: ${uploadedDoc.classification}`);
  console.log(`   ✓ Version: v${uploadedDoc.currentVersionNumber}`);
  const storedSha256 = uploadedDoc.currentVersion?.sha256Checksum || uploadedDoc.currentVersion?.sha256Hash;
  console.log(`   ✓ Stored SHA-256: ${storedSha256}`);
  console.log(`   ✓ Client SHA-256: ${clientSha256}`);

  if (storedSha256 !== clientSha256) {
    throw new Error('SHA-256 mismatch between client and server storage!');
  }
  if (uploadedDoc.classification !== 'restricted') {
    throw new Error(`Expected classification 'restricted', got '${uploadedDoc.classification}'`);
  }
  console.log('   ✓ Cryptographic SHA-256 match confirmed.');
  console.log('   ✓ Restricted classification confirmed.\n');

  // Step 4: Verify document_versions record exists in DB
  console.log('4. Verifying document_versions record...');
  const versionsRes = await fetch(`${API_BASE}/api/documents/${uploadedDoc.id}/versions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const versionsJson = await versionsRes.json();
  console.log(`   Versions response: HTTP ${versionsRes.status}, count: ${versionsJson.data?.length}`);
  if (versionsJson.data?.length < 1) {
    throw new Error('No document_versions record found!');
  }
  const v1 = versionsJson.data[0];
  const v1Hash = v1.sha256Checksum || v1.sha256Hash;
  console.log(`   ✓ Version record confirmed: v${v1.versionNumber || 1}, filename: ${v1.originalFilename}`);
  console.log(`   ✓ Version SHA-256: ${v1Hash}\n`);

  // Step 5: Verify audit log event
  console.log('5. Verifying audit_logs table contains "uploaded" event...');
  const auditRes = await fetch(`${API_BASE}/api/audit-logs?limit=10`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const auditJson = await auditRes.json();
  const uploadAudit = auditJson.data.find(
    (a: any) => a.documentId === uploadedDoc.id || (a.targetName === uploadedDoc.title && a.action === 'uploaded')
  );
  if (!uploadAudit) {
    console.error('Recent audits:', auditJson.data.slice(0, 5));
    throw new Error('Audit log event for upload not found!');
  }
  console.log(`   ✓ Audit event verified: [${uploadAudit.action}] ${uploadAudit.targetName} by ${uploadAudit.actorName}`);
  console.log(`   ✓ Audit metadata:`, uploadAudit.metadata, '\n');

  // Step 6: Test Download via Signed URL and Byte-for-byte verification
  console.log('6. Verifying signed download of uploaded evidence...');
  const downloadRes = await fetch(`${API_BASE}/api/documents/${uploadedDoc.id}/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      versionNumber: 1,
      password: '123456', // Restricted documents use password gate
    }),
  });
  const downloadJson = await downloadRes.json();
  console.log(`   Download API response: HTTP ${downloadRes.status}`);
  if (downloadRes.status !== 200 || !downloadJson.signedUrl) {
    throw new Error(`Download failed: ${JSON.stringify(downloadJson)}`);
  }
  // Fetch actual file from signed URL
  const fileFetchRes = await fetch(downloadJson.signedUrl);
  const downloadedArrayBuffer = await fileFetchRes.arrayBuffer();
  const downloadedBuffer = Buffer.from(downloadedArrayBuffer);
  const downloadedSha256 = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');
  console.log(`   ✓ Downloaded byte length: ${downloadedBuffer.length} bytes`);
  console.log(`   ✓ Downloaded SHA-256: ${downloadedSha256}`);
  if (downloadedSha256 !== clientSha256) {
    throw new Error('Downloaded file SHA-256 does not match original uploaded file!');
  }
  console.log('   ✓ Byte-for-byte identical storage retrieval verified.\n');

  // Step 7: Test RBAC - Unauthorized user (Clara Vance, auditor) blocked from upload
  console.log('7. Testing RBAC restriction (auditor cannot upload)...');
  const { data: auditorAuth } = await supabase.auth.signInWithPassword({
    email: 'clara.vance@external-audit.org',
    password: 'CrownLedgerDemo!2026#Secure',
  });
  if (auditorAuth.session) {
    const auditorToken = auditorAuth.session.access_token;
    const auditorFormData = new FormData();
    auditorFormData.append('file', new Blob([testBuffer], { type: 'application/pdf' }), 'auditor_try.pdf');
    auditorFormData.append('matterId', activeMatter.id);
    auditorFormData.append('title', 'Auditor Attempt');

    const auditorUploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auditorToken}` },
      body: auditorFormData,
    });
    console.log(`   Auditor upload response: HTTP ${auditorUploadRes.status}`);
    if (auditorUploadRes.status === 403) {
      console.log('   ✓ RBAC enforced: Auditor blocked with HTTP 403 Forbidden.\n');
    } else {
      throw new Error(`Expected HTTP 403 for auditor, got ${auditorUploadRes.status}`);
    }
  }

  // Step 8: Test Archived Matter Protection
  if (archivedMatter) {
    console.log(`8. Testing archived matter protection (${archivedMatter.referenceCode})...`);
    const archivedFormData = new FormData();
    archivedFormData.append('file', new Blob([testBuffer], { type: 'application/pdf' }), 'archived_try.pdf');
    archivedFormData.append('matterId', archivedMatter.id);
    archivedFormData.append('title', 'Archived Matter Upload Try');

    const archivedUploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: archivedFormData,
    });
    console.log(`   Archived matter upload response: HTTP ${archivedUploadRes.status}`);
    if (archivedUploadRes.status === 403) {
      console.log('   ✓ Archived matter protection enforced: Blocked with HTTP 403 Forbidden.\n');
    } else {
      throw new Error(`Expected HTTP 403 for archived matter, got ${archivedUploadRes.status}`);
    }
  }

  // Step 9: Test Disguised / Invalid Magic Bytes file (Security: Not extension alone)
  console.log('9. Testing rejection of disguised binary executable (.exe header renamed to .pdf)...');
  const fakePdfContent = `MZ\x90\x00\x03\x00\x00\x00This is an executable disguised as pdf`;
  const fakeFormData = new FormData();
  fakeFormData.append('file', new Blob([Buffer.from(fakePdfContent)], { type: 'application/pdf' }), 'disguised.pdf');
  fakeFormData.append('matterId', activeMatter.id);
  fakeFormData.append('title', 'Malicious File');

  const fakeUploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: fakeFormData,
  });
  console.log(`   Disguised binary response: HTTP ${fakeUploadRes.status}`);
  if (fakeUploadRes.status === 400) {
    const fakeJson = await fakeUploadRes.json();
    console.log(`   ✓ Backend signature validator caught masqueraded file: "${fakeJson.message}"\n`);
  } else {
    throw new Error(`Expected HTTP 400 for disguised file, got ${fakeUploadRes.status}`);
  }

  // Step 10: Test Unsupported File Extension
  console.log('10. Testing rejection of unsupported file extension (.sh)...');
  const shFormData = new FormData();
  shFormData.append('file', new Blob([Buffer.from('#!/bin/bash\necho test\n')], { type: 'text/plain' }), 'script.sh');
  shFormData.append('matterId', activeMatter.id);
  shFormData.append('title', 'Shell Script');

  const shUploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: shFormData,
  });
  console.log(`   Unsupported extension response: HTTP ${shUploadRes.status}`);
  if (shUploadRes.status === 400) {
    const shJson = await shUploadRes.json();
    console.log(`   ✓ Backend extension validator rejected unsupported file: "${shJson.message}"\n`);
  } else {
    throw new Error(`Expected HTTP 400 for unsupported extension, got ${shUploadRes.status}`);
  }

  console.log('============================================================');
  console.log('ALL 10 REAL EVIDENCE UPLOAD VERIFICATION TESTS PASSED!');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
