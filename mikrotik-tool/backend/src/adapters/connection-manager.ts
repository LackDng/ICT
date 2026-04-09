import { RouterOSRestClient, readFullConfig } from './rest-adapter';
import { RouterOSSshClient } from './ssh-adapter';
import type { ConnectionMethod } from '../../../shared/types';

export interface ConnectOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  method: ConnectionMethod;
}

export interface ConnectResult {
  success: boolean;
  method: 'rest_api' | 'ssh';
  ros_version: string;
  config: Record<string, unknown>;
  sections_read: string[];
  error?: string;
}

// Singleton map of active connections
const restClients = new Map<string, RouterOSRestClient>();
const sshClients = new Map<string, RouterOSSshClient>();

export function getConnectionKey(host: string, username: string): string {
  return `${host}:${username}`;
}

export function getRestClient(host: string, username: string): RouterOSRestClient | undefined {
  return restClients.get(getConnectionKey(host, username));
}

export function getSshClient(host: string, username: string): RouterOSSshClient | undefined {
  return sshClients.get(getConnectionKey(host, username));
}

export function storeRestClient(host: string, username: string, client: RouterOSRestClient): void {
  restClients.set(getConnectionKey(host, username), client);
}

export function storeSshClient(host: string, username: string, client: RouterOSSshClient): void {
  sshClients.set(getConnectionKey(host, username), client);
}

export function disconnectDevice(host: string, username: string): void {
  const key = getConnectionKey(host, username);
  const ssh = sshClients.get(key);
  if (ssh) { ssh.disconnect(); sshClients.delete(key); }
  restClients.delete(key);
}

// ─── Main connect function ────────────────────────────────────────────────────

export async function connectToDevice(
  opts: ConnectOptions,
  onSection?: (section: string) => void
): Promise<ConnectResult> {
  const { host, port, username, password, method } = opts;

  // Determine REST port
  const restPort = method === 'ssh' ? 8728 : (port === 22 ? 8728 : port);
  const sshPort = method === 'rest' ? 22 : (port === 8728 || port === 8291 ? 22 : port);

  if (method === 'rest' || method === 'auto') {
    try {
      const restClient = new RouterOSRestClient({
        host, port: restPort, username, password,
        useHttps: restPort === 8729,
      });
      const { version } = await restClient.testConnection();
      const { config, sections } = await readFullConfig(restClient, onSection);
      storeRestClient(host, username, restClient);
      return {
        success: true,
        method: 'rest_api',
        ros_version: version,
        config,
        sections_read: sections,
      };
    } catch (restErr: unknown) {
      if (method === 'rest') {
        return {
          success: false,
          method: 'rest_api',
          ros_version: '',
          config: {},
          sections_read: [],
          error: restErr instanceof Error ? restErr.message : String(restErr),
        };
      }
      // Fall through to SSH for 'auto'
    }
  }

  // SSH fallback
  try {
    const sshClient = new RouterOSSshClient({
      host, port: sshPort, username, password,
    });
    await sshClient.connect();
    const version = await sshClient.getVersion();
    storeSshClient(host, username, sshClient);

    // For SSH, we still try REST API for config read if possible
    let config: Record<string, unknown> = {};
    let sections: string[] = [];
    try {
      const restClient = new RouterOSRestClient({
        host, port: 8728, username, password,
      });
      await restClient.testConnection();
      const readResult = await readFullConfig(restClient, onSection);
      config = readResult.config;
      sections = readResult.sections;
      storeRestClient(host, username, restClient);
    } catch {
      // SSH only — minimal config via export
      onSection?.('/export');
      sections = ['/export'];
      config = { exportOnly: true };
    }

    return {
      success: true,
      method: 'ssh',
      ros_version: version,
      config,
      sections_read: sections,
    };
  } catch (sshErr: unknown) {
    return {
      success: false,
      method: 'ssh',
      ros_version: '',
      config: {},
      sections_read: [],
      error: sshErr instanceof Error ? sshErr.message : String(sshErr),
    };
  }
}

// ─── Execute single API command (used by apply) ───────────────────────────────

export interface CommandResult {
  success: boolean;
  response: string;
  rosCommand: string;
}

export async function executeApiCommand(
  host: string,
  username: string,
  opts: {
    action: 'add' | 'set' | 'remove' | 'get';
    path: string;
    id?: string;
    params?: Record<string, unknown>;
  }
): Promise<CommandResult> {
  const restClient = getRestClient(host, username);
  const sshClient = getSshClient(host, username);

  const { action, path, id, params } = opts;

  // Build RouterOS CLI command equivalent
  const paramStr = params
    ? Object.entries(params).map(([k, v]) => `${k}="${v}"`).join(' ')
    : '';
  const rosCommand = id
    ? `${path} ${action} [find where .id="${id}"] ${paramStr}`.trim()
    : `${path} ${action} ${paramStr}`.trim();

  if (restClient) {
    try {
      let response: unknown;
      switch (action) {
        case 'add':
          response = await restClient.post(path, params ?? {});
          break;
        case 'set':
          response = await restClient.patch(`${path}/${id}`, params ?? {});
          break;
        case 'remove':
          response = await restClient.delete(`${path}/${id}`);
          break;
        case 'get':
          response = await restClient.get(path);
          break;
      }
      return {
        success: true,
        response: JSON.stringify(response),
        rosCommand,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, response: msg, rosCommand };
    }
  }

  if (sshClient) {
    try {
      const sshCommand = buildSshCommand(action, path, id, params);
      const res = await sshClient.exec(sshCommand);
      const success = !res.stderr || res.stderr.trim() === '';
      return {
        success,
        response: res.stdout || res.stderr || '',
        rosCommand: sshCommand,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, response: msg, rosCommand };
    }
  }

  return {
    success: false,
    response: 'No active connection',
    rosCommand,
  };
}

function buildSshCommand(
  action: string,
  path: string,
  id?: string,
  params?: Record<string, unknown>
): string {
  const rosPath = path.replace(/\//g, ' ').trim();
  const paramStr = params
    ? Object.entries(params).map(([k, v]) => `${k}="${v}"`).join(' ')
    : '';

  if (action === 'add') return `/${rosPath} add ${paramStr}`;
  if (action === 'set' && id) return `/${rosPath} set [find where .id="${id}"] ${paramStr}`;
  if (action === 'remove' && id) return `/${rosPath} remove [find where .id="${id}"]`;
  return `/${rosPath} print`;
}
