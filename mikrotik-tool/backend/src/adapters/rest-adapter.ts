import axios, { AxiosInstance } from 'axios';
import https from 'https';

export interface RestClientOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  useHttps?: boolean;
  timeout?: number;
}

export class RouterOSRestClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(opts: RestClientOptions) {
    const scheme = opts.useHttps ? 'https' : 'http';
    this.baseUrl = `${scheme}://${opts.host}:${opts.port}/rest`;
    this.client = axios.create({
      baseURL: this.baseUrl,
      auth: { username: opts.username, password: opts.password },
      timeout: opts.timeout ?? 10000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    const res = await this.client.get<T>(path, { params });
    return res.data;
  }

  async post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.client.post<T>(path, body);
    return res.data;
  }

  async put<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.client.put<T>(path, body);
    return res.data;
  }

  async patch<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.client.patch<T>(path, body);
    return res.data;
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const res = await this.client.delete<T>(path);
    return res.data;
  }

  // RouterOS specific: add entry (POST to collection)
  async add(path: string, params: Record<string, unknown>): Promise<{ ret: string }> {
    return this.post(`${path}/add`, params);
  }

  // RouterOS specific: set entry by id (PATCH)
  async set(path: string, id: string, params: Record<string, unknown>): Promise<void> {
    await this.patch(`${path}/${id}`, params);
  }

  // RouterOS specific: remove entry by id
  async remove(path: string, id: string): Promise<void> {
    await this.delete(`${path}/${id}`);
  }

  async testConnection(): Promise<{ version: string }> {
    const res = await this.get<Record<string, unknown>>('/system/resource');
    return { version: (res as Record<string, string>)['version'] || 'unknown' };
  }

  async getResource() {
    return this.get<Record<string, unknown>>('/system/resource');
  }
}

// ─── Full config reader ───────────────────────────────────────────────────────

const CONFIG_PATHS: Record<string, string> = {
  ipAddresses:          '/ip/address',
  routes:               '/ip/route',
  firewallFilter:       '/ip/firewall/filter',
  firewallNat:          '/ip/firewall/nat',
  firewallMangle:       '/ip/firewall/mangle',
  dhcpServers:          '/ip/dhcp-server',
  dhcpNetworks:         '/ip/dhcp-server/network',
  ipPools:              '/ip/pool',
  dnsStatic:            '/ip/dns/static',
  interfaces:           '/interface',
  bridges:              '/interface/bridge',
  bridgePorts:          '/interface/bridge/port',
  vlans:                '/interface/vlan',
  wireguardInterfaces:  '/interface/wireguard',
  wireguardPeers:       '/interface/wireguard/peers',
  pppProfiles:          '/ppp/profile',
  pppSecrets:           '/ppp/secret',
  queues:               '/queue/simple',
  netwatch:             '/tool/netwatch',
  services:             '/ip/service',
  identity:             '/system/identity',
  ntpClient:            '/system/ntp/client',
  logs:                 '/log',
};

const OPTIONAL_PATHS: Record<string, string> = {
  ospfInstances:   '/routing/ospf/instance',
  ospfAreas:       '/routing/ospf/area',
  bgpConnections:  '/routing/bgp/connection',
  wifiwave2:       '/interface/wifiwave2',
  capsmanManager:  '/caps-man/manager',
};

export async function readFullConfig(
  client: RouterOSRestClient,
  onSection?: (section: string) => void
): Promise<{ config: Record<string, unknown>; sections: string[]; errors: string[] }> {
  const config: Record<string, unknown> = {};
  const sections: string[] = [];
  const errors: string[] = [];

  // Read DNS config separately (it's a single object, not list)
  try {
    config['dns'] = await client.get('/ip/dns');
    sections.push('/ip/dns');
    onSection?.('/ip/dns');
  } catch { /* not critical */ }

  for (const [key, apiPath] of Object.entries(CONFIG_PATHS)) {
    try {
      const data = await client.get(apiPath);
      config[key] = data;
      sections.push(apiPath);
      onSection?.(apiPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${apiPath}: ${message}`);
      config[key] = [];
    }
  }

  for (const [key, apiPath] of Object.entries(OPTIONAL_PATHS)) {
    try {
      const data = await client.get(apiPath);
      config[key] = data;
      sections.push(apiPath);
      onSection?.(apiPath);
    } catch {
      // Optional sections — silently skip
    }
  }

  return { config, sections, errors };
}
