import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getRestClient, getSshClient } from '../adapters/connection-manager';
import { insertSnapshot, getSnapshotById } from '../db/database';

const router = Router();

// POST /api/backup/export — download .rsc file
router.post('/export', async (req: Request, res: Response): Promise<void> => {
  const { host, username } = req.body as { host: string; username: string };
  if (!host) { res.status(400).json({ success: false, error: 'host required' }); return; }

  const sshClient = getSshClient(host, username || 'admin');
  const restClient = getRestClient(host, username || 'admin');

  try {
    let exportData = '';

    if (sshClient) {
      const res2 = await sshClient.exec('/export');
      exportData = res2.stdout || '';
    } else if (restClient) {
      // REST API export
      const result = await restClient.get('/system/export') as Record<string, unknown>;
      exportData = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    } else {
      res.status(503).json({ success: false, error: 'No active connection' });
      return;
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${host}-backup-${Date.now()}.rsc"`);
    res.send(exportData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/backup/snapshot — save snapshot to DB
const SnapshotSchema = z.object({
  device_id: z.number().int().positive(),
  label: z.string().min(1).max(100),
  config: z.record(z.unknown()),
});

router.post('/snapshot', (req: Request, res: Response): void => {
  const parse = SnapshotSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: parse.error.message });
    return;
  }

  const { device_id, label, config } = parse.data;
  const snapId = insertSnapshot({
    device_id,
    label,
    snapshot_json: JSON.stringify(config),
  });
  res.json({ success: true, data: { id: snapId } });
});

// GET /api/backup/compare?snap1=N&snap2=M — diff two snapshots
router.get('/compare', (req: Request, res: Response): void => {
  const snap1Id = parseInt(req.query['snap1'] as string);
  const snap2Id = parseInt(req.query['snap2'] as string);

  if (!snap1Id || !snap2Id) {
    res.status(400).json({ success: false, error: 'snap1 and snap2 query params required' });
    return;
  }

  const snap1 = getSnapshotById(snap1Id) as { snapshot_json: string; label: string; created_at: string } | undefined;
  const snap2 = getSnapshotById(snap2Id) as { snapshot_json: string; label: string; created_at: string } | undefined;

  if (!snap1 || !snap2) {
    res.status(404).json({ success: false, error: 'Snapshot not found' });
    return;
  }

  const config1 = JSON.parse(snap1.snapshot_json) as Record<string, unknown>;
  const config2 = JSON.parse(snap2.snapshot_json) as Record<string, unknown>;

  const diff = computeSnapshotDiff(config1, config2);

  res.json({
    success: true,
    data: {
      snap1: { id: snap1Id, label: snap1.label, created_at: snap1.created_at },
      snap2: { id: snap2Id, label: snap2.label, created_at: snap2.created_at },
      diff,
    },
  });
});

function computeSnapshotDiff(
  config1: Record<string, unknown>,
  config2: Record<string, unknown>
): Record<string, { added: unknown[]; removed: unknown[]; changed: unknown[] }> {
  const diff: Record<string, { added: unknown[]; removed: unknown[]; changed: unknown[] }> = {};

  const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

  for (const key of allKeys) {
    const v1 = config1[key];
    const v2 = config2[key];

    if (JSON.stringify(v1) !== JSON.stringify(v2)) {
      if (Array.isArray(v1) && Array.isArray(v2)) {
        const v1Strs = v1.map(i => JSON.stringify(i));
        const v2Strs = v2.map(i => JSON.stringify(i));
        diff[key] = {
          added: v2.filter((_: unknown, i: number) => !v1Strs.includes(v2Strs[i])),
          removed: v1.filter((_: unknown, i: number) => !v2Strs.includes(v1Strs[i])),
          changed: [],
        };
      } else {
        diff[key] = {
          added: v2 !== undefined ? [v2] : [],
          removed: v1 !== undefined ? [v1] : [],
          changed: [],
        };
      }
    }
  }

  return diff;
}

export default router;
