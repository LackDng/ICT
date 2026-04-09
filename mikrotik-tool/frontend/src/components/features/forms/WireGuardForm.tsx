import { useState } from 'react';
import toast from 'react-hot-toast';
import { configApi } from '../../../services/api';
import { useConfigStore } from '../../../store/configStore';
import { useDeviceStore } from '../../../store/deviceStore';
import { ConfigPreview } from '../ConfigPreview';
import type { GeneratedConfig } from '../../../../../shared/types';

interface WgInterface {
  name: string;
  'listen-port': number;
  mtu: number;
  comment: string;
}

interface WgPeer {
  interface: string;
  'public-key': string;
  'allowed-address': string;
  endpoint: string;
  'endpoint-port': number;
  'persistent-keepalive': number;
  comment: string;
}

export function WireGuardForm() {
  const { config } = useDeviceStore();
  const { setGeneratedConfig, generatedConfigs } = useConfigStore();

  const [ifaces, setIfaces] = useState<WgInterface[]>([{
    name: 'wg0',
    'listen-port': 51820,
    mtu: 1420,
    comment: '',
  }]);

  const [peers, setPeers] = useState<WgPeer[]>([{
    interface: 'wg0',
    'public-key': '',
    'allowed-address': '',
    endpoint: '',
    'endpoint-port': 51820,
    'persistent-keepalive': 25,
    comment: '',
  }]);

  const [generating, setGenerating] = useState(false);
  const generatedConfig = generatedConfigs.get('wireguard');

  const handleGenerate = async () => {
    const validIfaces = ifaces.filter(i => i.name && i['listen-port']);
    const validPeers = peers.filter(p => p['public-key'] && p['allowed-address']);

    if (validIfaces.length === 0) { toast.error('Add at least one WireGuard interface'); return; }

    setGenerating(true);
    try {
      const res = await configApi.generate({
        featureGroup: 'wireguard',
        desiredInterfaces: validIfaces,
        desiredPeers: validPeers,
        existingInterfaces: config?.wireguardInterfaces || [],
        existingPeers: config?.wireguardPeers || [],
      });
      setGeneratedConfig('wireguard', res.data.data as GeneratedConfig);
    } catch {
      toast.error('Failed to generate WireGuard config');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="font-medium">WireGuard Configuration</h3>

      {/* Interface section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Interfaces</h4>
          <button className="btn-secondary text-sm py-1"
            onClick={() => setIfaces([...ifaces, { name: `wg${ifaces.length}`, 'listen-port': 51820 + ifaces.length, mtu: 1420, comment: '' }])}>
            + Add Interface
          </button>
        </div>

        {ifaces.map((iface, i) => (
          <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label text-xs">Interface Name</label>
                <input type="text" className="input text-sm font-mono" value={iface.name}
                  onChange={e => setIfaces(ifaces.map((f, idx) => idx === i ? { ...f, name: e.target.value } : f))} />
              </div>
              <div>
                <label className="label text-xs">Listen Port</label>
                <input type="number" className="input text-sm" value={iface['listen-port']}
                  onChange={e => setIfaces(ifaces.map((f, idx) => idx === i ? { ...f, 'listen-port': parseInt(e.target.value) } : f))} />
              </div>
              <div>
                <label className="label text-xs">MTU</label>
                <input type="number" className="input text-sm" value={iface.mtu}
                  onChange={e => setIfaces(ifaces.map((f, idx) => idx === i ? { ...f, mtu: parseInt(e.target.value) } : f))} />
              </div>
              <div className="col-span-3">
                <label className="label text-xs">Comment</label>
                <input type="text" className="input text-sm" value={iface.comment}
                  onChange={e => setIfaces(ifaces.map((f, idx) => idx === i ? { ...f, comment: e.target.value } : f))} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Peers section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Peers</h4>
          <button className="btn-secondary text-sm py-1"
            onClick={() => setPeers([...peers, {
              interface: ifaces[0]?.name || 'wg0',
              'public-key': '', 'allowed-address': '',
              endpoint: '', 'endpoint-port': 51820,
              'persistent-keepalive': 25, comment: '',
            }])}>
            + Add Peer
          </button>
        </div>

        {peers.map((peer, i) => (
          <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Interface</label>
                <select className="input text-sm" value={peer.interface}
                  onChange={e => setPeers(peers.map((p, idx) => idx === i ? { ...p, interface: e.target.value } : p))}>
                  {ifaces.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Comment</label>
                <input type="text" className="input text-sm" placeholder="Peer name" value={peer.comment}
                  onChange={e => setPeers(peers.map((p, idx) => idx === i ? { ...p, comment: e.target.value } : p))} />
              </div>
            </div>

            <div>
              <label className="label text-xs">Public Key</label>
              <input type="text" className="input text-sm font-mono" placeholder="base64-encoded public key"
                value={peer['public-key']}
                onChange={e => setPeers(peers.map((p, idx) => idx === i ? { ...p, 'public-key': e.target.value } : p))} />
            </div>

            <div>
              <label className="label text-xs">Allowed Addresses (comma-separated CIDRs)</label>
              <input type="text" className="input text-sm font-mono" placeholder="10.0.0.2/32,192.168.0.0/24"
                value={peer['allowed-address']}
                onChange={e => setPeers(peers.map((p, idx) => idx === i ? { ...p, 'allowed-address': e.target.value } : p))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label text-xs">Endpoint</label>
                <input type="text" className="input text-sm font-mono" placeholder="vpn.example.com"
                  value={peer.endpoint}
                  onChange={e => setPeers(peers.map((p, idx) => idx === i ? { ...p, endpoint: e.target.value } : p))} />
              </div>
              <div>
                <label className="label text-xs">Endpoint Port</label>
                <input type="number" className="input text-sm" value={peer['endpoint-port']}
                  onChange={e => setPeers(peers.map((p, idx) => idx === i ? { ...p, 'endpoint-port': parseInt(e.target.value) } : p))} />
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <label className="label text-xs">Keepalive (seconds)</label>
                <input type="number" className="input text-sm w-24" value={peer['persistent-keepalive']}
                  onChange={e => setPeers(peers.map((p, idx) => idx === i ? { ...p, 'persistent-keepalive': parseInt(e.target.value) } : p))} />
              </div>
              <button onClick={() => setPeers(peers.filter((_, idx) => idx !== i))}
                disabled={peers.length === 1}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary w-full justify-center" onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate WireGuard Script'}
      </button>

      {generatedConfig && <ConfigPreview config={generatedConfig} featureGroup="wireguard" />}
    </div>
  );
}
