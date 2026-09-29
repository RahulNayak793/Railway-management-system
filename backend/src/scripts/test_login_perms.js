async function checkLogin() {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maheshny@gmail.com', password: 'password', portal: 'staff' })
  });
  const data = await res.json();
  console.log('Login Response Status:', res.status);
  console.log('User Role:', data.user ? data.user.role : null);
  console.log('User Permissions:', data.user ? data.user.permissions : null);
  return data;
}

checkLogin().catch(console.error);
