import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { ShieldCheck, Search, RefreshCw, Loader2, Clock, User, Terminal } from 'lucide-react';

export const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/admin/logs');
      setLogs(response.data || []);
    } catch (err) {
      console.error('Error fetching admin logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    (log.admin_id && log.admin_id.toLowerCase().includes(search.toLowerCase())) ||
    (log.target_user_id && log.target_user_id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Search & Refresh */}
      <h2 className="sr-only">Platform Audit Log History</h2>
      <div className="bg-[var(--bg-card)] p-4 sm:p-6 rounded-2xl border border-[var(--border)] shadow-xs flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            id="admin-log-search-input"
            name="admin-log-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter logs by action, admin, or target user..."
            aria-label="Filter logs by action, admin, or target user"
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
          />
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          aria-label="Refresh audit logs"
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card)] border border-[var(--border)] transition flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">Platform Audit Logs and Governance Operations</caption>
            <thead className="bg-[var(--bg-card-hover)] border-b border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4">Timestamp</th>
                <th scope="col" className="px-6 py-4">Action</th>
                <th scope="col" className="px-6 py-4">Admin ID</th>
                <th scope="col" className="px-6 py-4">Target User</th>
                <th scope="col" className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-2" aria-hidden="true" />
                    <span>Loading audit log trail...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--bg-card-hover)] transition-colors font-mono text-xs">
                    <td className="px-6 py-4 text-[var(--text-secondary)] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-primary)]">
                      {log.admin_id ? `${log.admin_id.substring(0, 8)}...` : 'System'}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-primary)]">
                      {log.target_user_id ? `${log.target_user_id.substring(0, 8)}...` : '-'}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] max-w-xs truncate" title={JSON.stringify(log.details_json)}>
                      {log.details_json ? JSON.stringify(log.details_json) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
