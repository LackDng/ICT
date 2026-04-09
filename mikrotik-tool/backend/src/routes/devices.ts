import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllDevices, getDeviceById, deleteDevice,
  getSnapshotsByDevice, getSnapshotById, insertSnapshot, deleteSnapshot,
} from '../db/database';

const router = Router();

// GET /api/devices
router.get('/', (_req: Request, res: Response): void => {
  const devices = getAllDevices();
  res.json({ success: true, data: devices });
});

// GET /api/devices/:id
router.get('/:id', (req: Request, res: Response): void => {
  const device = getDeviceById(parseInt(req.params['id']));
  if (!device) { res.status(404).json({ success: false, error: 'Device not found' }); return; }
  res.json({ success: true, data: device });
});

// DELETE /api/devices/:id
router.delete('/:id', (req: Request, res: Response): void => {
  deleteDevice(parseInt(req.params['id']));
  res.json({ success: true, message: 'Device deleted' });
});

// ─── Snapshots ─────────────────────────────────────────────────────────────────

const SnapshotSchema = z.object({
  label: z.string().min(1).max(100),
  snapshot_json: z.string().min(1),
});

// GET /api/devices/:id/snapshots
router.get('/:id/snapshots', (req: Request, res: Response): void => {
  const snapshots = getSnapshotsByDevice(parseInt(req.params['id']));
  res.json({ success: true, data: snapshots });
});

// POST /api/devices/:id/snapshots
router.post('/:id/snapshots', (req: Request, res: Response): void => {
  const parse = SnapshotSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ success: false, error: parse.error.message }); return; }

  const device_id = parseInt(req.params['id']);
  const snapId = insertSnapshot({ device_id, label: parse.data.label, snapshot_json: parse.data.snapshot_json });
  res.json({ success: true, data: { id: snapId } });
});

// GET /api/devices/:id/snapshots/:snapId
router.get('/:id/snapshots/:snapId', (req: Request, res: Response): void => {
  const snap = getSnapshotById(parseInt(req.params['snapId']));
  if (!snap) { res.status(404).json({ success: false, error: 'Snapshot not found' }); return; }
  res.json({ success: true, data: snap });
});

// DELETE /api/devices/:id/snapshots/:snapId
router.delete('/:id/snapshots/:snapId', (req: Request, res: Response): void => {
  deleteSnapshot(parseInt(req.params['snapId']));
  res.json({ success: true, message: 'Snapshot deleted' });
});

export default router;
