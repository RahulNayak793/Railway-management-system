const path = require('path');
const { mockDb } = require('../config/supabase');

const maheshEmail = 'maheshny@gmail.com';

let staffProf = Array.from(mockDb.staff_profiles.values()).find(
  sp => sp && sp.email && sp.email.trim().toLowerCase() === maheshEmail
);

console.log('staffProf from mockDb:', staffProf);
if (staffProf) {
  console.log('staffProf.id:', staffProf.id);
  console.log('staffProf.permissions:', staffProf.permissions);
  console.log('staff_permissions.get(staffProf.id):', mockDb.staff_permissions.get(staffProf.id));
}
