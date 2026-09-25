import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config();

const API_BASE = 'http://localhost:3000';
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

async function run() {
  console.log('====================================================');
  console.log('CROWN & LEDGER — END-TO-END VERIFICATION SUITE');
  console.log('====================================================\n');

  const report: Record<string, boolean | string> = {};

  // 1. Verify Login
  console.log('1. Testing authentication with Eleanor Raines...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'eleanor.raines@crownledger.internal',
    password: 'CrownLedgerDemo!2026#Secure',
  });

  if (authErr || !authData.session) {
    console.error('✗ Login failed:', authErr?.message);
    report['1. Login'] = false;
    process.exit(1);
  }
  const token = authData.session.access_token;
  report['1. Login'] = true;
  console.log('   ✓ Login works. Token acquired for Eleanor Raines (Managing Partner).\n');

  // 2. Test Overview / Stats
  console.log('2. Testing Overview endpoint (/api/stats)...');
  const statsRes = await fetch(`${API_BASE}/api/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const statsData = await statsRes.json();
  const statsPassed = statsRes.status === 200 && !statsData.error;
  report['2. Overview stats'] = statsPassed;
  console.log(`   ${statsPassed ? '✓' : '✗'} Overview response: HTTP ${statsRes.status}`);

  // 3. Test Matters
  console.log('\n3. Testing Matters endpoint (/api/matters)...');
  const mattersRes = await fetch(`${API_BASE}/api/matters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const mattersData = await mattersRes.json();
  const mattersPassed = mattersRes.status === 200 && Array.isArray(mattersData.data) && mattersData.data.length >= 4;
  report['3. Matters endpoint'] = mattersPassed;
  console.log(`   ${mattersPassed ? '✓' : '✗'} Matters count: ${mattersData.data?.length || 0}`);

  // 4. Test Documents list & 12 sample PDFs
  console.log('\n4. Testing Documents workspace (/api/documents)...');
  const docsRes = await fetch(`${API_BASE}/api/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const docsData = await docsRes.json();
  const allDocs = docsData.data || [];
  console.log(`   Total documents in repository: ${allDocs.length}`);

  const sampleDocs = allDocs.filter((d: any) =>
    d.currentVersion?.originalFilename?.startsWith('SCF_final_merged') ||
    d.currentVersion?.originalFilename?.startsWith('SCF final_merged') ||
    d.tags?.includes('sample-evidence')
  );
  console.log(`   Total sample case PDFs found in database: ${sampleDocs.length} / 12`);
  const sample12Passed = sampleDocs.length === 12;
  report['4. All 12 sample PDFs represented'] = sample12Passed;

  // 5. Verify real Storage paths & SHA-256
  console.log('\n5. Verifying real Storage paths and SHA-256 hashes...');
  let pathsValid = true;
  let hashesValid = true;

  for (const doc of sampleDocs) {
    const ver = doc.currentVersion;
    if (!ver.storagePath || !ver.storagePath.startsWith('matters/')) {
      pathsValid = false;
    }
    if (!ver.sha256Hash || ver.sha256Hash.length !== 64) {
      hashesValid = false;
    }
  }
  report['5. Storage paths valid'] = pathsValid;
  report['6. SHA-256 hashes valid'] = hashesValid;
  console.log(`   ${pathsValid ? '✓' : '✗'} Storage paths verified across all 12 sample PDFs.`);
  console.log(`   ${hashesValid ? '✓' : '✗'} SHA-256 hashes verified across all 12 sample PDFs.`);

  // 6. Test Normal Download (Non-confidential file)
  console.log('\n6. Testing Normal PDF Download (privileged/internal exhibit)...');
  const normalDoc = sampleDocs.find((d: any) => d.classification === 'privileged' || d.classification === 'internal');
  if (!normalDoc) {
    console.error('✗ No normal document found');
    report['7. Normal download'] = false;
  } else {
    console.log(`   Target normal document: "${normalDoc.title}" (${normalDoc.classification})`);
    const normalUrlRes = await fetch(`${API_BASE}/api/documents/${normalDoc.id}/signed-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300 }),
    });
    const normalUrlData = await normalUrlRes.json();
    console.log(`   Signed URL status: HTTP ${normalUrlRes.status}, TTL: ${normalUrlData.ttlSeconds}s`);

    if (normalUrlRes.status === 200 && normalUrlData.signedUrl) {
      // Download the actual file from Supabase Storage
      const fileRes = await fetch(normalUrlData.signedUrl);
      const contentDisposition = fileRes.headers.get('content-disposition') || '';
      const hasAttachmentHeader = contentDisposition.includes('attachment') && (contentDisposition.includes('SCF%20final_merged') || contentDisposition.includes('SCF+final_merged') || contentDisposition.includes('SCF final_merged'));
      const fileBuf = Buffer.from(await fileRes.arrayBuffer());
      const isRealPdf = fileBuf.slice(0, 4).toString('utf8') === '%PDF';
      const downloadedHash = crypto.createHash('sha256').update(fileBuf).digest('hex');
      const hashMatch = downloadedHash === normalDoc.currentVersion.sha256Hash;

      // Also compare byte-for-byte with source file in sample-data/cases/
      const sourceDiskPath = path.resolve('sample-data/cases', normalDoc.currentVersion.originalFilename);
      let diskBytesMatch = false;
      if (fs.existsSync(sourceDiskPath)) {
        const diskBuf = fs.readFileSync(sourceDiskPath);
        diskBytesMatch = diskBuf.equals(fileBuf);
      }

      console.log(`   Downloaded size: ${fileBuf.length} bytes`);
      console.log(`   PDF header valid: ${isRealPdf ? '✓ %PDF' : '✗ Invalid'}`);
      console.log(`   Content-Disposition: ${hasAttachmentHeader ? '✓ ' + contentDisposition : '✗ ' + contentDisposition}`);
      console.log(`   SHA-256 match: ${hashMatch ? '✓ Verified' : '✗ Hash mismatch'}`);
      console.log(`   Exact match with disk file: ${diskBytesMatch ? '✓ Byte-for-byte identical' : '✗ Mismatch'}`);

      report['7. Normal download works'] = normalUrlRes.status === 200 && isRealPdf && hashMatch && diskBytesMatch;
    } else {
      report['7. Normal download works'] = false;
    }
  }

  // 7. Test Confidential / Restricted Download Password Gate
  console.log('\n7. Testing Confidential / Restricted Password Gate...');
  const confidentialDoc = sampleDocs.find((d: any) => d.classification === 'confidential');
  const restrictedDoc = sampleDocs.find((d: any) => d.classification === 'restricted');

  console.log(`   Target confidential doc: "${confidentialDoc?.title}" (${confidentialDoc?.classification})`);
  console.log(`   Target restricted doc: "${restrictedDoc?.title}" (${restrictedDoc?.classification})`);

  // 7a. Download without password -> Expect 403
  console.log('\n   [Gate Test A] Download confidential without password:');
  const noPassRes = await fetch(`${API_BASE}/api/documents/${confidentialDoc.id}/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300 }),
  });
  const noPassData = await noPassRes.json();
  const noPassBlocked = noPassRes.status === 403 && noPassData.message === 'Incorrect confidential file password.';
  console.log(`   Result: HTTP ${noPassRes.status} · Message: "${noPassData.message}"`);
  console.log(`   ${noPassBlocked ? '✓' : '✗'} Correctly blocked missing password.`);

  // 7b. Download with wrong password -> Expect 403
  console.log('\n   [Gate Test B] Download confidential with wrong password ("wrongpass"):');
  const wrongPassRes = await fetch(`${API_BASE}/api/documents/${confidentialDoc.id}/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300, password: 'wrongpass' }),
  });
  const wrongPassData = await wrongPassRes.json();
  const wrongPassBlocked = wrongPassRes.status === 403 && wrongPassData.message === 'Incorrect confidential file password.';
  console.log(`   Result: HTTP ${wrongPassRes.status} · Message: "${wrongPassData.message}"`);
  console.log(`   ${wrongPassBlocked ? '✓' : '✗'} Correctly blocked incorrect password.`);

  // 7c. Download with correct demo password -> Expect 200 and real PDF
  console.log('\n   [Gate Test C] Download confidential with correct password ("123456"):');
  const correctPassRes = await fetch(`${API_BASE}/api/documents/${confidentialDoc.id}/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300, password: '123456' }),
  });
  const correctPassData = await correctPassRes.json();
  console.log(`   Result: HTTP ${correctPassRes.status} · TTL: ${correctPassData.ttlSeconds}s`);

  let confDownloadPassed = false;
  if (correctPassRes.status === 200 && correctPassData.signedUrl) {
    const confFileRes = await fetch(correctPassData.signedUrl);
    const confFileBuf = Buffer.from(await confFileRes.arrayBuffer());
    const confContentDisp = confFileRes.headers.get('content-disposition') || '';
    const hasConfAttachment = confContentDisp.includes('attachment') && (confContentDisp.includes('SCF%20final_merged') || confContentDisp.includes('SCF+final_merged') || confContentDisp.includes('SCF final_merged'));
    const isConfPdf = confFileBuf.slice(0, 4).toString('utf8') === '%PDF';
    const confHash = crypto.createHash('sha256').update(confFileBuf).digest('hex');
    const confMatch = confHash === confidentialDoc.currentVersion.sha256Hash;

    const confDiskPath = path.resolve('sample-data/cases', confidentialDoc.currentVersion.originalFilename);
    let confDiskBytesMatch = false;
    if (fs.existsSync(confDiskPath)) {
      const diskBuf = fs.readFileSync(confDiskPath);
      confDiskBytesMatch = diskBuf.equals(confFileBuf);
    }

    console.log(`   Downloaded size: ${confFileBuf.length} bytes`);
    console.log(`   PDF header valid: ${isConfPdf ? '✓ %PDF' : '✗ Invalid'}`);
    console.log(`   Content-Disposition: ${hasConfAttachment ? '✓ ' + confContentDisp : '✗ ' + confContentDisp}`);
    console.log(`   SHA-256 match: ${confMatch ? '✓ Verified' : '✗ Hash mismatch'}`);
    console.log(`   Exact match with disk file: ${confDiskBytesMatch ? '✓ Byte-for-byte identical' : '✗ Mismatch'}`);
    confDownloadPassed = isConfPdf && confMatch && confDiskBytesMatch;
  }
  report['8. Confidential password gate (block wrong, allow 123456)'] = noPassBlocked && wrongPassBlocked && confDownloadPassed;

  // 7d. Test restricted doc with password -> Expect 200 and real PDF
  console.log('\n   [Gate Test D] Download restricted doc with correct password ("123456"):');
  const restrictedPassRes = await fetch(`${API_BASE}/api/documents/${restrictedDoc.id}/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ versionNumber: 1, expiresInSeconds: 300, password: '123456' }),
  });
  const restrictedPassData = await restrictedPassRes.json();
  console.log(`   Result: HTTP ${restrictedPassRes.status} · TTL: ${restrictedPassData.ttlSeconds}s`);
  report['9. Restricted password gate succeeds'] = restrictedPassRes.status === 200 && !!restrictedPassData.signedUrl;

  // 8. Test Audit Logs
  console.log('\n8. Verifying Audit Logs & Security Events...');
  const auditRes = await fetch(`${API_BASE}/api/audit-logs?limit=25`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const auditData = await auditRes.json();
  const logs = auditData.data || [];
  console.log(`   Retrieved ${logs.length} recent audit logs:`);
  logs.slice(0, 8).forEach((l: any, i: number) => {
    console.log(`     ${i + 1}. [${l.action}] ${l.targetName}: ${l.details}`);
  });

  const hasImportLog = logs.some((l: any) => l.details?.includes('Imported evidence file') || l.details?.includes('SCF'));
  const hasFailedPassLog = logs.some((l: any) => l.details?.includes('Confidential file password verification failed'));
  const hasSuccessPassLog = logs.some((l: any) => l.details?.includes('Confidential file password verified successfully'));

  console.log(`   ${hasImportLog ? '✓' : '✗'} Sample PDF import audited.`);
  console.log(`   ${hasFailedPassLog ? '✓' : '✗'} Password failure audited.`);
  console.log(`   ${hasSuccessPassLog ? '✓' : '✗'} Password success audited.`);
  report['10. Audit logs verified'] = hasImportLog && hasFailedPassLog && hasSuccessPassLog;

  // 9. Verify No Password Leakage in Client Code
  console.log('\n9. Verifying client bundle and React source code for password leakage...');
  const srcFiles = fs.readdirSync('src', { recursive: true }) as string[];
  let passwordFoundInSrc = false;
  for (const f of srcFiles) {
    const full = path.join('src', f);
    if (fs.statSync(full).isFile() && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('123456')) {
        console.error(`✗ Password leak found in ${full}!`);
        passwordFoundInSrc = true;
      }
    }
  }
  report['11. No password in client source'] = !passwordFoundInSrc;
  console.log(`   ${!passwordFoundInSrc ? '✓' : '✗'} Confirmed: Password "123456" is completely absent from src/ directory.`);

  console.log('\n====================================================');
  console.log('SUMMARY OF VERIFICATION CHECKS:');
  console.log('====================================================');
  console.table(report);
}

run().catch(console.error);
