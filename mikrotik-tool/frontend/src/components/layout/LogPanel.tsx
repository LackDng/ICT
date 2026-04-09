import { useRef, useEffect } from 'react';
import { useLogStore, LogMessage } from '../../store/logStore';
import { format } from 'date-fns';

export function LogPanel() {
  const { messages, isOpen, clearMessages, wsStatus } = useLogStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-gray-950 border-l border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">Live Log</span>
          <div className={`w-1.5 h-1.5 rounded-full ${
            wsStatus === 'connected' ? 'bg-green-400 animate-pulse' :
            wsStatus === 'connecting' ? 'bg-amber-400' : 'bg-red-400'
          }`} />
          <span className="text-xs text-gray-500">{messages.length}</span>
        </div>
        <button
          onClick={clearMessages}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {messages.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-8">No log messages</p>
        )}
        {messages.map((msg) => (
          <LogLine key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function LogLine({ msg }: { msg: LogMessage }) {
  const levelColors = {
    info: 'text-gray-400',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
  };

  const levelPrefix = {
    info: '  ',
    success: '✓ ',
    error: '✗ ',
    warning: '⚠ ',
  };

  const time = (() => {
    try { return format(new Date(msg.timestamp), 'HH:mm:ss'); }
    catch { return '??:??:??'; }
  })();

  return (
    <div className={`flex gap-2 text-xs font-mono ${levelColors[msg.level]}`}>
      <span className="text-gray-600 flex-shrink-0">{time}</span>
      <span className="break-all">
        {levelPrefix[msg.level]}{msg.message}
      </span>
    </div>
  );
}
