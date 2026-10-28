import assert from 'node:assert';
import { getUserRole, getRoleBadgeStyle, getRoleAccessLevel } from './src/auth/roleUtils.js';

console.log('--- Testing getUserRole and Access Logic ---');

// 1. Administrative Privileges -> "Admin"
assert.strictEqual(
  getUserRole({ email: 'admin@univ.edu', role: 'admin' }, true),
  'Admin',
  'Should return Admin when role is admin'
);

assert.strictEqual(
  getUserRole({ email: 'admin@univ.edu', role: 'administrator' }, true),
  'Admin',
  'Should return Admin when role is administrator'
);

assert.strictEqual(
  getUserRole({ email: 'admin@univ.edu', is_admin: true }, true),
  'Admin',
  'Should return Admin when is_admin flag is true'
);

// 2. Standard user/student -> "Student"
assert.strictEqual(
  getUserRole({ email: 'student@univ.edu', role: 'student' }, true),
  'Student',
  'Should return Student when role is student'
);

assert.strictEqual(
  getUserRole({ email: 'student@univ.edu', role: 'user' }, true),
  'Student',
  'Should return Student when role is user'
);

assert.strictEqual(
  getUserRole({ email: 'student@univ.edu' }, true),
  'Student',
  'Should return Student by default when user is authenticated'
);

// 3. Not logged in (visitor) or guest account -> "Guest"
assert.strictEqual(
  getUserRole(null, false),
  'Guest',
  'Should return Guest when user is null and unauthenticated'
);

assert.strictEqual(
  getUserRole(undefined, false),
  'Guest',
  'Should return Guest when user is undefined and unauthenticated'
);

assert.strictEqual(
  getUserRole({ email: 'guest@univ.edu', role: 'guest' }, true),
  'Guest',
  'Should return Guest when user role is guest'
);

assert.strictEqual(
  getUserRole({ email: 'visitor@univ.edu', is_guest: true }, true),
  'Guest',
  'Should return Guest when is_guest flag is true'
);

// 4. Test Badge Styles
const adminStyle = getRoleBadgeStyle('Admin');
assert.ok(adminStyle.includes('amber'), 'Admin badge should use amber color scheme');

const studentStyle = getRoleBadgeStyle('Student');
assert.ok(studentStyle.includes('indigo'), 'Student badge should use indigo color scheme');

const guestStyle = getRoleBadgeStyle('Guest');
assert.ok(guestStyle.includes('slate'), 'Guest badge should use slate color scheme');

// 5. Test Access Levels
assert.strictEqual(getRoleAccessLevel('Admin').level, 'admin');
assert.strictEqual(getRoleAccessLevel('Student').level, 'student');
assert.strictEqual(getRoleAccessLevel('Guest').level, 'guest');

console.log('All role logic tests PASSED successfully!');
