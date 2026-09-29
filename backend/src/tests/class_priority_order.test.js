const assert = require('assert');
const { 
  CLASS_PRIORITY, 
  normalizeClassList, 
  getDefaultClassesForTrain 
} = require('../utils/trainClasses');

function runClassPriorityTests() {
  console.log('\n--- 🧪 RUNNING IRCTC-STYLE CLASS PRIORITY ORDER & FILTERING TESTS ---');

  // Test 1: SL appears before 3E
  console.log('Test 1: Verification SL (prio 1) appears before 3E (prio 2)...');
  const input1 = ['3E', 'SL'];
  const res1 = normalizeClassList(input1);
  assert.deepStrictEqual(res1, ['SL', '3E'], 'SL must be ordered before 3E');
  console.log('✅ Test 1 Passed: SL precedes 3E');

  // Test 2: 3E appears before 3A
  console.log('Test 2: Verification 3E (prio 2) appears before 3A (prio 3)...');
  const input2 = ['3A', '3E'];
  const res2 = normalizeClassList(input2);
  assert.deepStrictEqual(res2, ['3E', '3A'], '3E must be ordered before 3A');
  console.log('✅ Test 2 Passed: 3E precedes 3A');

  // Test 3: 3A appears before 2A
  console.log('Test 3: Verification 3A (prio 3) appears before 2A (prio 4)...');
  const input3 = ['2A', '3A'];
  const res3 = normalizeClassList(input3);
  assert.deepStrictEqual(res3, ['3A', '2A'], '3A must be ordered before 2A');
  console.log('✅ Test 3 Passed: 3A precedes 2A');

  // Test 4: 2A appears before 1A
  console.log('Test 4: Verification 2A (prio 4) appears before 1A (prio 5)...');
  const input4 = ['1A', '2A'];
  const res4 = normalizeClassList(input4);
  assert.deepStrictEqual(res4, ['2A', '1A'], '2A must be ordered before 1A');
  console.log('✅ Test 4 Passed: 2A precedes 1A');

  // Test 5: Unsupported classes are not displayed
  console.log('Test 5: Unsupported classes are omitted from train class list...');
  const rajdhaniSupported = getDefaultClassesForTrain('New Delhi Rajdhani', 'Superfast');
  assert.strictEqual(rajdhaniSupported.includes('2S'), false, 'Rajdhani should not support 2S');
  assert.strictEqual(rajdhaniSupported.includes('GEN'), false, 'Rajdhani should not support GEN');
  console.log('✅ Test 5 Passed: Unsupported classes safely omitted');

  // Test 6 & 7: Classes are not alphabetically sorted and API input order is overridden by priority
  console.log('Test 6 & 7: API/Database randomized class order is strictly overridden by railway priority...');
  const randomizedApiOrder = ['2S', '1A', 'CC', 'SL', '3A', '2A', 'EC', '3E'];
  const sortedPriority = normalizeClassList(randomizedApiOrder);
  const expectedPriority = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', '1A'];
  assert.deepStrictEqual(sortedPriority, expectedPriority, 'Input list must be sorted strictly by CLASS_PRIORITY');
  console.log('✅ Test 6 & 7 Passed: Priority order strictly enforced regardless of DB/API order');

  // Test 8: All Classes displays all supported classes in priority
  console.log('Test 8: All Classes returns all supported train classes in priority...');
  const expressSupported = getDefaultClassesForTrain('Express Train', 'Express');
  assert.deepStrictEqual(expressSupported, ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'], 'Express supported classes must follow priority');
  console.log('✅ Test 8 Passed: All Classes returns supported classes in order');

  // Test 9 & 10: Selected class normalization
  console.log('Test 9 & 10: Class normalization handles code strings and objects...');
  const mixedInput = [{ code: '3A' }, 'SL', '2A (AC 2-Tier)'];
  const normalizedMixed = normalizeClassList(mixedInput);
  assert.deepStrictEqual(normalizedMixed, ['SL', '3A', '2A']);
  console.log('✅ Test 9 & 10 Passed: Mixed class structures normalized and sorted');

  // Test 11 - 15: Priority values integrity
  console.log('Test 11-15: Verifying CLASS_PRIORITY table completeness...');
  assert.strictEqual(CLASS_PRIORITY['SL'], 1);
  assert.strictEqual(CLASS_PRIORITY['3E'], 2);
  assert.strictEqual(CLASS_PRIORITY['3A'], 3);
  assert.strictEqual(CLASS_PRIORITY['2A'], 4);
  assert.strictEqual(CLASS_PRIORITY['CC'], 5);
  assert.strictEqual(CLASS_PRIORITY['EC'], 6);
  assert.strictEqual(CLASS_PRIORITY['2S'], 7);
  assert.strictEqual(CLASS_PRIORITY['GEN'], 8);
  assert.strictEqual(CLASS_PRIORITY['1A'], 9);
  assert.strictEqual(CLASS_PRIORITY['FC'], 10);
  assert.strictEqual(CLASS_PRIORITY['EA'], 11);
  assert.strictEqual(CLASS_PRIORITY['EV'], 12);
  assert.strictEqual(CLASS_PRIORITY['VC'], 13);
  console.log('✅ Test 11-15 Passed: CLASS_PRIORITY mapping is complete and exact');

  console.log('\n🎉 ALL 15 IRCTC-STYLE CLASS PRIORITY TESTS PASSED SUCCESSFULLY! 🎉');
}

runClassPriorityTests();
