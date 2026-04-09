import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { DiffLine } from '../../../../shared/types';

interface CodePreviewProps {
  script: string;
  diffLines?: DiffLine[];
  filename?: string;
  showDiff?: boolean;
  maxHeight?: string;
}

export function CodePreview({
  script,
  diffLines = [],
  filename = 'config.rsc',
  showDiff = true,
  maxHeight = '400px',
}: CodePreviewProps) {
  const [viewMode, setViewMode] = useState<'script' | 'diff'>('script');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(script).then(() => {
      toast.success('Script copied to clipboard');
    });
  }, [script]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [script, filename]);

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs font-mono">{filename}</span>
          {showDiff && diffLines.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  viewMode === 'script'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setViewMode('script')}
              >
                Script
              </button>
              <button
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  viewMode === 'diff'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setViewMode('diff')}
              >
                Diff
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          {diffLines.length > 0 && (
            <div className="flex items-center gap-2 text-xs mr-2">
              <span className="text-green-400">
                +{diffLines.filter(l => l.type === 'add').length}
              </span>
              <span className="text-red-400">
                -{diffLines.filter(l => l.type === 'remove').length}
              </span>
            </div>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* Code area */}
      <div
        className="overflow-auto bg-gray-900"
        style={{ maxHeight }}
      >
        {viewMode === 'diff' && diffLines.length > 0 ? (
          <DiffView lines={diffLines} />
        ) : (
          <ScriptView script={script} />
        )}
      </div>
    </div>
  );
}

function ScriptView({ script }: { script: string }) {
  return (
    <pre className="p-4 text-sm font-mono leading-relaxed">
      {script.split('\n').map((line, i) => (
        <div key={i} className="flex hover:bg-gray-800/50">
          <span className="select-none w-10 text-right text-gray-600 text-xs pr-4 flex-shrink-0 pt-px">
            {i + 1}
          </span>
          <span className={
            line.startsWith('#')
              ? 'text-green-400'
              : line.match(/^\/[a-z]/)
              ? 'text-blue-300'
              : line.includes('=')
              ? 'text-yellow-300'
              : 'text-gray-200'
          }>
            {line || ' '}
          </span>
        </div>
      ))}
    </pre>
  );
}

function DiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <pre className="p-4 text-sm font-mono leading-relaxed">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`flex ${
            line.type === 'add'
              ? 'bg-green-900/30 text-green-300'
              : line.type === 'remove'
              ? 'bg-red-900/30 text-red-300'
              : 'text-gray-400'
          }`}
        >
          <span className="select-none w-6 text-center flex-shrink-0 opacity-70">
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>
          <span className="ml-2">{line.content || ' '}</span>
        </div>
      ))}
    </pre>
  );
}
