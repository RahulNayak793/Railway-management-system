const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- Starting Railway Train Type & Name Separation Validation ---');

  // 1. Fetch general trains and check train_type vs train_name
  console.log('\n1. Testing GET /api/trains all trains schema...');
  const allRes = await axios.get(`${BASE_URL}/trains?include_all=true`);
  assert.strictEqual(allRes.status, 200);
  const allTrains = allRes.data;
  console.log(`Fetched ${allTrains.length} trains.`);

  const ALLOWED_TRAIN_TYPES = [
    'Rajdhani',
    'Shatabdi',
    'Vande Bharat',
    'Duronto',
    'Humsafar',
    'Superfast',
    'Express',
    'Special / Other'
  ];

  for (const t of allTrains) {
    assert(t.train_number, `Train missing train_number: ${JSON.stringify(t)}`);
    assert(t.train_name, `Train missing train_name: ${JSON.stringify(t)}`);
    assert(t.train_type, `Train missing train_type: ${JSON.stringify(t)}`);
    assert(ALLOWED_TRAIN_TYPES.includes(t.train_type), `Train ${t.train_number} has invalid train_type: ${t.train_type}`);
    assert.notStrictEqual(t.train_name.toLowerCase().trim(), t.train_type.toLowerCase().trim(),
      `Train ${t.train_number} has train_name equal to train_type: ${t.train_name}`);
  }
  console.log('✓ All trains have distinct train_number, train_name, and valid train_type (1 of 8 allowed categories).');

  // 2. Test Rajdhani filter
  console.log('\n2. Testing Rajdhani filter...');
  const rajRes = await axios.get(`${BASE_URL}/trains?train_type=Rajdhani&include_all=true`);
  assert.strictEqual(rajRes.status, 200);
  console.log(`Found ${rajRes.data.length} Rajdhani trains.`);
  assert(rajRes.data.length > 0, 'Expected at least 1 Rajdhani train');
  for (const t of rajRes.data) {
    assert.strictEqual(t.train_type, 'Rajdhani', `Expected Rajdhani train_type but got: ${t.train_type}`);
  }
  console.log('✓ Rajdhani filter returns only Rajdhani-type trains.');

  // 3. Test Shatabdi filter
  console.log('\n3. Testing Shatabdi filter...');
  const shatRes = await axios.get(`${BASE_URL}/trains?train_type=Shatabdi&include_all=true`);
  assert.strictEqual(shatRes.status, 200);
  console.log(`Found ${shatRes.data.length} Shatabdi trains.`);
  assert(shatRes.data.length > 0, 'Expected at least 1 Shatabdi train');
  for (const t of shatRes.data) {
    assert.strictEqual(t.train_type, 'Shatabdi', `Expected Shatabdi train_type but got: ${t.train_type}`);
  }
  console.log('✓ Shatabdi filter returns only Shatabdi-type trains.');

  // 4. Test Vande Bharat filter
  console.log('\n4. Testing Vande Bharat filter...');
  const vbRes = await axios.get(`${BASE_URL}/trains?train_type=Vande%20Bharat&include_all=true`);
  assert.strictEqual(vbRes.status, 200);
  console.log(`Found ${vbRes.data.length} Vande Bharat trains.`);
  assert(vbRes.data.length > 0, 'Expected at least 1 Vande Bharat train');
  for (const t of vbRes.data) {
    assert.strictEqual(t.train_type, 'Vande Bharat', `Expected Vande Bharat train_type but got: ${t.train_type}`);
  }
  console.log('✓ Vande Bharat filter returns only Vande Bharat-type trains.');

  // 5. Test Superfast filter
  console.log('\n5. Testing Superfast filter...');
  const sfRes = await axios.get(`${BASE_URL}/trains?train_type=Superfast&include_all=true`);
  assert.strictEqual(sfRes.status, 200);
  console.log(`Found ${sfRes.data.length} Superfast trains.`);
  assert(sfRes.data.length > 0, 'Expected at least 1 Superfast train');
  for (const t of sfRes.data) {
    assert.strictEqual(t.train_type, 'Superfast', `Expected Superfast train_type but got: ${t.train_type}`);
  }
  console.log('✓ Superfast filter returns only Superfast-type trains.');

  // 6. Test Express filter
  console.log('\n6. Testing Express filter...');
  const expRes = await axios.get(`${BASE_URL}/trains?train_type=Express&include_all=true`);
  assert.strictEqual(expRes.status, 200);
  console.log(`Found ${expRes.data.length} Express trains.`);
  assert(expRes.data.length > 0, 'Expected at least 1 Express train');
  for (const t of expRes.data) {
    assert.strictEqual(t.train_type, 'Express', `Expected Express train_type but got: ${t.train_type}`);
  }
  console.log('✓ Express filter returns only Express-type trains.');

  // 7. Test Live Search with train_type filter
  console.log('\n7. Testing GET /api/trains/live-search with train_type=Rajdhani...');
  const liveRes = await axios.get(`${BASE_URL}/trains/live-search?from=NDLS&to=MMCT&date=2026-10-15&train_type=Rajdhani`);
  assert.strictEqual(liveRes.status, 200);
  assert(liveRes.data.success);
  console.log(`Found ${liveRes.data.trains.length} live matching trains for NDLS->MMCT.`);
  for (const t of liveRes.data.trains) {
    assert.strictEqual(t.train_type, 'Rajdhani', `Live search returned non-Rajdhani train: ${t.train_name} (${t.train_type})`);
  }
  console.log('✓ Live Search filter strictly honors train.train_type.');

  // 8. Test updating train_type without modifying train_name
  console.log('\n8. Testing train edit: changing train_type does NOT modify train_name...');
  const targetTrain = allTrains.find(t => String(t.train_number) === '12951') || allTrains[0];
  const originalName = targetTrain.train_name;
  const originalType = targetTrain.train_type;

  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { id: 'usr-admin', role: 'admin', permissions: ['ALL', 'MANAGE_TRAIN_SCHEDULES'] },
    process.env.JWT_SECRET || 'your-secret-key'
  );

  const authHeaders = { Authorization: `Bearer ${token}` };
  
  // Update train type only
  const updateRes = await axios.put(`${BASE_URL}/trains/${targetTrain.id}`, {
    train_type: 'Special / Other'
  }, { headers: authHeaders });

  assert.strictEqual(updateRes.status, 200);
  const updated = updateRes.data.train;
  assert.strictEqual(updated.train_type, 'Special / Other', 'Expected train_type to be updated to Special / Other');
  assert.strictEqual(updated.train_name, originalName, 'Expected train_name to remain completely unchanged when train_type changes');

  // Verify reverse: updating train name only does NOT modify train_type
  const updateNameRes = await axios.put(`${BASE_URL}/trains/${targetTrain.id}`, {
    train_name: 'Mumbai Central - New Delhi Premium Rajdhani Express'
  }, { headers: authHeaders });

  assert.strictEqual(updateNameRes.status, 200);
  const updatedName = updateNameRes.data.train;
  assert.strictEqual(updatedName.train_type, 'Special / Other', 'Expected train_type to remain completely unchanged when train_name changes');
  assert.strictEqual(updatedName.train_name, 'Mumbai Central - New Delhi Premium Rajdhani Express');

  // Revert back
  await axios.put(`${BASE_URL}/trains/${targetTrain.id}`, {
    train_name: originalName,
    train_type: originalType
  }, { headers: authHeaders });

  console.log('✓ Verified: Changing train type does NOT modify train name.');
  console.log('✓ Verified: Changing train name does NOT modify train type.');

  console.log('\n======================================================');
  console.log(' ALL TRAIN TYPE & NAME SEPARATION TESTS PASSED 100%! ');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('Validation FAILED:', err.message);
  if (err.response?.data) console.error('Response data:', err.response.data);
  process.exit(1);
});
