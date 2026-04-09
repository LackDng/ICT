import { useState } from 'react';
import toast from 'react-hot-toast';
import { configApi } from '../../../services/api';
import { useConfigStore } from '../../../store/configStore';
import { useDeviceStore } from '../../../store/deviceStore';
import { ConfigPreview } from '../ConfigPreview';
import type { IpAddress, GeneratedConfig } from '../../../../../shared/types';

export function IpAddressForm() {
  const { config } = useDeviceStore();
  const { setGeneratedConfig, generatedConfigs } = useConfigStore();

  const [entries, setEntries] = useState<IpAddress[]>([
    { address: '', interface: '', comment: '' },
  ]);
  const [generating, setGenerating] = useState(false);

  const generatedConfig = generatedConfigs.get('ip_addresses');

  const addEntry = () => setEntries([...entries, { address: '', interface: '', comment: '' }]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: keyof IpAddress, value: string) => {
    setEntries(entries.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  };

  const handleGenerate = async () => {
    const valid = entries.filter(e => e.address && e.interface);
    if (valid.length === 0) { toast.error('Add at least one valid IP address entry'); return; }

    setGenerating(true);
    try {
      const res = await configApi.generate({
        featureGroup: 'ip_addresses',
        desired: valid,
        existing: config?.ipAddresses || [],
      });
      const generated = res.data.data as GeneratedConfig;
      setGeneratedConfig('ip_addresses', generated);
    } catch (err: unknown) {
      toast.error('Failed to generate config');
    } finally {
      setGenerating(false);
    }
  };

  const interfaces = config?.interfaces?.map(i => i.name) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800 dark:text-gray-200">IP Addresses</h3>
        <button className="btn-secondary text-sm py-1" onClick={addEntry}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Entry
        </button>
      </div>

      {/* Current config */}
      {config?.ipAddresses && config.ipAddresses.length > 0 && (
        <div className="form-section">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Existing Addresses</h4>
          <div className="space-y-1">
            {config.ipAddresses.map((addr, i) => (
              <div key={i} className="flex items-center gap-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                <span className="text-blue-500">{addr.address}</span>
                <span className="text-gray-400">on</span>
                <span>{addr.interface}</span>
                {addr.disabled && <span className="badge-gray">disabled</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desired entries */}
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="col-span-5">
              <label className="label text-xs">Address / Prefix</label>
              <input
                type="text"
                className="input text-sm font-mono"
                placeholder="192.168.1.1/24"
                value={entry.address}
                onChange={(e) => updateEntry(i, 'address', e.target.value)}
              />
            </div>
            <div className="col-span-4">
              <label className="label text-xs">Interface</label>
              <input
                type="text"
                className="input text-sm font-mono"
                placeholder="ether1"
                list={`iface-list-${i}`}
                value={entry.interface}
                onChange={(e) => updateEntry(i, 'interface', e.target.value)}
              />
              <datalist id={`iface-list-${i}`}>
                {interfaces.map(iface => <option key={iface} value={iface} />)}
              </datalist>
            </div>
            <div className="col-span-2">
              <label className="label text-xs">Comment</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="optional"
                value={entry.comment || ''}
                onChange={(e) => updateEntry(i, 'comment', e.target.value)}
              />
            </div>
            <div className="col-span-1 pt-6">
              <button
                onClick={() => removeEntry(i)}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                disabled={entries.length === 1}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn-primary w-full justify-center"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? 'Generating...' : 'Generate Script'}
      </button>

      {generatedConfig && (
        <ConfigPreview config={generatedConfig} featureGroup="ip_addresses" />
      )}
    </div>
  );
}
