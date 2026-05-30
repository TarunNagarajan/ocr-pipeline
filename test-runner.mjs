import fs from 'fs';

async function uploadFile(filename) {
  const buffer = fs.readFileSync(filename);
  const blob = new Blob([buffer]);
  const formData = new FormData();
  formData.append('file', blob, filename);

  const res = await fetch('http://localhost:4000/api/documents/process', {
    method: 'POST',
    body: formData
  });
  return res.json();
}

async function poll(id) {
  while (true) {
    const res = await fetch(`http://localhost:4000/api/documents/${id}/result`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        return data;
      }
      console.log(`... status: ${data.status} (${data.progress}%)`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function run() {
  const files = ['tmp-verify-degree.pdf', 'tmp-degree-image-degraded.png', 'tmp-unsupported-proposal.pdf'];
  
  for (const file of files) {
    console.log(`\n--- Testing ${file} ---`);
    let uploadRes = await uploadFile(file);
    console.log(`Uploaded ${file}, ID: ${uploadRes.id}`);
    
    let result = await poll(uploadRes.id);
    
    if (result.status === 'FAILED') {
      console.log(`Processing failed: ${result.errorMessage}`);
    } else {
      console.log(`Result for ${file}:`);
      console.log(JSON.stringify({
        reviewBand: result.result?.summary?.reviewBand,
        documentType: result.result?.summary?.documentType,
        holderName: result.result?.holder?.name?.value,
        institution: result.result?.credential?.institution?.value,
        degree: result.result?.credential?.degree?.value,
        warnings: result.result?.warnings
      }, null, 2));
    }
  }
}

run();
