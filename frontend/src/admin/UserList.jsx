import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { 
  Users, 
  Search, 
  Eye, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Award, 
  Calendar, 
  Shield 
} from 'lucide-react';

export const UserList = ({ onLogGenerated }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [masteryData, setMasteryData] = useState(null);
  const [masteryLoading, setMasteryLoading] = useState(false);
  const [deleteCourseId, setDeleteCourseId] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/admin/users');
      setUsers(response.data || []);
      if (onLogGenerated) onLogGenerated();
    } catch (err) {
      console.error('Error fetching admin users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInspectMastery = async (user) => {
    setSelectedUser(user);
    setMasteryLoading(true);
    setMasteryData(null);
    try {
      const response = await apiClient.get(`/admin/users/${user.id}/mastery`);
      setMasteryData(response.data);
      if (onLogGenerated) onLogGenerated();
    } catch (err) {
      console.error('Error fetching user mastery:', err);
    } finally {
      setMasteryLoading(false);
    }
  };

  const handleDeleteCourse = async (e) => {
    e.preventDefault();
    if (!deleteCourseId.trim()) return;

    setDeleting(true);
    setActionError('');
    setActionSuccess('');

    try {
      const response = await apiClient.delete(`/admin/courses/${deleteCourseId.trim()}`);
      setActionSuccess(response.data?.message || 'Course successfully deleted.');
      setDeleteCourseId('');
      setShowDeleteModal(false);
      if (onLogGenerated) onLogGenerated();
    } catch (err) {
      console.error('Error deleting course:', err);
      setActionError(err.response?.data?.detail || 'Failed to delete course. Verify Course ID.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <h2 className="sr-only">Platform User Accounts</h2>
      <div className="bg-[var(--bg-card)] p-4 sm:p-6 rounded-2xl border border-[var(--border)] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            id="admin-search-users-input"
            name="admin-search-users"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by email, role, or ID..."
            aria-label="Search users by email, role, or ID"
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50 transition flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          <span>Delete Course via Admin</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">Registered Platform Users and Roles</caption>
            <thead className="bg-[var(--bg-card-hover)] border-b border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4">User</th>
                <th scope="col" className="px-6 py-4">Role</th>
                <th scope="col" className="px-6 py-4">User ID</th>
                <th scope="col" className="px-6 py-4">Joined Date</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-2" aria-hidden="true" />
                    <span>Loading platform users...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    No users match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs" aria-hidden="true">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-[var(--text-primary)]">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                        u.role === 'admin'
                          ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                          : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                      }`}>
                        {u.role === 'admin' && <Shield className="w-3 h-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />}
                        <span>{u.role}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-[var(--text-secondary)]">
                      {u.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleInspectMastery(u)}
                        aria-label={`Inspect mastery profile for ${u.email}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/60 transition"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Inspect Mastery</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down Mastery Modal */}
      {selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-mastery-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-[var(--border)] shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center" aria-hidden="true">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="user-mastery-modal-title" className="text-base font-bold text-[var(--text-primary)]">Student Mastery Profile</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{selectedUser.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Close student mastery profile modal"
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {masteryLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs text-[var(--text-secondary)]">Loading student mastery records...</p>
              </div>
            ) : !masteryData?.records || masteryData.records.length === 0 ? (
              <div className="py-8 text-center text-[var(--text-secondary)] text-xs">
                No mastery records found for this student.
              </div>
            ) : (
              <div className="space-y-3">
                {masteryData.records.map((rec) => {
                  const pct = Math.round(rec.score_0to1 * 100);
                  return (
                    <div key={rec.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card-hover)]">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-[var(--text-primary)]">{rec.topic}</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{pct}% Mastery ({rec.attempts_count} attempts)</span>
                      </div>
                      <div
                        className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label={`Mastery for ${rec.topic}: ${pct}%`}
                      >
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Close user profile modal"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-card-hover)] border border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-delete-course-title"
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[var(--border)] shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center" aria-hidden="true">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 id="admin-delete-course-title" className="text-base font-bold text-[var(--text-primary)]">Delete Course</h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Administrative action: This will permanently remove the course, associated curriculum modules, questions, attempts, and vector store embeddings.
            </p>

            <form onSubmit={handleDeleteCourse} className="space-y-4">
              <div>
                <label htmlFor="admin-delete-course-id-input" className="block text-xs font-semibold uppercase text-[var(--text-primary)] mb-1">
                  Course ID
                </label>
                <input
                  id="admin-delete-course-id-input"
                  name="deleteCourseId"
                  type="text"
                  required
                  value={deleteCourseId}
                  onChange={(e) => setDeleteCourseId(e.target.value)}
                  placeholder="Paste Course UUID to delete..."
                  aria-label="Course UUID to delete"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  aria-label="Cancel course deletion"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-card-hover)] border border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deleteCourseId.trim()}
                  aria-label="Confirm course deletion"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>Confirm Delete</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
