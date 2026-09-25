import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../server/supabase';

async function updateRecords() {
  console.log('--- Updating 12 sample case documents in DB ---');
  const sampleMap = [
    { num: '', filename: 'SCF final_merged.pdf' },
    { num: '1', filename: 'SCF final_merged1.pdf' },
    { num: '2', filename: 'SCF final_merged2.pdf' },
    { num: '3', filename: 'SCF final_merged3.pdf' },
    { num: '4', filename: 'SCF final_merged4.pdf' },
    { num: '5', filename: 'SCF final_merged5.pdf' },
    { num: '6', filename: 'SCF final_merged6.pdf' },
    { num: '7', filename: 'SCF final_merged7.pdf' },
    { num: '8', filename: 'SCF final_merged8.pdf' },
    { num: '9', filename: 'SCF final_merged9.pdf' },
    { num: '10', filename: 'SCF final_merged10.pdf' },
    { num: '11', filename: 'SCF final_merged11.pdf' },
  ];

  for (const item of sampleMap) {
    const pattern = '%SCF_final_merged' + item.num + '.pdf%';
    const { data: docs } = await supabaseAdmin
      .from('documents')
      .select('id, title, file_name, storage_path')
      .ilike('storage_path', pattern);

    if (docs && docs.length > 0) {
      for (const doc of docs) {
        console.log(`Updating document ${doc.id} from "${doc.title}" to "${item.filename}"`);
        await supabaseAdmin
          .from('documents')
          .update({
            title: item.filename,
            file_name: item.filename,
          })
          .eq('id', doc.id);

        await supabaseAdmin
          .from('document_versions')
          .update({
            original_filename: item.filename,
          })
          .eq('document_id', doc.id);
      }
    }
  }

  console.log('--- Ensuring the other 8 documents in storage have valid PDF binaries ---');
  const { data: otherDocs } = await supabaseAdmin
    .from('documents')
    .select('id, title, storage_path')
    .not('storage_path', 'ilike', '%SCF%');

  const samplePdf = fs.readFileSync(path.resolve('sample-data/cases/SCF final_merged.pdf'));

  for (const doc of otherDocs || []) {
    const cleanPath = doc.storage_path.replace('evidence-documents/', '');
    console.log(`Ensuring storage for "${doc.title}" at ${cleanPath}`);
    const { error } = await supabaseAdmin.storage
      .from('evidence-documents')
      .upload(cleanPath, samplePdf, { upsert: true, contentType: 'application/pdf' });
    if (error) {
      console.warn(`Storage upload warning for ${cleanPath}:`, error.message);
    }
  }

  console.log('--- Finished updates successfully ---');
  process.exit(0);
}

updateRecords().catch((err) => {
  console.error(err);
  process.exit(1);
});
