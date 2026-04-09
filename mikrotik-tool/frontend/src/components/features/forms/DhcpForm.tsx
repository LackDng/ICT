import { useState } from 'react';
import toast from 'react-hot-toast';
import { configApi } from '../../../services/api';
import { useConfigStore } from '../../../store/configStore';
import { useDeviceStore } from '../../../store/deviceStore';
import { ConfigPreview } from '../ConfigPreview';
import type { GeneratedConfig } from '../../../../../shared/types';

interface DhcpServerEntry {
  name: string;
  interface: string;
  'address-pool': string;
}
interface DhcpNetworkEntry {
  address: string;
  gateway: string;
  'dns-server': string;
  'ntp-server': string;
}
interface PoolEntry {
  name: string;
  ranges: string;
}

export function DhcpForm() {
  const { config } = useDeviceStore();
  const { setGeneratedConfig, generatedConfigs } = useConfigStore();

  const [pools, setPools] = useState<PoolEntry[]>([{ name: 'dhcp_pool', ranges: '192.168.1.100-192.168.1.200' }]);
  const [servers, setServers] = useState<DhcpServerEntry[]>([{ name: 'dhcp1', interface: 'bridge', 'address-pool': 'dhcp_pool' }]);
  const [networks, setNetworks] = useState<DhcpNetworkEntry[]>([{ address: '192.168.1.0/24', gateway: '192.168.1.1', 'dns-server': '8.8.8.8', 'ntp-server': '' }]);
  const [generating, setGenerating] = useState(false);

  const generatedConfig = generatedConfigs.get('dhcp');
  const interfaces = config?.interfaces?.map(i => i.name) || [];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await configApi.generate({
        featureGroup: 'dhcp',
        desiredServers: servers,
        desiredNetworks: networks,
        desiredPools: pools,
        existingServers: config?.dhcpServers || [],
        existingNetworks: config?.dhcpNetworks || [],
        existingPools: config?.ipPools || [],
      });
      setGeneratedConfig('dhcp', res.data.data as GeneratedConfig);
    } catch {
      toast.error('Failed to generate DHCP config');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="font-medium">DHCP Server Configuration</h3>

      {/* Pools */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">IP Pools</h4>
          <button className="btn-secondary text-sm py-1"
            onClick={() => setPools([...pools, { name: `pool${pools.length + 1}`, ranges: '' }])}>
            + Add Pool
          </button>
        </div>
        {pools.map((pool, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <div className="col-span-2">
              <input type="text" className="input text-sm font-mono" placeholder="Pool name"
                value={pool.name}
                onChange={e => setPools(pools.map((p, idx) => idx === i ? { ...p, name: e.target.value } : p))} />
            </div>
            <div className="col-span-2">
              <input type="text" className="input text-sm font-mono" placeholder="192.168.1.10-192.168.1.100"
                value={pool.ranges}
                onChange={e => setPools(pools.map((p, idx) => idx === i ? { ...p, ranges: e.target.value } : p))} />
            </div>
            <button onClick={() => setPools(pools.filter((_, idx) => idx !== i))} disabled={pools.length === 1}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Servers */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">DHCP Servers</h4>
          <button className="btn-secondary text-sm py-1"
            onClick={() => setServers([...servers, { name: `dhcp${servers.length + 1}`, interface: '', 'address-pool': '' }])}>
            + Add Server
          </button>
        </div>
        {servers.map((srv, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 mb-2">
            <input type="text" className="input text-sm" placeholder="Server name"
              value={srv.name}
              onChange={e => setServers(servers.map((s, idx) => idx === i ? { ...s, name: e.target.value } : s))} />
            <input type="text" className="input text-sm font-mono" placeholder="Interface"
              list="iface-list-dhcp" value={srv.interface}
              onChange={e => setServers(servers.map((s, idx) => idx === i ? { ...s, interface: e.target.value } : s))} />
            <datalist id="iface-list-dhcp">
              {interfaces.map(iface => <option key={iface} value={iface} />)}
            </datalist>
            <select className="input text-sm" value={srv['address-pool']}
              onChange={e => setServers(servers.map((s, idx) => idx === i ? { ...s, 'address-pool': e.target.value } : s))}>
              {pools.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Networks */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">DHCP Networks</h4>
          <button className="btn-secondary text-sm py-1"
            onClick={() => setNetworks([...networks, { address: '', gateway: '', 'dns-server': '8.8.8.8', 'ntp-server': '' }])}>
            + Add Network
          </button>
        </div>
        {networks.map((net, i) => (
          <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 mb-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Network / Prefix</label>
                <input type="text" className="input text-sm font-mono" placeholder="192.168.1.0/24"
                  value={net.address}
                  onChange={e => setNetworks(networks.map((n, idx) => idx === i ? { ...n, address: e.target.value } : n))} />
              </div>
              <div>
                <label className="label text-xs">Gateway</label>
                <input type="text" className="input text-sm font-mono" placeholder="192.168.1.1"
                  value={net.gateway}
                  onChange={e => setNetworks(networks.map((n, idx) => idx === i ? { ...n, gateway: e.target.value } : n))} />
              </div>
              <div>
                <label className="label text-xs">DNS Server</label>
                <input type="text" className="input text-sm font-mono" placeholder="8.8.8.8,8.8.4.4"
                  value={net['dns-server']}
                  onChange={e => setNetworks(networks.map((n, idx) => idx === i ? { ...n, 'dns-server': e.target.value } : n))} />
              </div>
              <div>
                <label className="label text-xs">NTP Server</label>
                <input type="text" className="input text-sm font-mono" placeholder="pool.ntp.org"
                  value={net['ntp-server']}
                  onChange={e => setNetworks(networks.map((n, idx) => idx === i ? { ...n, 'ntp-server': e.target.value } : n))} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary w-full justify-center" onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate DHCP Script'}
      </button>

      {generatedConfig && <ConfigPreview config={generatedConfig} featureGroup="dhcp" />}
    </div>
  );
}
