import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const MATTERS = {
  MAT_018: 'aaaaaaaa-1111-4aaa-aaaa-111111111111', // Northstar v. Meridian (active)
  MAT_022: 'bbbbbbbb-2222-4bbb-bbbb-222222222222', // Project Lighthouse (active)
  MAT_011: 'cccccccc-3333-4ccc-cccc-333333333333', // Atlas Vendor Review (active)
  MAT_044: 'dddddddd-4444-4ddd-dddd-444444444444', // Aster Compliance Inquiry (archived)
};

const SAMPLE_ASSIGNMENTS = [
  {
    sampleFilename: 'SCF final_merged.pdf',
    matterId: MATTERS.MAT_018,
    title: 'Supreme Court Filing — Evidence Exhibit A',
    classification: 'privileged',
  },
  {
    sampleFilename: 'SCF final_merged1.pdf',
    matterId: MATTERS.MAT_018,
    title: 'Supreme Court Filing — Evidence Exhibit 1',
    classification: 'confidential',
  },
  {
    sampleFilename: 'SCF final_merged2.pdf',
    matterId: MATTERS.MAT_018,
    title: 'Supreme Court Filing — Evidence Exhibit 2',
    classification: 'internal',
  },
  {
    sampleFilename: 'SCF final_merged3.pdf',
    matterId: MATTERS.MAT_022,
    title: 'Supreme Court Filing — Evidence Exhibit 3',
    classification: 'restricted',
  },
  {
    sampleFilename: 'SCF final_merged4.pdf',
    matterId: MATTERS.MAT_022,
    title: 'Supreme Court Filing — Evidence Exhibit 4',
    classification: 'privileged',
  },
  {
    sampleFilename: 'SCF final_merged5.pdf',
    matterId: MATTERS.MAT_022,
    title: 'Supreme Court Filing — Evidence Exhibit 5',
    classification: 'internal',
  },
  {
    sampleFilename: 'SCF final_merged6.pdf',
    matterId: MATTERS.MAT_011,
    title: 'Supreme Court Filing — Evidence Exhibit 6',
    classification: 'confidential',
  },
  {
    sampleFilename: 'SCF final_merged7.pdf',
    matterId: MATTERS.MAT_011,
    title: 'Supreme Court Filing — Evidence Exhibit 7',
    classification: 'privileged',
  },
  {
    sampleFilename: 'SCF final_merged8.pdf',
    matterId: MATTERS.MAT_011,
    title: 'Supreme Court Filing — Evidence Exhibit 8',
    classification: 'internal',
  },
  {
    sampleFilename: 'SCF final_merged9.pdf',
    matterId: MATTERS.MAT_044,
    title: 'Supreme Court Filing — Evidence Exhibit 9',
    classification: 'restricted',
  },
  {
    sampleFilename: 'SCF final_merged10.pdf',
    matterId: MATTERS.MAT_044,
    title: 'Supreme Court Filing — Evidence Exhibit 10',
    classification: 'privileged',
  },
  {
    sampleFilename: 'SCF final_merged11.pdf',
    matterId: MATTERS.MAT_044,
    title: 'Supreme Court Filing — Evidence Exhibit 11',
    classification: 'internal',
  },
];

async function run() {
  console.log('1. Authenticating as Eleanor Raines (workspace_admin)...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'eleanor.raines@crownledger.internal',
    password: 'CrownLedgerDemo!2026#Secure',
  });

  if (authErr || !authData.session) {
    console.error('Authentication failed:', authErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log('   Authenticated successfully. Token acquired.');

  console.log('\n2. Querying GET /api/documents/sample-cases...');
  const listRes = await fetch('http://localhost:3000/api/documents/sample-cases', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = await listRes.json();
  console.log(`   Discovered ${listData.total} sample case files:`);
  listData.data?.forEach((f: any, i: number) => {
    console.log(`     ${i + 1}. ${f.filename} (${f.sizeFormatted})`);
  });

  if (listData.total !== 12) {
    console.error(`Expected 12 sample cases, but found ${listData.total}!`);
    process.exit(1);
  }

  console.log('\n3. Importing 12 sample PDFs through POST /api/documents/import-sample...');
  const results = [];

  for (const item of SAMPLE_ASSIGNMENTS) {
    console.log(`\n   Importing: ${item.sampleFilename} -> Matter: ${item.matterId} (${item.classification})`);
    const importRes = await fetch('http://localhost:3000/api/documents/import-sample', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...item,
        allowArchivedSampleImport: true,
      }),
    });

    const importData = await importRes.json();
    if (!importRes.ok) {
      console.error(`   Failed to import ${item.sampleFilename}:`, importData);
    } else {
      console.log(`   Success! Doc ID: ${importData.data?.id}`);
      console.log(`   Title: ${importData.data?.title}`);
      console.log(`   Storage Path: ${importData.data?.currentVersion?.storagePath}`);
      console.log(`   SHA-256: ${importData.data?.currentVersion?.sha256Hash}`);
      results.push({
        filename: item.sampleFilename,
        title: importData.data?.title,
        docId: importData.data?.id,
        classification: importData.data?.classification,
        matter: importData.data?.matterReference,
        storagePath: importData.data?.currentVersion?.storagePath,
        sha256: importData.data?.currentVersion?.sha256Hash,
        alreadyImported: importData.alreadyImported || false,
      });
    }
  }

  console.log('\n=============================================');
  console.log(`IMPORT COMPLETE: ${results.length} / 12 files successfully processed.`);
  console.log('=============================================');
  console.table(results);
}

run().catch(console.error);
