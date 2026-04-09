import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDeviceStore } from '../../store/deviceStore';
import { useLogStore } from '../../store/logStore';

export function Header() {
  const { activeDevice, clearDevice } = useDeviceStore();
  const { wsStatus, setIsOpen, isOpen } = useLogStore();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const wsStatusColors = {
    connected: 'text-green-400',
    connecting: 'text-amber-400',
    disconnected: 'text-red-400',
  };

  return (
    <header className="h-14 bg-gray-900 dark:bg-gray-950 border-b border-gray-700 flex items-center px-4 gap-4 flex-shrink-0">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 mr-4">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="font-bold text-white text-sm hidden sm:block">MikroTik Config Tool</span>
      </Link>

      {/* Device indicator */}
      {activeDevice && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-gray-200 font-mono">{activeDevice.host}</span>
          <span className="text-xs text-gray-400">ROS {activeDevice.ros_version}</span>
          <span className="text-xs text-gray-500 hidden md:block">
            via {activeDevice.method === 'rest_api' ? 'REST' : 'SSH'}
          </span>
          <button
            onClick={() => { clearDevice(); }}
            className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
            title="Disconnect"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* WS status */}
      <div className="flex items-center gap-1.5" title={`WebSocket: ${wsStatus}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${
          wsStatus === 'connected' ? 'bg-green-400 animate-pulse' :
          wsStatus === 'connecting' ? 'bg-amber-400' : 'bg-red-400'
        }`} />
        <span className={`text-xs hidden md:block ${wsStatusColors[wsStatus]}`}>
          {wsStatus}
        </span>
      </div>

      {/* Log panel toggle */}
      <button
        className={`btn-ghost text-gray-300 ${isOpen ? 'bg-gray-700' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle log panel"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        <span className="text-xs hidden md:block">Logs</span>
      </button>

      {/* Dark mode */}
      <button
        className="btn-ghost text-gray-300"
        onClick={() => setDarkMode(!darkMode)}
        title={darkMode ? 'Light mode' : 'Dark mode'}
      >
        {darkMode ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>
    </header>
  );
}
