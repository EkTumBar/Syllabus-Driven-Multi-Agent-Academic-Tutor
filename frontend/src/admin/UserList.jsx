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
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by email, role, or ID..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
          <span>Delete Course via Admin</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">User ID</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                    <span>Loading platform users...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    No users match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                        u.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {u.role === 'admin' && <Shield className="w-3 h-3 text-purple-600" />}
                        <span>{u.role}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                      {u.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleInspectMastery(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Student Mastery Profile</h3>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {masteryLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading student mastery records...</p>
              </div>
            ) : !masteryData?.records || masteryData.records.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No mastery records found for this student.
              </div>
            ) : (
              <div className="space-y-3">
                {masteryData.records.map((rec) => {
                  const pct = Math.round(rec.score_0to1 * 100);
                  return (
                    <div key={rec.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-slate-800">{rec.topic}</span>
                        <span className="font-bold text-indigo-600">{pct}% Mastery ({rec.attempts_count} attempts)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
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
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Course</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Administrative action: This will permanently remove the course, associated curriculum modules, questions, attempts, and vector store embeddings.
            </p>

            <form onSubmit={handleDeleteCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Course ID
                </label>
                <input
                  type="text"
                  required
                  value={deleteCourseId}
                  onChange={(e) => setDeleteCourseId(e.target.value)}
                  placeholder="Paste Course UUID to delete..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deleteCourseId.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
