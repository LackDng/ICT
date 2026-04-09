import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryChangeLogs, deleteChangeLogOlderThan } from '../db/database';
import type { ChangeLogFilter } from '../db/database';

const router = Router();

// GET /api/changelog
router.get('/', (req: Request, res: Response): void => {
  const filter: ChangeLogFilter = {
    device_ip: req.query['device_ip'] as string || undefined,
    feature_group: req.query['feature_group'] as string || undefined,
    result: req.query['result'] as string || undefined,
    session_id: req.query['session_id'] as string || undefined,
    from_date: req.query['from_date'] as string || undefined,
    to_date: req.query['to_date'] as string || undefined,
    limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 200,
    offset: req.query['offset'] ? parseInt(req.query['offset'] as string) : 0,
  };

  const { rows, total } = queryChangeLogs(filter);
  res.json({ success: true, data: { rows, total, limit: filter.limit, offset: filter.offset } });
});

// DELETE /api/changelog/older-than/:days
const DeleteSchema = z.object({ days: z.number().int().min(1).max(3650) });

router.delete('/older-than/:days', (req: Request, res: Response): void => {
  const parse = DeleteSchema.safeParse({ days: parseInt(req.params['days']) });
  if (!parse.success) {
    res.status(400).json({ success: false, error: 'Invalid days parameter' });
    return;
  }
  const deleted = deleteChangeLogOlderThan(parse.data.days);
  res.json({ success: true, data: { deleted, message: `Deleted ${deleted} entries older than ${parse.data.days} days` } });
});

// GET /api/changelog/export (CSV or JSON)
router.get('/export', (req: Request, res: Response): void => {
  const format = req.query['format'] as string || 'json';
  const { rows } = queryChangeLogs({
    device_ip: req.query['device_ip'] as string || undefined,
    feature_group: req.query['feature_group'] as string || undefined,
    limit: 10000,
    offset: 0,
  });

  if (format === 'csv') {
    const headers = ['id','timestamp','device_ip','session_id','feature_group','action','api_path','result','applied_by','payload','ros_command','response'];
    const csvRows = (rows as Record<string,unknown>[]).map(row =>
      headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="changelog.csv"');
    res.send([headers.join(','), ...csvRows].join('\n'));
  } else {
    res.setHeader('Content-Disposition', 'attachment; filename="changelog.json"');
    res.json({ success: true, data: rows });
  }
});

// GET /api/changelog/sessions — distinct sessions
router.get('/sessions', (req: Request, res: Response): void => {
  const { rows } = queryChangeLogs({
    device_ip: req.query['device_ip'] as string || undefined,
    limit: 1000, offset: 0
  });

  const sessions = new Map<string, { session_id: string; timestamp: string; feature_group: string; result: string; count: number }>();
  for (const row of rows as Record<string,unknown>[]) {
    const sid = String(row['session_id'] || '');
    if (!sid) continue;
    if (!sessions.has(sid)) {
      sessions.set(sid, {
        session_id: sid,
        timestamp: String(row['timestamp'] || ''),
        feature_group: String(row['feature_group'] || ''),
        result: String(row['result'] || ''),
        count: 0,
      });
    }
    sessions.get(sid)!.count++;
    // Track if any failed
    if (row['result'] === 'failed') {
      sessions.get(sid)!.result = 'failed';
    }
  }

  res.json({ success: true, data: Array.from(sessions.values()) });
});

export default router;
