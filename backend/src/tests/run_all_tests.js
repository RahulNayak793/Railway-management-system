const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = path.join(__dirname);
const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.js') && f !== 'run_all_tests.js')
  .sort();

console.log(`\n======================================================`);
console.log(`🧪 RUNNING FULL PROJECT BACKEND TEST SUITE (${testFiles.length} TEST FILES)`);
console.log(`======================================================\n`);

const results = [];
let passedCount = 0;
let failedCount = 0;

for (let i = 0; i < testFiles.length; i++) {
  const file = testFiles[i];
  const filePath = path.join(testsDir, file);
  process.stdout.write(`[${i + 1}/${testFiles.length}] Running ${file}... `);

  const start = Date.now();
  const res = spawnSync(process.execPath, [filePath], {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, NODE_ENV: 'test' },
    timeout: 60000,
    encoding: 'utf8'
  });
  const duration = ((Date.now() - start) / 1000).toFixed(1);

  if (res.status === 0) {
    console.log(`✅ PASSED (${duration}s)`);
    passedCount++;
    results.push({ file, status: 'PASSED', duration });
  } else {
    console.log(`❌ FAILED (${duration}s) [Exit Code: ${res.status}]`);
    failedCount++;
    const errMsg = (res.stderr || res.stdout || 'Unknown error').trim().split('\n').slice(-5).join('\n');
    results.push({ file, status: 'FAILED', duration, error: errMsg });
  }
}

console.log(`\n======================================================`);
console.log(`📊 FINAL BACKEND TEST SUITE SUMMARY`);
console.log(`======================================================`);
console.log(`Total Test Files Executed: ${testFiles.length}`);
console.log(`Passed:                   ${passedCount}`);
console.log(`Failed:                   ${failedCount}`);
console.log(`Skipped:                  0`);
console.log(`Exit Code:                ${failedCount === 0 ? 0 : 1}`);
console.log(`======================================================\n`);

if (failedCount > 0) {
  console.log(`Failed test files:`);
  results.filter(r => r.status === 'FAILED').forEach(r => {
    console.log(`- ${r.file}:\n  ${r.error.split('\n').join('\n  ')}\n`);
  });
}

process.exit(failedCount === 0 ? 0 : 1);
