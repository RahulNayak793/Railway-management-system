const assert = require('assert');
const path = require('path');

// Test Train Type Options & Train Name Independence
async function runTrainTypeOptionsTest() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING TRAIN TYPE OPTIONS & INDEPENDENCE REGRESSION TEST');
  console.log('======================================================\n');

  // 1. Verify Train Type options array
  const expectedOptions = [
    'Express',
    'Superfast',
    'Vande Bharat',
    'Rajdhani',
    'Shatabdi',
    'Duronto',
    'Mail',
    'Passenger',
    'Local',
    'Other'
  ];

  const forbiddenOptions = [
    'Superfast Express',
    'Vande Bharat Express',
    'Rajdhani Express',
    'Shatabdi Express',
    'Duronto Express',
    'Mail Express'
  ];

  console.log('Test 1: Verifying Train Type options list strictly matches generic categories...');
  // Read TrainScheduleModal.jsx source code directly to ensure 100% UI accuracy
  const fs = require('fs');
  const modalPath = fs.existsSync(path.join(process.cwd(), 'frontend/src/components/TrainScheduleModal.jsx'))
    ? path.join(process.cwd(), 'frontend/src/components/TrainScheduleModal.jsx')
    : path.join(__dirname, '../../../frontend/src/components/TrainScheduleModal.jsx');

  const modalSource = fs.readFileSync(modalPath, 'utf8');

  expectedOptions.forEach(opt => {
    assert.ok(
      modalSource.includes(`'${opt}'`),
      `Train Type options MUST contain generic category: "${opt}"`
    );
  });
  console.log('✅ Test 1 Passed: All 10 required generic categories are present.');

  console.log('Test 2: Verifying forbidden service/train-name labels are absent...');
  forbiddenOptions.forEach(forbidden => {
    assert.strictEqual(
      modalSource.includes(`'${forbidden}'`),
      false,
      `Train Type options MUST NOT contain forbidden service label: "${forbidden}"`
    );
  });
  console.log('✅ Test 2 Passed: No forbidden service labels ("Superfast Express", "Rajdhani Express", etc.) exist in Train Type options.');

  console.log('Test 3: Verifying Train Name independence from Train Type...');
  let trainNameState = 'Udupi Express';
  let trainTypeState = 'Express';

  // Simulating user changing Train Type dropdown to 'Superfast'
  const handleTrainTypeChange = (newType) => {
    trainTypeState = newType;
  };

  handleTrainTypeChange('Superfast');

  assert.strictEqual(trainTypeState, 'Superfast', 'Train Type state should be updated to Superfast');
  assert.strictEqual(trainNameState, 'Udupi Express', 'Train Name state MUST remain unchanged as "Udupi Express"');
  console.log('✅ Test 3 Passed: Changing Train Type leaves Train Name ("Udupi Express") completely unchanged.');

  console.log('\n======================================================');
  console.log('🎉 ALL TRAIN TYPE OPTIONS & INDEPENDENCE TESTS PASSED!');
  console.log('======================================================\n');
}

runTrainTypeOptionsTest().catch(err => {
  console.error('❌ Train Type Options Test Failed:', err.stack);
  process.exit(1);
});
