import { useState } from 'react';
import toast from 'react-hot-toast';
import { configApi } from '../../../services/api';
import { useConfigStore } from '../../../store/configStore';
import { useDeviceStore } from '../../../store/deviceStore';
import { ConfigPreview } from '../ConfigPreview';
import type { FirewallRule, GeneratedConfig } from '../../../../../shared/types';

const ACTIONS = ['accept', 'drop', 'reject', 'log', 'return', 'jump', 'passthrough'];
const CHAINS = ['input', 'forward', 'output'];
const PROTOCOLS = ['tcp', 'udp', 'icmp', 'gre', 'esp'];
const CONN_STATES = ['new', 'established', 'related', 'invalid'];

interface FirewallRuleForm extends Partial<FirewallRule> {
  _key: string;
}

export function FirewallForm() {
  const { config } = useDeviceStore();
  const { setGeneratedConfig, generatedConfigs } = useConfigStore();

  const [rules, setRules] = useState<FirewallRuleForm[]>([{
    _key: '1',
    chain: 'input',
    action: 'accept',
    'connection-state': 'established,related',
    comment: '',
  }]);
  const [generating, setGenerating] = useState(false);
  const [viewChain, setViewChain] = useState<string>('input');

  const generatedConfig = generatedConfigs.get('firewall');

  const addRule = () => setRules([...rules, {
    _key: Date.now().toString(),
    chain: viewChain,
    action: 'accept',
  }]);

  const removeRule = (key: string) => setRules(rules.filter(r => r._key !== key));

  const updateRule = (key: string, field: string, value: string) =>
    setRules(rules.map(r => r._key === key ? { ...r, [field]: value } : r));

  const handleGenerate = async () => {
    const valid = rules.filter(r => r.chain && r.action);
    if (valid.length === 0) { toast.error('Add at least one firewall rule'); return; }

    setGenerating(true);
    try {
      const res = await configApi.generate({
        featureGroup: 'firewall',
        desired: valid.map(({ _key, ...rule }) => rule),
        existing: config?.firewallFilter || [],
        chain: viewChain,
      });
      setGeneratedConfig('firewall', res.data.data as GeneratedConfig);
    } catch {
      toast.error('Failed to generate config');
    } finally {
      setGenerating(false);
    }
  };

  const existingRulesForChain = (config?.firewallFilter || []).filter(r => r.chain === viewChain);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Firewall Filter Rules</h3>
        <button className="btn-secondary text-sm py-1" onClick={addRule}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Rule
        </button>
      </div>

      {/* Chain selector */}
      <div className="flex gap-2">
        {CHAINS.map(chain => (
          <button
            key={chain}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewChain === chain
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setViewChain(chain)}
          >
            {chain.toUpperCase()}
            {config?.firewallFilter && (
              <span className="ml-1.5 text-xs opacity-70">
                ({config.firewallFilter.filter(r => r.chain === chain).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Existing rules */}
      {existingRulesForChain.length > 0 && (
        <div className="form-section">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Existing {viewChain} rules
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {existingRulesForChain.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono text-gray-600 dark:text-gray-400">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  rule.action === 'accept' ? 'bg-green-100 text-green-700' :
                  rule.action === 'drop' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{rule.action}</span>
                {rule.protocol && <span>{rule.protocol}</span>}
                {rule['src-address'] && <span>src:{rule['src-address']}</span>}
                {rule['dst-address'] && <span>dst:{rule['dst-address']}</span>}
                {rule['dst-port'] && <span>:{rule['dst-port']}</span>}
                {rule.comment && <span className="text-gray-400 italic">#{rule.comment}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New rules */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule._key} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-xs">Chain</label>
                <select className="input text-sm" value={rule.chain || 'input'}
                  onChange={(e) => updateRule(rule._key, 'chain', e.target.value)}>
                  {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Action</label>
                <select className="input text-sm" value={rule.action || 'accept'}
                  onChange={(e) => updateRule(rule._key, 'action', e.target.value)}>
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Protocol</label>
                <select className="input text-sm" value={rule.protocol || ''}
                  onChange={(e) => updateRule(rule._key, 'protocol', e.target.value)}>
                  <option value="">any</option>
                  {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Src Address</label>
                <input type="text" className="input text-sm font-mono" placeholder="0.0.0.0/0"
                  value={rule['src-address'] || ''}
                  onChange={(e) => updateRule(rule._key, 'src-address', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Dst Address</label>
                <input type="text" className="input text-sm font-mono" placeholder="0.0.0.0/0"
                  value={rule['dst-address'] || ''}
                  onChange={(e) => updateRule(rule._key, 'dst-address', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Dst Port</label>
                <input type="text" className="input text-sm font-mono" placeholder="80,443"
                  value={rule['dst-port'] || ''}
                  onChange={(e) => updateRule(rule._key, 'dst-port', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Connection State</label>
                <input type="text" className="input text-sm" placeholder="established,related"
                  value={rule['connection-state'] || ''}
                  onChange={(e) => updateRule(rule._key, 'connection-state', e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label text-xs">Comment</label>
                <input type="text" className="input text-sm" placeholder="Rule description"
                  value={rule.comment || ''}
                  onChange={(e) => updateRule(rule._key, 'comment', e.target.value)} />
              </div>
              <div className="flex items-end">
                <button onClick={() => removeRule(rule._key)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary w-full justify-center" onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate Script'}
      </button>

      {generatedConfig && <ConfigPreview config={generatedConfig} featureGroup="firewall" />}
    </div>
  );
}
