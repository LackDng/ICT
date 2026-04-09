import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useDeviceStore } from '../store/deviceStore';
import { dashboardApi } from '../services/api';
import type { DashboardData } from '../../../shared/types';
import { format } from 'date-fns';

const POLL_INTERVAL = 5000;

export function DashboardPage() {
  const { activeDevice } = useDeviceStore();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ time: string; cpu: number; memory: number }>>([]);

  const fetchData = useCallback(async () => {
    if (!activeDevice) return;
    try {
      const res = await dashboardApi.get(activeDevice.host, activeDevice.username);
      const d = (res.data as { data: DashboardData }).data;
      setData(d);
      setError(null);

      // Update history
      const cpuLoad = Number(d.resource['cpu-load']) || 0;
      const totalMem = Number(d.resource['total-memory']) || 1;
      const freeMem = Number(d.resource['free-memory']) || 0;
      const memUsed = Math.round((1 - freeMem / totalMem) * 100);

      setHistory(prev => [
        ...prev.slice(-29),
        { time: format(new Date(), 'HH:mm:ss'), cpu: cpuLoad, memory: memUsed },
      ]);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [activeDevice]);

  useEffect(() => {
    if (!activeDevice) { navigate('/'); return; }
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [activeDevice, fetchData, navigate]);

  if (!activeDevice) return null;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-700 dark:text-red-400 font-medium">Dashboard unavailable</p>
          <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
          <p className="text-red-500 text-xs mt-1">Ensure the device is connected and REST API is accessible.</p>
        </div>
      </div>
    );
  }

  const resource = data?.resource;
  if (!resource) return null;

  const cpuLoad = Number(resource['cpu-load']) || 0;
  const totalMem = Number(resource['total-memory']) || 1;
  const freeMem = Number(resource['free-memory']) || 0;
  const memUsedPct = Math.round((1 - freeMem / totalMem) * 100);
  const memUsedMb = Math.round((totalMem - freeMem) / 1024 / 1024);
  const totalMemMb = Math.round(totalMem / 1024 / 1024);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {resource['board-name']} — RouterOS {resource.version} — {activeDevice.host}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-gray-500">Live • polling every 5s</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="CPU Load"
          value={`${cpuLoad}%`}
          sub={`${resource['architecture-name'] || 'MIPS'}`}
          color={cpuLoad > 80 ? 'red' : cpuLoad > 60 ? 'amber' : 'green'}
          progress={cpuLoad}
        />
        <StatCard
          label="Memory"
          value={`${memUsedPct}%`}
          sub={`${memUsedMb} / ${totalMemMb} MB`}
          color={memUsedPct > 85 ? 'red' : memUsedPct > 70 ? 'amber' : 'green'}
          progress={memUsedPct}
        />
        <StatCard
          label="Uptime"
          value={formatUptime(resource.uptime)}
          sub="since last reboot"
          color="blue"
        />
        <StatCard
          label="DHCP Leases"
          value={String(data?.dhcpLeases || 0)}
          sub="active leases"
          color="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CPU/Memory history */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">CPU & Memory History</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#6b7280" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="#3b82f620" name="CPU %" strokeWidth={2} />
              <Area type="monotone" dataKey="memory" stroke="#10b981" fill="#10b98120" name="Memory %" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Interface list */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Interfaces</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(data?.interfaces || []).slice(0, 10).map((iface, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${iface.running ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="font-mono text-gray-700 dark:text-gray-300">{iface.name}</span>
                  <span className="text-xs text-gray-500">{iface.type}</span>
                </div>
                {iface.running && (
                  <div className="text-xs text-gray-500 font-mono">
                    ↑{formatBytes(iface['tx-byte'])} ↓{formatBytes(iface['rx-byte'])}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Firewall top rules + Recent logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top firewall rules */}
        {data?.topFirewallRules && data.topFirewallRules.length > 0 && (
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3">Top Firewall Rules (by packets)</h2>
            <div className="space-y-2">
              {data.topFirewallRules.map((rule, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                      rule.action === 'accept' ? 'bg-green-100 text-green-700' :
                      rule.action === 'drop' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{rule.action}</span>
                    <span className="truncate text-gray-600 dark:text-gray-400">
                      {rule.comment || `${rule.chain}/${rule.protocol || 'any'}`}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono ml-2 flex-shrink-0">
                    {Number(rule.packets || 0).toLocaleString()} pkts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent logs */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Recent Device Logs</h2>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(data?.recentLogs || []).slice(0, 15).map((log, i) => (
              <div key={i} className="text-xs font-mono text-gray-600 dark:text-gray-400 flex gap-2">
                <span className="text-gray-400 flex-shrink-0">{log.time}</span>
                <span className={
                  log.topics?.includes('error') ? 'text-red-400' :
                  log.topics?.includes('warning') ? 'text-amber-400' :
                  'text-gray-400'
                }>{log.message}</span>
              </div>
            ))}
            {(!data?.recentLogs || data.recentLogs.length === 0) && (
              <p className="text-xs text-gray-500">No recent log entries</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, color, progress,
}: {
  label: string;
  value: string;
  sub: string;
  color: 'green' | 'amber' | 'red' | 'blue';
  progress?: number;
}) {
  const colorClasses = {
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };
  const barClasses = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  };

  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClasses[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barClasses[color]} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatUptime(uptime: string): string {
  if (!uptime) return '—';
  // RouterOS uptime: 1w2d3h4m5s
  const match = uptime.match(/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match) return uptime;
  const [, w, d, h, m] = match;
  if (w) return `${w}w ${d || 0}d`;
  if (d) return `${d}d ${h || 0}h`;
  if (h) return `${h}h ${m || 0}m`;
  return uptime;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0B';
  const units = ['B', 'K', 'M', 'G'];
  let val = bytes;
  let unit = 0;
  while (val >= 1024 && unit < units.length - 1) { val /= 1024; unit++; }
  return `${val.toFixed(1)}${units[unit]}`;
}
