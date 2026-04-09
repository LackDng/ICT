import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { connectToDevice, disconnectDevice } from '../adapters/connection-manager';
import { insertChangeLog, upsertDevice } from '../db/database';
import { encrypt } from '../services/encryption';
import { broadcast } from '../websocket/ws-server';
import type { JwtPayload } from '../middleware/auth';

const router = Router();

const ConnectSchema = z.object({
  host: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65535).default(8728),
  username: z.string().min(1).max(64),
  password: z.string().max(128),
  method: z.enum(['rest', 'ssh', 'auto']).default('auto'),
  rememberDevice: z.boolean().default(false),
  label: z.string().optional(),
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parse = ConnectSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: parse.error.message });
    return;
  }

  const { host, port, username, password, method, rememberDevice, label } = parse.data;
  const user = (req as Request & { user?: JwtPayload }).user;
  const appliedBy = user?.username || 'anonymous';

  const sectionsRead: string[] = [];
  broadcast('log', { message: `Connecting to ${host}...`, level: 'info' });

  const result = await connectToDevice(
    { host, port, username, password, method },
    (section) => {
      sectionsRead.push(section);
      broadcast('log', { message: `Read: ${section}`, level: 'info' });
    }
  );

  let deviceId: number | undefined;

  if (result.success && rememberDevice) {
    try {
      const encPwd = encrypt(password);
      deviceId = upsertDevice({
        label,
        host,
        port,
        username,
        encryptedPassword: encPwd,
        connection_method: method,
        ros_version: result.ros_version,
      });
    } catch (err) {
      console.error('Failed to save device:', err);
    }
  }

  // Write to change_log
  insertChangeLog({
    device_ip: host,
    device_id: deviceId,
    action: 'connect',
    feature_group: 'connection',
    api_path: result.method === 'rest_api' ? '/rest/system/resource' : '/ssh',
    result: result.success ? 'success' : 'failed',
    response: JSON.stringify({
      method: result.method,
      ros_version: result.ros_version,
      sections_read: sectionsRead,
      error: result.error,
    }),
    applied_by: appliedBy,
  });

  if (result.success) {
    broadcast('log', { message: `Connected to ${host} via ${result.method} (ROS ${result.ros_version})`, level: 'success' });
    res.json({
      success: true,
      data: {
        method: result.method,
        ros_version: result.ros_version,
        sections_read: sectionsRead,
        config: result.config,
        device_id: deviceId,
      },
    });
  } else {
    broadcast('log', { message: `Connection failed: ${result.error}`, level: 'error' });
    res.status(503).json({
      success: false,
      error: result.error || 'Connection failed',
    });
  }
});

router.delete('/:host', async (req: Request, res: Response): Promise<void> => {
  const { host } = req.params;
  const username = req.query['username'] as string || 'admin';
  disconnectDevice(host, username);
  broadcast('log', { message: `Disconnected from ${host}`, level: 'info' });
  res.json({ success: true, message: 'Disconnected' });
});

export default router;
