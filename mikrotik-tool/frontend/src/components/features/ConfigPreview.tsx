import { useState } from 'react';
import toast from 'react-hot-toast';
import { CodePreview } from '../common/CodePreview';
import { Modal, ConfirmModal } from '../common/Modal';
import { useConfigStore } from '../../store/configStore';
import { useDeviceStore } from '../../store/deviceStore';
import { applyApi } from '../../services/api';
import type { GeneratedConfig } from '../../../../shared/types';

interface ConfigPreviewProps {
  config: GeneratedConfig;
  featureGroup: string;
}

export function ConfigPreview({ config, featureGroup }: ConfigPreviewProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const { setApplyProgress, resetApply } = useConfigStore();
  const { activeDevice } = useDeviceStore();

  const handleApply = async () => {
    if (!activeDevice) { toast.error('No device connected'); return; }
    if (config.changes.length === 0) { toast('No changes to apply'); return; }

    setApplying(true);
    resetApply();

    try {
      const res = await applyApi.apply({
        host: activeDevice.host,
        username: activeDevice.username,
        changes: config.changes.map((c) => ({
          action: c.action,
          path: c.path,
          params: c.params as Record<string, unknown>,
          rosCommand: c.rosCommand,
          description: c.description,
          featureGroup,
        })),
        featureGroup,
      });

      const { successCount, failCount } = res.data.data;
      setApplyProgress({ status: failCount === 0 ? 'complete' : 'failed' });

      if (failCount === 0) {
        toast.success(`Applied ${successCount} changes successfully`);
      } else {
        toast.error(`${failCount} changes failed, ${successCount} succeeded`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Apply failed';
      toast.error(msg);
    } finally {
      setApplying(false);
      setShowApplyModal(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Changes:</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {config.changes.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">+{config.changes.filter(c => c.action === 'add').length}</span>
            <span className="text-amber-500">~{config.changes.filter(c => c.action === 'set').length}</span>
            <span className="text-red-500">-{config.changes.filter(c => c.action === 'remove').length}</span>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowApplyModal(true)}
          disabled={config.changes.length === 0 || !activeDevice}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Apply to Device
        </button>
      </div>

      {/* Code preview */}
      <CodePreview
        script={config.script}
        diffLines={config.diffLines}
        filename={`${featureGroup}-config.rsc`}
        showDiff
        maxHeight="500px"
      />

      {/* Changes list */}
      {config.changes.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <span className="text-sm font-medium">Planned Changes ({config.changes.length})</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-60 overflow-y-auto">
            {config.changes.map((change, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium mt-0.5 ${
                  change.action === 'add' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  change.action === 'set' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {change.action.toUpperCase()}
                </span>
                <div>
                  <div className="text-gray-700 dark:text-gray-300">{change.description}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{change.path}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {config.changes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">Configuration is up to date</p>
          <p className="text-sm">No changes needed</p>
        </div>
      )}

      {/* Apply confirmation modal */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => !applying && setShowApplyModal(false)}
        title="Confirm Apply Changes"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowApplyModal(false)} disabled={applying}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleApply} disabled={applying}>
              {applying ? 'Applying...' : `Apply ${config.changes.length} Changes`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-400 text-sm">
                  This will modify the device configuration
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                  {config.changes.length} changes will be applied to {activeDevice?.host}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {config.changes.map((change, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-sm">
                <span className={`w-12 text-center py-0.5 rounded text-xs font-medium ${
                  change.action === 'add' ? 'bg-green-100 text-green-700' :
                  change.action === 'set' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{change.action}</span>
                <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{change.description}</span>
              </div>
            ))}
          </div>

          {applying && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Applying changes, please wait...
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
