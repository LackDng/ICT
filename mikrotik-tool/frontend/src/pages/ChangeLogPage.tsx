import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { changelogApi, applyApi } from '../services/api';
import { useDeviceStore } from '../store/deviceStore';
import { ResultBadge, ActionBadge } from '../components/common/Badge';
import { ConfirmModal } from '../components/common/Modal';

interface LogRow {
  id: number;
  timestamp: string;
  device_ip: string;
  session_id: string;
  feature_group: string;
  action: string;
  api_path: string;
  payload: string;
  ros_command: string;
  result: string;
  response: string;
  applied_by: string;
}

interface Filters {
  device_ip: string;
  feature_group: string;
  result: string;
  from_date: string;
  to_date: string;
}

export function ChangeLogPage() {
  const { activeDevice } = useDeviceStore();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    device_ip: activeDevice?.host || '',
    feature_group: '',
    result: '',
    from_date: '',
    to_date: '',
  });
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearDays, setClearDays] = useState(30);
  const [clearLoading, setClearLoading] = useState(false);
  const [sessions, setSessions] = useState<Set<string>>(new Set());
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());

  const LIMIT = 100;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await changelogApi.list({
        ...filters,
        limit: LIMIT,
        offset: page * LIMIT,
      });
      const d = res.data as { data: { rows: LogRow[]; total: number } };
      setRows(d.data.rows);
      setTotal(d.data.total);

      // Extract unique sessions
      const sids = new Set(d.data.rows.map(r => r.session_id).filter(Boolean));
      setSessions(sids);
    } catch {
      toast.error('Failed to load change log');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSession = (sid: string) => {
    setCollapsedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const handleClearLog = async () => {
    setClearLoading(true);
    try {
      const res = await changelogApi.deleteOlderThan(clearDays);
      const d = res.data as { data: { deleted: number } };
      toast.success(`Deleted ${d.data.deleted} log entries`);
      setShowClearModal(false);
      load();
    } catch {
      toast.error('Failed to clear log');
    } finally {
      setClearLoading(false);
    }
  };

  const handleRollback = async (row: LogRow) => {
    if (!activeDevice) { toast.error('No active device'); return; }
    try {
      let originalParams: Record<string, unknown> = {};
      try { originalParams = JSON.parse(row.payload) as Record<string, unknown>; } catch { /* */ }

      await applyApi.rollback({
        host: activeDevice.host,
        username: activeDevice.username,
        logId: row.id,
        action: row.action,
        path: row.api_path,
        originalParams,
      });
      toast.success('Rollback command sent');
      load();
    } catch {
      toast.error('Rollback failed');
    }
  };

  const FEATURE_OPTIONS = [
    '', 'connection', 'ip_addresses', 'dhcp', 'dns', 'vlan', 'bridge',
    'firewall', 'nat', 'wireguard', 'ospf', 'bgp', 'static_routes',
    'simple_queues', 'netwatch', 'ntp', 'rollback',
  ];

  // Group rows by session
  const groupedRows = rows.reduce<Map<string, LogRow[]>>((acc, row) => {
    const sid = row.session_id || '__no_session__';
    if (!acc.has(sid)) acc.set(sid, []);
    acc.get(sid)!.push(row);
    return acc;
  }, new Map());

  return (
    <div className="p-5 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Change Log</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} total entries</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => changelogApi.export('csv', filters)}
          >
            Export CSV
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={() => changelogApi.export('json', filters)}
          >
            Export JSON
          </button>
          <button
            className="btn-danger text-sm"
            onClick={() => setShowClearModal(true)}
          >
            Clear Old Logs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="label text-xs">Device IP</label>
            <input type="text" className="input text-sm" placeholder="All devices"
              value={filters.device_ip}
              onChange={e => setFilters(f => ({ ...f, device_ip: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Feature</label>
            <select className="input text-sm" value={filters.feature_group}
              onChange={e => setFilters(f => ({ ...f, feature_group: e.target.value }))}>
              {FEATURE_OPTIONS.map(o => <option key={o} value={o}>{o || 'All features'}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Result</label>
            <select className="input text-sm" value={filters.result}
              onChange={e => setFilters(f => ({ ...f, result: e.target.value }))}>
              <option value="">All results</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">From Date</label>
            <input type="date" className="input text-sm" value={filters.from_date}
              onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">To Date</label>
            <input type="date" className="input text-sm" value={filters.to_date}
              onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn-primary text-sm py-1.5" onClick={() => { setPage(0); load(); }}>
            Apply Filters
          </button>
          <button className="btn-secondary text-sm py-1.5"
            onClick={() => setFilters({ device_ip: '', feature_group: '', result: '', from_date: '', to_date: '' })}>
            Clear
          </button>
        </div>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="card p-8 text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  {['Time', 'Device', 'Session', 'Feature', 'Action', 'API Path', 'Result', 'By', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-400">No log entries found</td>
                  </tr>
                )}
                {rows.map((row) => (
                  <>
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(row.id)}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500 font-mono">
                        {format(new Date(row.timestamp), 'MM/dd HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{row.device_ip}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">
                        {row.session_id ? row.session_id.slice(0, 8) + '...' : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                        {row.feature_group || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <ActionBadge action={row.action} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {row.api_path || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <ResultBadge result={row.result} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{row.applied_by || '—'}</td>
                      <td className="px-3 py-2.5">
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has(row.id) ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {expanded.has(row.id) && (
                      <tr key={`exp-${row.id}`}>
                        <td colSpan={9} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-1.5">Payload Sent</h4>
                              <pre className="text-xs font-mono bg-gray-900 text-gray-200 rounded p-2 overflow-x-auto max-h-32">
                                {tryFormatJson(row.payload)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-1.5">RouterOS Command</h4>
                              <pre className="text-xs font-mono bg-gray-900 text-blue-300 rounded p-2 overflow-x-auto max-h-32">
                                {row.ros_command || '—'}
                              </pre>
                            </div>
                            <div className="md:col-span-2">
                              <h4 className="text-xs font-semibold text-gray-500 mb-1.5">Device Response</h4>
                              <pre className={`text-xs font-mono rounded p-2 overflow-x-auto max-h-32 ${
                                row.result === 'failed'
                                  ? 'bg-red-900/30 text-red-300'
                                  : 'bg-gray-900 text-gray-200'
                              }`}>
                                {row.response || '—'}
                              </pre>
                            </div>
                          </div>
                          {activeDevice && row.action !== 'read' && row.action !== 'connect' && (
                            <div className="mt-3 flex justify-end">
                              <button
                                className="btn-secondary text-sm py-1"
                                onClick={(e) => { e.stopPropagation(); handleRollback(row); }}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Rollback
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500">
                Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary text-sm py-1" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                  Previous
                </button>
                <button className="btn-secondary text-sm py-1"
                  onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clear log modal */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearLog}
        title="Clear Change Log"
        confirmLabel="Delete Entries"
        isLoading={clearLoading}
        message={`Delete all change log entries older than ${clearDays} days? This cannot be undone.`}
      >
        <div className="mb-4">
          <label className="label">Days to keep</label>
          <input type="number" className="input" value={clearDays} min={1} max={3650}
            onChange={e => setClearDays(parseInt(e.target.value))} />
        </div>
      </ConfirmModal>
    </div>
  );
}

function tryFormatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2); }
  catch { return str || '—'; }
}
