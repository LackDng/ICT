import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { devicesApi } from '../services/api';
import { ConfirmModal } from '../components/common/Modal';
import type { Device } from '../../../shared/types';

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await devicesApi.list();
      setDevices((res.data as { data: Device[] }).data || []);
    } catch {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await devicesApi.delete(deleteId);
      toast.success('Device deleted');
      setDeleteId(null);
      load();
    } catch {
      toast.error('Failed to delete device');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Saved Devices</h1>
          <p className="text-sm text-gray-500">{devices.length} device{devices.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Connect New Device
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : devices.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <h3 className="font-medium text-gray-700 dark:text-gray-300">No saved devices</h3>
          <p className="text-sm text-gray-500 mt-1">Connect to a device and enable "Remember device" to save it here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                {['Label', 'Host', 'Username', 'Method', 'ROS Version', 'Last Connected', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {device.label || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{device.host}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{device.username}</td>
                  <td className="px-4 py-3">
                    <span className="badge-info">{device.connection_method}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{device.ros_version || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {device.last_connected
                      ? format(new Date(device.last_connected), 'MMM d, HH:mm')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-secondary text-xs py-1"
                        onClick={() => navigate('/')}
                        title="Reconnect"
                      >
                        Connect
                      </button>
                      <button
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        onClick={() => setDeleteId(device.id)}
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Device"
        message="Are you sure you want to delete this saved device? This will also remove all snapshots."
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  );
}
