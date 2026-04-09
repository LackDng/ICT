import { create } from 'zustand';
import type { FeatureGroup, GeneratedConfig, ConfigChange } from '../../../shared/types';

export interface FeatureSelection {
  group: FeatureGroup;
  label: string;
  enabled: boolean;
}

interface ConfigState {
  selectedFeatures: Set<FeatureGroup>;
  activeFeature: FeatureGroup | null;
  generatedConfigs: Map<FeatureGroup, GeneratedConfig>;
  pendingChanges: ConfigChange[];
  applySessionId: string | null;
  applyProgress: {
    total: number;
    completed: number;
    status: 'idle' | 'running' | 'complete' | 'failed';
    results: Array<{ action: string; path: string; result: string; description: string }>;
  };

  toggleFeature: (group: FeatureGroup) => void;
  setActiveFeature: (group: FeatureGroup | null) => void;
  setGeneratedConfig: (group: FeatureGroup, config: GeneratedConfig) => void;
  clearGeneratedConfig: (group: FeatureGroup) => void;
  setPendingChanges: (changes: ConfigChange[]) => void;
  addPendingChanges: (changes: ConfigChange[]) => void;
  clearPendingChanges: () => void;
  setApplySessionId: (id: string | null) => void;
  setApplyProgress: (progress: Partial<ConfigState['applyProgress']>) => void;
  resetApply: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  selectedFeatures: new Set(),
  activeFeature: null,
  generatedConfigs: new Map(),
  pendingChanges: [],
  applySessionId: null,
  applyProgress: {
    total: 0,
    completed: 0,
    status: 'idle',
    results: [],
  },

  toggleFeature: (group) =>
    set((state) => {
      const next = new Set(state.selectedFeatures);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return { selectedFeatures: next };
    }),

  setActiveFeature: (group) => set({ activeFeature: group }),

  setGeneratedConfig: (group, config) =>
    set((state) => {
      const next = new Map(state.generatedConfigs);
      next.set(group, config);
      return { generatedConfigs: next };
    }),

  clearGeneratedConfig: (group) =>
    set((state) => {
      const next = new Map(state.generatedConfigs);
      next.delete(group);
      return { generatedConfigs: next };
    }),

  setPendingChanges: (changes) => set({ pendingChanges: changes }),
  addPendingChanges: (changes) =>
    set((state) => ({ pendingChanges: [...state.pendingChanges, ...changes] })),
  clearPendingChanges: () => set({ pendingChanges: [] }),

  setApplySessionId: (id) => set({ applySessionId: id }),

  setApplyProgress: (progress) =>
    set((state) => ({ applyProgress: { ...state.applyProgress, ...progress } })),

  resetApply: () =>
    set({
      applySessionId: null,
      applyProgress: { total: 0, completed: 0, status: 'idle', results: [] },
      pendingChanges: [],
    }),
}));

// ─── Feature group definitions ────────────────────────────────────────────────

export const FEATURE_GROUPS: Array<{
  group: string;
  label: string;
  features: Array<{ id: FeatureGroup; label: string; description: string }>;
}> = [
  {
    group: 'A',
    label: 'Network Basics',
    features: [
      { id: 'ip_addresses', label: 'IP Addresses & Routes', description: 'Interface IPs and routing table' },
      { id: 'dhcp', label: 'DHCP Server', description: 'Per-interface / VLAN DHCP service' },
      { id: 'dns', label: 'DNS', description: 'Static entries and upstream servers' },
      { id: 'vlan', label: 'VLAN (802.1Q)', description: 'Tagged/untagged VLANs on bridge' },
      { id: 'bridge', label: 'Bridge', description: 'Bridge configuration and ports' },
    ],
  },
  {
    group: 'B',
    label: 'Security',
    features: [
      { id: 'firewall', label: 'Firewall Rules', description: 'INPUT / FORWARD / OUTPUT chains' },
      { id: 'nat', label: 'NAT', description: 'Masquerade and port forwarding' },
      { id: 'address_lists', label: 'Address Lists', description: 'Ban lists, whitelists' },
    ],
  },
  {
    group: 'C',
    label: 'VPN',
    features: [
      { id: 'wireguard', label: 'WireGuard', description: 'Interface, peers, allowed-IPs, routes' },
      { id: 'openvpn', label: 'OpenVPN', description: 'Server profile and certificates' },
      { id: 'l2tp', label: 'L2TP/IPSec', description: 'Server, profiles, secrets' },
      { id: 'sstp', label: 'SSTP', description: 'SSTP VPN server' },
    ],
  },
  {
    group: 'D',
    label: 'Routing',
    features: [
      { id: 'static_routes', label: 'Static Routes', description: 'Default gateway, per-network routes' },
      { id: 'ospf', label: 'OSPF', description: 'Area, instance, interface cost' },
      { id: 'bgp', label: 'BGP', description: 'Peers, AS number, route filters' },
      { id: 'mangle', label: 'Route Policy / Mangle', description: 'Routing marks' },
    ],
  },
  {
    group: 'E',
    label: 'Wireless',
    features: [
      { id: 'wireless', label: 'Wireless Interface', description: 'SSID, band, security profile' },
      { id: 'capsman', label: 'CAPsMAN / WifiWave2', description: 'Manager, provisioning, profiles' },
    ],
  },
  {
    group: 'F',
    label: 'QoS & Traffic',
    features: [
      { id: 'simple_queues', label: 'Simple Queues', description: 'Per-IP / per-subnet bandwidth limits' },
      { id: 'queue_tree', label: 'Queue Tree + PCQ', description: 'Fair-share per user' },
      { id: 'mangle', label: 'Mangle Packet Marking', description: 'Traffic marking for QoS' },
    ],
  },
  {
    group: 'G',
    label: 'Monitoring & System',
    features: [
      { id: 'netwatch', label: 'Netwatch', description: 'Ping host, up/down scripts' },
      { id: 'snmp', label: 'SNMP', description: 'Community and trap targets' },
      { id: 'syslog', label: 'Syslog', description: 'Remote log server' },
      { id: 'ntp', label: 'NTP Client', description: 'Network time sync' },
      { id: 'hardening', label: 'System Hardening', description: 'Disable unused services, SSH port change' },
      { id: 'scheduler', label: 'Scheduled Scripts', description: 'Cron-style automation' },
    ],
  },
];
