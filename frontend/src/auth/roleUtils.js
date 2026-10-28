/**
 * Role resolution and dynamic badge styling utility.
 * 
 * Conditional Logic:
 * - Admin: Logged in with administrative privileges -> "Admin"
 * - Student: Logged in as standard user/student -> "Student"
 * - Guest: Not logged in (visitor) or has a guest account -> "Guest"
 *
 * Pulls role from authentication state or session/local storage.
 */

/**
 * Resolves the dynamic role label based on user auth state and session data.
 *
 * @param {Object|null} user - Current user object
 * @param {boolean|null} isAuthenticated - Explicit authentication boolean (optional)
 * @returns {'Admin' | 'Student' | 'Guest'}
 */
export function getUserRole(user = null, isAuthenticated = null) {
  let currentUser = user;

  // Fallback to checking session or local storage if user was not passed directly
  if (!currentUser && typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (stored) {
        currentUser = JSON.parse(stored);
      }
    } catch {
      currentUser = null;
    }
  }

  // Determine token presence in local or session storage
  const hasToken = typeof window !== 'undefined'
    ? Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'))
    : false;

  // Determine whether current user is authenticated
  const isAuth = isAuthenticated !== null
    ? Boolean(isAuthenticated)
    : Boolean(currentUser && hasToken);

  // 1. Not logged in (visitor) -> "Guest"
  if (!isAuth || !currentUser) {
    return 'Guest';
  }

  const rawRole = (currentUser.role || '').toString().trim().toLowerCase();

  // 2. Guest account -> "Guest"
  if (rawRole === 'guest' || currentUser.is_guest === true) {
    return 'Guest';
  }

  // 3. Administrative privileges -> "Admin"
  if (
    rawRole === 'admin' ||
    rawRole === 'administrator' ||
    currentUser.is_admin === true
  ) {
    return 'Admin';
  }

  // 4. Standard user / student -> "Student"
  return 'Student';
}

/**
 * Returns Tailwind CSS styling classes for the role badge so it fits
 * cleanly in the exact UI location where "pro member" was previously displayed.
 *
 * @param {'Admin' | 'Student' | 'Guest' | string} role
 * @returns {string}
 */
export function getRoleBadgeStyle(role) {
  switch (role) {
    case 'Admin':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs shadow-amber-500/10';
    case 'Student':
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-xs shadow-indigo-500/10';
    case 'Guest':
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

/**
 * Access level description for permissions auditing and UI inspection.
 *
 * @param {'Admin' | 'Student' | 'Guest' | string} role
 * @returns {{ level: string, label: string, description: string }}
 */
export function getRoleAccessLevel(role) {
  switch (role) {
    case 'Admin':
      return {
        level: 'admin',
        label: 'Administrative Control',
        description: 'Full administrative access and user management',
      };
    case 'Student':
      return {
        level: 'student',
        label: 'Standard Academic Learner',
        description: 'Curriculum learning, mastery analytics, and tutoring access',
      };
    case 'Guest':
    default:
      return {
        level: 'guest',
        label: 'Guest Visitor',
        description: 'Public visitor or restricted guest access',
      };
  }
}
