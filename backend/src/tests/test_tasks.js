const axios = require('axios');

async function testTaskFlow() {
  try {
    console.log('1. Logging in as Admin...');
    const adminLogin = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@railway.com',
      password: 'adminpassword123',
      portal: 'admin'
    });
    const adminToken = adminLogin.data.session?.access_token || adminLogin.data.token;
    console.log('✅ Admin authenticated.');

    console.log('2. Admin creating and assigning task to Staff...');
    const taskRes = await axios.post(
      'http://localhost:5000/api/staff/tasks',
      {
        staff_id: 'stf-1788361589156',
        title: 'Verify Morning Express Manifest (12951)',
        description: 'Inspect coach B1 to B4 passenger allocations',
        priority: 'HIGH',
        due_date: '2026-09-05',
        task_type: 'Manifest Verification'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log('✅ Task created:', taskRes.data.id, taskRes.data.title);

    console.log('3. Logging in as Staff...');
    const staffLogin = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'maheshny@gmail.com',
      password: 'staffpassword123',
      portal: 'staff'
    });
    const staffToken = staffLogin.data.session?.access_token || staffLogin.data.token;
    console.log('✅ Staff authenticated.');

    console.log('4. Staff fetching assigned tasks...');
    const staffTasks = await axios.get('http://localhost:5000/api/staff/tasks', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    console.log('✅ Staff task count:', staffTasks.data.length);

    console.log('5. Staff updating task status to In Progress...');
    const updateRes = await axios.patch(
      `http://localhost:5000/api/staff/tasks/${taskRes.data.id}`,
      { status: 'In Progress', remarks: 'Started inspecting coach B1' },
      { headers: { Authorization: `Bearer ${staffToken}` } }
    );
    console.log('✅ Task status updated to:', updateRes.data.task.status);

    console.log('6. Admin deleting task...');
    await axios.delete(`http://localhost:5000/api/staff/tasks/${taskRes.data.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Task deleted cleanly.');

    console.log('🎉 TASK MANAGEMENT END-TO-END FLOW VERIFIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Task Test Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testTaskFlow();
