import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectionForm } from '../components/features/ConnectionForm';
import { useDeviceStore } from '../store/deviceStore';
import { devicesApi } from '../services/api';
import { useState } from 'react';
import type { Device } from '../../../shared/types';

export function ConnectPage() {
  const { activeDevice } = useDeviceStore();
  const navigate = useNavigate();
  const [savedDevices, setSavedDevices] = useState<Device[]>([]);

  useEffect(() => {
    devicesApi.list()
      .then(res => setSavedDevices((res.data as { data: Device[] }).data || []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Logo / Title */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-4">
            <svg className="w-9 h-9 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Connect to MikroTik</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Enter your RouterOS device credentials
          </p>
        </div>

        {/* Already connected banner */}
        {activeDevice && (
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Connected to {activeDevice.host}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  RouterOS {activeDevice.ros_version} via {activeDevice.method}
                </p>
              </div>
            </div>
            <button
              className="btn-secondary text-sm"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {/* Connection form */}
        <div className="card p-6">
          <ConnectionForm />
        </div>

        {/* Saved devices */}
        {savedDevices.length > 0 && (
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Saved Devices</h2>
            <div className="space-y-2">
              {savedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{device.label || device.host}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {device.host} — {device.username} — {device.connection_method}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {device.ros_version && `ROS ${device.ros_version}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: '🔌', title: 'REST API', desc: 'RouterOS v7+ REST API on port 8728' },
            { icon: '🔐', title: 'SSH', desc: 'Fallback via SSH on port 22' },
            { icon: '📊', title: 'Real-time', desc: 'Live monitoring and change log' },
          ].map((item) => (
            <div key={item.title} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
              <div className="text-lg mb-1">{item.icon}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{item.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
