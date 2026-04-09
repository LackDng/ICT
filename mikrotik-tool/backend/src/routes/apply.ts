import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeApiCommand } from '../adapters/connection-manager';
import { insertChangeLog } from '../db/database';
import { broadcastToSession, broadcast } from '../websocket/ws-server';
import { generateRollbackCommand } from '../services/config-engine';
import type { JwtPayload } from '../middleware/auth';

const router = Router();

// Rate limiting per device (simple in-memory map)
const applyTimestamps = new Map<string, number>();
const APPLY_RATE_LIMIT_MS = parseInt(process.env.APPLY_RATE_LIMIT_MS || '5000');

const ChangeSchema = z.object({
  action: z.enum(['add', 'set', 'remove', 'get']),
  path: z.string().min(1),
  id: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  rosCommand: z.string().optional(),
  description: z.string().optional(),
  featureGroup: z.string().optional(),
});

const ApplySchema = z.object({
  host: z.string().min(1),
  username: z.string().min(1),
  changes: z.array(ChangeSchema).min(1).max(500),
  featureGroup: z.string().optional(),
  sessionId: z.string().optional(),
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parse = ApplySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: parse.error.message });
    return;
  }

  const { host, username, changes, featureGroup, sessionId: providedSession } = parse.data;
  const user = (req as Request & { user?: JwtPayload }).user;
  const appliedBy = user?.username || 'anonymous';
  const sessionId = providedSession || uuidv4();

  // Rate limit check
  const now = Date.now();
  const lastApply = applyTimestamps.get(host) || 0;
  if (now - lastApply < APPLY_RATE_LIMIT_MS) {
    const waitMs = APPLY_RATE_LIMIT_MS - (now - lastApply);
    res.status(429).json({
      success: false,
      error: `Rate limited. Please wait ${Math.ceil(waitMs / 1000)}s before applying again.`,
    });
    return;
  }
  applyTimestamps.set(host, now);

  // Start apply session
  broadcast('apply_start', { sessionId, total: changes.length, host });

  const results: Array<{
    change: z.infer<typeof ChangeSchema>;
    result: 'success' | 'failed' | 'skipped';
    response: string;
    logId: number;
  }> = [];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];

    broadcastToSession(sessionId, 'progress', {
      sessionId,
      total: changes.length,
      completed: i,
      current: change.description || `${change.action} ${change.path}`,
      status: 'running',
    });

    try {
      const cmdResult = await executeApiCommand(host, username, {
        action: change.action as 'add' | 'set' | 'remove' | 'get',
        path: change.path,
        id: change.id,
        params: change.params as Record<string, unknown>,
      });

      const result: 'success' | 'failed' = cmdResult.success ? 'success' : 'failed';
      if (cmdResult.success) successCount++;
      else failCount++;

      const logId = insertChangeLog({
        device_ip: host,
        session_id: sessionId,
        feature_group: change.featureGroup || featureGroup || 'unknown',
        action: change.action,
        api_path: change.path + (change.id ? `/${change.id}` : ''),
        payload: JSON.stringify(change.params || {}),
        ros_command: change.rosCommand || cmdResult.rosCommand,
        result,
        response: cmdResult.response,
        applied_by: appliedBy,
      });

      results.push({ change, result, response: cmdResult.response, logId });

      broadcastToSession(sessionId, 'command_result', {
        sessionId,
        index: i,
        total: changes.length,
        action: change.action,
        path: change.path,
        result,
        response: cmdResult.response,
        description: change.description,
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failCount++;

      const logId = insertChangeLog({
        device_ip: host,
        session_id: sessionId,
        feature_group: change.featureGroup || featureGroup || 'unknown',
        action: change.action,
        api_path: change.path,
        payload: JSON.stringify(change.params || {}),
        ros_command: change.rosCommand || '',
        result: 'failed',
        response: msg,
        applied_by: appliedBy,
      });

      results.push({ change, result: 'failed', response: msg, logId });
    }
  }

  broadcast('apply_complete', {
    sessionId,
    total: changes.length,
    success: successCount,
    failed: failCount,
    status: failCount === 0 ? 'complete' : 'failed',
  });

  res.json({
    success: failCount === 0,
    data: {
      sessionId,
      total: changes.length,
      successCount,
      failCount,
      results: results.map(r => ({
        action: r.change.action,
        path: r.change.path,
        result: r.result,
        logId: r.logId,
        description: r.change.description,
      })),
    },
  });
});

// ─── Rollback a single change log entry ──────────────────────────────────────

const RollbackSchema = z.object({
  host: z.string().min(1),
  username: z.string().min(1),
  logId: z.number().int().positive(),
  action: z.string(),
  path: z.string(),
  id: z.string().optional(),
  originalParams: z.record(z.unknown()).optional(),
});

router.post('/rollback', async (req: Request, res: Response): Promise<void> => {
  const parse = RollbackSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: parse.error.message });
    return;
  }

  const { host, username, action, path, id, originalParams } = parse.data;
  const user = (req as Request & { user?: JwtPayload }).user;
  const appliedBy = user?.username || 'anonymous';

  const rollbackCommand = generateRollbackCommand(
    action, path, id,
    originalParams as Record<string, unknown> || {}
  );

  let rollbackAction: 'add' | 'set' | 'remove' = 'add';
  if (action === 'add') rollbackAction = 'remove';
  else if (action === 'set') rollbackAction = 'set';
  else if (action === 'remove') rollbackAction = 'add';

  const cmdResult = await executeApiCommand(host, username, {
    action: rollbackAction,
    path,
    id,
    params: originalParams as Record<string, unknown>,
  });

  insertChangeLog({
    device_ip: host,
    session_id: uuidv4(),
    feature_group: 'rollback',
    action: rollbackAction,
    api_path: path,
    payload: JSON.stringify(originalParams || {}),
    ros_command: rollbackCommand,
    result: cmdResult.success ? 'success' : 'failed',
    response: cmdResult.response,
    applied_by: appliedBy,
  });

  res.json({
    success: cmdResult.success,
    data: { rollbackCommand, response: cmdResult.response },
  });
});

export default router;
