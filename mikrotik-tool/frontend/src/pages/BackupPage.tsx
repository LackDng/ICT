import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { backupApi, devicesApi } from '../services/api';
import { useDeviceStore } from '../store/deviceStore';
import { ConfirmModal } from '../components/common/Modal';

interface Snapshot {
  id: number;
  device_id: number;
  label: string;
  created_at: string;
}

interface SnapshotDiff {
  snap1: { id: number; label: string; created_at: string };
  snap2: { id: number; label: string; created_at: string };
  diff: Record<string, { added: unknown[]; removed: unknown[]; changed: unknown[] }>;
}

export function BackupPage() {
  const { activeDevice, config } = useDeviceStore();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [selectedSnaps, setSelectedSnaps] = useState<[number | null, number | null]>([null, null]);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSnapId, setDeleteSnapId] = useState<number | null>(null);

  useEffect(() => {
    if (!activeDevice?.device_id) return;
    loadSnapshots();
  }, [activeDevice]);

  const loadSnapshots = async () => {
    if (!activeDevice?.device_id) return;
    setLoading(true);
    try {
      const res = await devicesApi.listSnapshots(activeDevice.device_id);
      setSnapshots((res.data as { data: Snapshot[] }).data || []);
    } catch {
      toast.error('Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!activeDevice) return;
    setExportLoading(true);
    try {
      const res = await backupApi.export(activeDevice.host, activeDevice.username);
      const blob = new Blob([res.data as BlobPart], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeDevice.host}-backup-${Date.now()}.rsc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exported');
    } catch {
      toast.error('Export failed — ensure SSH connection or REST API is available');
    } finally {
      setExportLoading(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!activeDevice?.device_id || !config) {
      toast.error('No active device or config');
      return;
    }
    if (!snapshotLabel.trim()) {
      toast.error('Please enter a snapshot label');
      return;
    }
    setSavingSnapshot(true);
    try {
      await devicesApi.saveSnapshot(
        activeDevice.device_id,
        snapshotLabel.trim(),
        JSON.stringify(config)
      );
      toast.success('Snapshot saved');
      setSnapshotLabel('');
      loadSnapshots();
    } catch {
      toast.error('Failed to save snapshot');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleCompare = async () => {
    const [s1, s2] = selectedSnaps;
    if (!s1 || !s2) { toast.error('Select two snapshots to compare'); return; }
    if (s1 === s2) { toast.error('Select two different snapshots'); return; }
    try {
      const res = await backupApi.compareSnapshots(s1, s2);
      setDiff((res.data as { data: SnapshotDiff }).data);
    } catch {
      toast.error('Failed to compare snapshots');
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!activeDevice?.device_id || !deleteSnapId) return;
    try {
      await devicesApi.deleteSnapshot(activeDevice.device_id, deleteSnapId);
      toast.success('Snapshot deleted');
      setDeleteSnapId(null);
      setShowDeleteModal(false);
      loadSnapshots();
    } catch {
      toast.error('Failed to delete snapshot');
    }
  };

  if (!activeDevice) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No device connected. <button className="text-blue-500 underline" onClick={() => navigate('/')}>Connect first</button></p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Backup & Profiles</h1>
        <p className="text-sm text-gray-500">{activeDevice.host}</p>
      </div>

      {/* Export */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold">Export Backup</h2>
        <p className="text-sm text-gray-500">
          Download the complete RouterOS configuration as an .rsc script file.
          Requires SSH connection or REST API access.
        </p>
        <button
          className="btn-primary"
          onClick={handleExport}
          disabled={exportLoading}
        >
          {exportLoading ? 'Exporting...' : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Full Backup (.rsc)
            </>
          )}
        </button>
      </div>

      {/* Save snapshot */}
      {activeDevice.device_id && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Save Config Snapshot</h2>
          <p className="text-sm text-gray-500">
            Save the current in-memory configuration state as a named snapshot.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="Snapshot label (e.g. 'Before WireGuard setup')"
              value={snapshotLabel}
              onChange={e => setSnapshotLabel(e.target.value)}
            />
            <button
              className="btn-primary flex-shrink-0"
              onClick={handleSaveSnapshot}
              disabled={savingSnapshot || !config}
            >
              {savingSnapshot ? 'Saving...' : 'Save Snapshot'}
            </button>
          </div>
        </div>
      )}

      {/* Snapshots list */}
      {activeDevice.device_id && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <h2 className="font-semibold">Saved Snapshots ({snapshots.length})</h2>
            {snapshots.length >= 2 && selectedSnaps.filter(Boolean).length === 2 && (
              <button className="btn-secondary text-sm py-1" onClick={handleCompare}>
                Compare Selected
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No snapshots saved yet
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-8">A</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-8">B</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Label</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {snapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5">
                      <input type="radio" name="snap1"
                        checked={selectedSnaps[0] === snap.id}
                        onChange={() => setSelectedSnaps([snap.id, selectedSnaps[1]])} />
                    </td>
                    <td className="px-4 py-2.5">
                      <input type="radio" name="snap2"
                        checked={selectedSnaps[1] === snap.id}
                        onChange={() => setSelectedSnaps([selectedSnaps[0], snap.id])} />
                    </td>
                    <td className="px-4 py-2.5 font-medium">{snap.label}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {format(new Date(snap.created_at), 'MMM d yyyy, HH:mm')}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        onClick={() => { setDeleteSnapId(snap.id); setShowDeleteModal(true); }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Diff view */}
      {diff && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Comparing: "{diff.snap1.label}" vs "{diff.snap2.label}"
            </h2>
            <button className="btn-ghost text-sm" onClick={() => setDiff(null)}>Close</button>
          </div>

          {Object.keys(diff.diff).length === 0 ? (
            <p className="text-green-600 dark:text-green-400 text-sm">
              No differences found — snapshots are identical.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(diff.diff).map(([section, changes]) => (
                <div key={section}>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{section}</h3>
                  {changes.added.length > 0 && (
                    <div className="mb-1">
                      <p className="text-xs text-green-600 mb-1">+ Added ({changes.added.length})</p>
                      <pre className="text-xs font-mono diff-add px-3 py-2 rounded">
                        {JSON.stringify(changes.added, null, 2)}
                      </pre>
                    </div>
                  )}
                  {changes.removed.length > 0 && (
                    <div>
                      <p className="text-xs text-red-600 mb-1">- Removed ({changes.removed.length})</p>
                      <pre className="text-xs font-mono diff-remove px-3 py-2 rounded">
                        {JSON.stringify(changes.removed, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteSnapshot}
        title="Delete Snapshot"
        message="Are you sure you want to delete this snapshot?"
        confirmLabel="Delete"
      />
    </div>
  );
}
