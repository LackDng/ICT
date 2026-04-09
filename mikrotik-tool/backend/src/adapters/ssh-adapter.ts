import { NodeSSH, SSHExecCommandResponse } from 'node-ssh';

export interface SshClientOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
}

export class RouterOSSshClient {
  private ssh: NodeSSH;
  private opts: SshClientOptions;
  private connected = false;

  constructor(opts: SshClientOptions) {
    this.ssh = new NodeSSH();
    this.opts = opts;
  }

  async connect(): Promise<void> {
    await this.ssh.connect({
      host: this.opts.host,
      port: this.opts.port,
      username: this.opts.username,
      password: this.opts.password,
      readyTimeout: this.opts.timeout ?? 10000,
      algorithms: {
        kex: [
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
        ],
        serverHostKey: [
          'ssh-rsa',
          'ecdsa-sha2-nistp256',
          'ssh-ed25519',
        ],
      },
    });
    this.connected = true;
  }

  async exec(command: string): Promise<SSHExecCommandResponse> {
    if (!this.connected) await this.connect();
    return this.ssh.execCommand(command);
  }

  async exportConfig(): Promise<string> {
    const res = await this.exec('/export');
    return res.stdout || '';
  }

  async getVersion(): Promise<string> {
    const res = await this.exec(':put [/system/resource get version]');
    return res.stdout.trim() || 'unknown';
  }

  async execCommands(commands: string[]): Promise<{ command: string; stdout: string; stderr: string }[]> {
    const results = [];
    for (const command of commands) {
      const res = await this.exec(command);
      results.push({ command, stdout: res.stdout || '', stderr: res.stderr || '' });
    }
    return results;
  }

  async runScript(script: string): Promise<string> {
    // Split script into lines and execute each non-empty line
    const lines = script.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const results: string[] = [];
    for (const line of lines) {
      const res = await this.exec(line.trim());
      if (res.stderr) results.push(`ERROR: ${res.stderr}`);
      else results.push(res.stdout || 'ok');
    }
    return results.join('\n');
  }

  disconnect(): void {
    this.ssh.dispose();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ─── Parse RouterOS export output ────────────────────────────────────────────

export function parseExportSection(exportOutput: string, sectionPath: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const lines = exportOutput.split('\n');
  const sectionPrefix = sectionPath.replace(/\//g, ' ').trim();

  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;

    // Detect section start
    if (trimmed.toLowerCase().startsWith(sectionPrefix.toLowerCase())) {
      inSection = true;
      continue;
    }

    if (inSection) {
      if (trimmed.startsWith('/') && !trimmed.startsWith('/ip') && !trimmed.startsWith('/interface')) {
        inSection = false;
        continue;
      }
      if (trimmed.startsWith('add ') || trimmed.startsWith('set ')) {
        const entry = parseRosCommand(trimmed);
        if (entry) results.push(entry);
      }
    }
  }
  return results;
}

function parseRosCommand(command: string): Record<string, string> | null {
  const parts = command.split(' ');
  const result: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const key = part.substring(0, eqIdx);
      const value = part.substring(eqIdx + 1).replace(/^"/, '').replace(/"$/, '');
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
