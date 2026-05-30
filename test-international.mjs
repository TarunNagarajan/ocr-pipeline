import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:4000/api/documents/process';

async function testUpload(filePath) {
  console.log(`\nTesting ${path.basename(filePath)}...`);
  
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  formData.append('file', blob, path.basename(filePath));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      console.error(`Failed to upload ${filePath}: ${response.statusText}`);
      return;
    }
    
    const result = await response.json();
    console.log(`Uploaded! Document ID: ${result.id}`);
    
    // Poll for status
    let status = 'UPLOADED';
    while (status !== 'COMPLETED' && status !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusRes = await fetch(`http://localhost:4000/api/documents/${result.id}/status`);
      const statusData = await statusRes.json();
      status = statusData.status;
      process.stdout.write(`.` + status + `.`);
    }
    
    console.log('\nFinal Status:', status);
    
    if (status === 'COMPLETED') {
      const docRes = await fetch(`http://localhost:4000/api/documents/${result.id}/result`);
      const docData = await docRes.json();
      console.log('Extracted Fields:');
      for (const [key, field] of Object.entries(docData.fields || {})) {
        console.log(`  - ${key}: ${field.value} (Confidence: ${field.confidence})`);
      }
    }
    
  } catch (err) {
    console.error(`Error testing ${filePath}:`, err);
  }
}

async function runTests() {
  const artifactDir = 'C:\\Users\\ultim\\.gemini\\antigravity-cli\\brain\\29b77f9c-bce4-410c-9d26-e670a633226d';
  const files = [
    'skewed_degree_photo_1780116037998.png',
    'drivers_license_photo_1780116064787.png',
    'crumpled_receipt_1780116096202.png',
    'french_passport_1780116420501.png',
    'japanese_degree_1780116444937.png'
  ];
  
  for (const file of files) {
    await testUpload(path.join(artifactDir, file));
  }
}

runTests();
