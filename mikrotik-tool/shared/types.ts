// ─── Device & Connection ─────────────────────────────────────────────────────

export type ConnectionMethod = 'rest' | 'ssh' | 'auto';

export interface DeviceCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  method: ConnectionMethod;
  rememberDevice?: boolean;
  label?: string;
}

export interface Device {
  id: number;
  label?: string;
  host: string;
  port: number;
  username: string;
  connection_method: ConnectionMethod;
  ros_version?: string;
  last_connected?: string;
  created_at: string;
}

export interface ConnectionResult {
  success: boolean;
  method: 'rest_api' | 'ssh';
  ros_version?: string;
  sections_read?: string[];
  error?: string;
}

// ─── RouterOS Config Sections ────────────────────────────────────────────────

export interface IpAddress {
  id?: string;
  address: string;
  network?: string;
  interface: string;
  disabled?: boolean;
  comment?: string;
}

export interface IpRoute {
  id?: string;
  'dst-address': string;
  gateway: string;
  distance?: number;
  disabled?: boolean;
  comment?: string;
}

export interface FirewallRule {
  id?: string;
  chain: string;
  action: string;
  'src-address'?: string;
  'dst-address'?: string;
  protocol?: string;
  'dst-port'?: string;
  'src-port'?: string;
  'in-interface'?: string;
  'out-interface'?: string;
  'connection-state'?: string;
  'address-list'?: string;
  comment?: string;
  disabled?: boolean;
  bytes?: number;
  packets?: number;
}

export interface NatRule {
  id?: string;
  chain: string;
  action: string;
  'src-address'?: string;
  'dst-address'?: string;
  'to-addresses'?: string;
  'to-ports'?: string;
  protocol?: string;
  'dst-port'?: string;
  'out-interface'?: string;
  'in-interface'?: string;
  comment?: string;
  disabled?: boolean;
}

export interface DhcpServer {
  id?: string;
  name: string;
  interface: string;
  'address-pool': string;
  disabled?: boolean;
}

export interface DhcpNetwork {
  id?: string;
  address: string;
  gateway: string;
  'dns-server'?: string;
  'ntp-server'?: string;
  comment?: string;
}

export interface IpPool {
  id?: string;
  name: string;
  ranges: string;
}

export interface DnsConfig {
  servers?: string;
  'allow-remote-requests'?: boolean;
  'max-udp-packet-size'?: number;
}

export interface DnsStaticEntry {
  id?: string;
  name: string;
  address: string;
  disabled?: boolean;
}

export interface Interface {
  id?: string;
  name: string;
  type: string;
  disabled?: boolean;
  comment?: string;
  'mac-address'?: string;
  mtu?: number;
  running?: boolean;
  'rx-byte'?: number;
  'tx-byte'?: number;
  'rx-rate'?: number;
  'tx-rate'?: number;
}

export interface Bridge {
  id?: string;
  name: string;
  disabled?: boolean;
  'vlan-filtering'?: boolean;
  comment?: string;
}

export interface BridgePort {
  id?: string;
  bridge: string;
  interface: string;
  'pvid'?: number;
  disabled?: boolean;
}

export interface Vlan {
  id?: string;
  name: string;
  'vlan-id': number;
  interface: string;
  disabled?: boolean;
  comment?: string;
}

export interface WireGuardInterface {
  id?: string;
  name: string;
  'listen-port': number;
  mtu?: number;
  'public-key'?: string;
  'private-key'?: string;
  disabled?: boolean;
  comment?: string;
}

export interface WireGuardPeer {
  id?: string;
  interface: string;
  'public-key': string;
  'allowed-address': string;
  endpoint?: string;
  'endpoint-port'?: number;
  'persistent-keepalive'?: number;
  comment?: string;
  disabled?: boolean;
}

export interface OspfArea {
  id?: string;
  name: string;
  'area-id': string;
  instance: string;
}

export interface OspfInstance {
  id?: string;
  name: string;
  'router-id': string;
  version?: number;
  disabled?: boolean;
}

export interface BgpConnection {
  id?: string;
  name: string;
  remote: { address: string; as: number };
  local?: { role: string };
  disabled?: boolean;
}

export interface Queue {
  id?: string;
  name: string;
  target: string;
  'max-limit': string;
  'burst-limit'?: string;
  comment?: string;
  disabled?: boolean;
}

export interface NtpClient {
  enabled?: boolean;
  servers?: string;
  mode?: string;
}

export interface SystemIdentity {
  name: string;
}

export interface NetwatchEntry {
  id?: string;
  host: string;
  interval?: string;
  timeout?: string;
  'up-script'?: string;
  'down-script'?: string;
  disabled?: boolean;
  status?: string;
  comment?: string;
}

export interface PppProfile {
  id?: string;
  name: string;
  'local-address'?: string;
  'remote-address'?: string;
  'dns-server'?: string;
  comment?: string;
}

export interface PppSecret {
  id?: string;
  name: string;
  password?: string;
  service?: string;
  profile?: string;
  comment?: string;
  disabled?: boolean;
}

export interface Service {
  id?: string;
  name: string;
  port: number;
  disabled?: boolean;
  address?: string;
}

// ─── Full Config State ────────────────────────────────────────────────────────

export interface DeviceConfig {
  ipAddresses: IpAddress[];
  routes: IpRoute[];
  firewallFilter: FirewallRule[];
  firewallNat: NatRule[];
  firewallMangle: FirewallRule[];
  dhcpServers: DhcpServer[];
  dhcpNetworks: DhcpNetwork[];
  ipPools: IpPool[];
  dns: DnsConfig;
  dnsStatic: DnsStaticEntry[];
  interfaces: Interface[];
  bridges: Bridge[];
  bridgePorts: BridgePort[];
  vlans: Vlan[];
  wireguardInterfaces: WireGuardInterface[];
  wireguardPeers: WireGuardPeer[];
  ospfAreas: OspfArea[];
  ospfInstances: OspfInstance[];
  bgpConnections: BgpConnection[];
  queues: Queue[];
  ntpClient: NtpClient;
  identity: SystemIdentity;
  netwatch: NetwatchEntry[];
  pppProfiles: PppProfile[];
  pppSecrets: PppSecret[];
  services: Service[];
  logs: LogEntry[];
}

export interface LogEntry {
  id?: string;
  time?: string;
  topics?: string;
  message?: string;
}

// ─── Change Log ───────────────────────────────────────────────────────────────

export type ChangeAction = 'add' | 'set' | 'remove' | 'read' | 'connect';
export type ChangeResult = 'success' | 'failed' | 'skipped';

export interface ChangeLogEntry {
  id?: number;
  timestamp: string;
  device_ip: string;
  device_id?: number;
  session_id?: string;
  feature_group?: string;
  action: ChangeAction;
  api_path?: string;
  payload?: string;
  ros_command?: string;
  result: ChangeResult;
  response?: string;
  applied_by?: string;
}

// ─── Config Engine ────────────────────────────────────────────────────────────

export type FeatureGroup =
  | 'ip_addresses'
  | 'dhcp'
  | 'dns'
  | 'vlan'
  | 'bridge'
  | 'firewall'
  | 'nat'
  | 'address_lists'
  | 'wireguard'
  | 'openvpn'
  | 'l2tp'
  | 'sstp'
  | 'static_routes'
  | 'ospf'
  | 'bgp'
  | 'mangle'
  | 'wireless'
  | 'capsman'
  | 'simple_queues'
  | 'queue_tree'
  | 'netwatch'
  | 'snmp'
  | 'syslog'
  | 'ntp'
  | 'hardening'
  | 'scheduler';

export interface ConfigChange {
  action: 'add' | 'set' | 'remove';
  path: string;
  params: Record<string, unknown>;
  rosCommand: string;
  description: string;
}

export interface GeneratedConfig {
  featureGroup: FeatureGroup;
  changes: ConfigChange[];
  script: string;
  diffLines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface SystemResource {
  'cpu-load': number;
  'free-memory': number;
  'total-memory': number;
  uptime: string;
  'board-name': string;
  version: string;
  'active-connections'?: number;
  'free-hdd-space'?: number;
  'total-hdd-space'?: number;
  'architecture-name'?: string;
}

export interface DashboardData {
  resource: SystemResource;
  interfaces: Interface[];
  dhcpLeases: number;
  topFirewallRules: FirewallRule[];
  recentLogs: LogEntry[];
  timestamp: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export interface DeviceSnapshot {
  id?: number;
  device_id: number;
  label: string;
  snapshot_json: string;
  created_at: string;
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────

export type WsMessageType =
  | 'log'
  | 'progress'
  | 'dashboard'
  | 'apply_start'
  | 'apply_complete'
  | 'apply_error'
  | 'command_result';

export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
  timestamp: string;
}

export interface ApplyProgress {
  sessionId: string;
  total: number;
  completed: number;
  current?: string;
  status: 'running' | 'complete' | 'failed';
}
