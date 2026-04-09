import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useConnectionForm, useDeviceStore } from '../../store/deviceStore';
import { connectApi } from '../../services/api';
import type { DeviceConfig } from '../../../../shared/types';

export function ConnectionForm() {
  const navigate = useNavigate();
  const form = useConnectionForm();
  const { setActiveDevice, setConfig, setConfigLoading } = useDeviceStore();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.host.trim()) { toast.error('Host is required'); return; }
    if (!form.username.trim()) { toast.error('Username is required'); return; }

    setLoading(true);
    setConfigLoading(true);

    try {
      const res = await connectApi.connect({
        host: form.host.trim(),
        port: form.port,
        username: form.username.trim(),
        password: form.password,
        method: form.method,
        rememberDevice: form.rememberDevice,
        label: form.label || undefined,
      });

      const { method, ros_version, config, device_id } = res.data.data;

      setActiveDevice({
        host: form.host.trim(),
        port: form.port,
        username: form.username.trim(),
        method,
        ros_version,
        device_id,
        connected_at: new Date().toISOString(),
      });

      setConfig(config as unknown as DeviceConfig);
      toast.success(`Connected to ${form.host} (ROS ${ros_version})`);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err instanceof Error ? err.message : 'Connection failed');
      toast.error(msg);
    } finally {
      setLoading(false);
      setConfigLoading(false);
    }
  };

  const methodDescriptions: Record<string, string> = {
    auto: 'Try REST API first, fall back to SSH',
    rest: 'RouterOS REST API (port 8728/8729)',
    ssh: 'SSH connection (port 22)',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Host */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">Host / IP Address</label>
          <input
            type="text"
            className="input"
            placeholder="192.168.1.1"
            value={form.host}
            onChange={(e) => form.setField('host', e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Port</label>
          <input
            type="number"
            className="input"
            value={form.port}
            onChange={(e) => form.setField('port', parseInt(e.target.value) || 8728)}
            min={1}
            max={65535}
          />
        </div>
      </div>

      {/* Credentials */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Username</label>
          <input
            type="text"
            className="input"
            placeholder="admin"
            value={form.username}
            onChange={(e) => form.setField('username', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => form.setField('password', e.target.value)}
          />
        </div>
      </div>

      {/* Connection method */}
      <div>
        <label className="label">Connection Method</label>
        <div className="grid grid-cols-3 gap-2">
          {(['auto', 'rest', 'ssh'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                form.setField('method', m);
                if (m === 'ssh') form.setField('port', 22);
                else if (m === 'rest') form.setField('port', 8728);
                else form.setField('port', 8728);
              }}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                form.method === m
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
              }`}
            >
              {m === 'auto' ? 'Auto-detect' : m === 'rest' ? 'REST API' : 'SSH'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">{methodDescriptions[form.method]}</p>
      </div>

      {/* Remember device */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <input
          type="checkbox"
          id="remember"
          checked={form.rememberDevice}
          onChange={(e) => form.setField('rememberDevice', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="remember" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          Remember this device
        </label>
        {form.rememberDevice && (
          <input
            type="text"
            className="input ml-auto w-40"
            placeholder="Device label"
            value={form.label}
            onChange={(e) => form.setField('label', e.target.value)}
          />
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center py-2.5 text-base"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Connect
          </>
        )}
      </button>
    </form>
  );
}
