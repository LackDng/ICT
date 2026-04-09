import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeviceStore } from '../store/deviceStore';
import { useConfigStore } from '../store/configStore';
import { FeatureSelector } from '../components/features/FeatureSelector';
import { IpAddressForm } from '../components/features/forms/IpAddressForm';
import { FirewallForm } from '../components/features/forms/FirewallForm';
import { WireGuardForm } from '../components/features/forms/WireGuardForm';
import { DhcpForm } from '../components/features/forms/DhcpForm';
import type { FeatureGroup } from '../../../shared/types';

function FeatureFormRouter({ feature }: { feature: FeatureGroup | null }) {
  if (!feature) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="font-medium text-gray-700 dark:text-gray-300">Select a feature</h3>
        <p className="text-sm text-gray-500 mt-1">Choose a feature group from the left panel to configure it</p>
      </div>
    );
  }

  switch (feature) {
    case 'ip_addresses': return <IpAddressForm />;
    case 'firewall': return <FirewallForm />;
    case 'wireguard': return <WireGuardForm />;
    case 'dhcp': return <DhcpForm />;
    default:
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium mb-2">Coming Soon</p>
          <p className="text-sm">The <strong>{feature}</strong> configuration form is being implemented.</p>
          <p className="text-xs mt-2 text-gray-400">
            You can still manually generate scripts using the config engine API.
          </p>
        </div>
      );
  }
}

export function FeaturesPage() {
  const { activeDevice } = useDeviceStore();
  const { activeFeature, setActiveFeature, selectedFeatures } = useConfigStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeDevice) navigate('/');
  }, [activeDevice, navigate]);

  if (!activeDevice) return null;

  return (
    <div className="flex h-full">
      {/* Left panel — feature selector */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Feature Groups
          </h2>
          {selectedFeatures.size > 0 && (
            <span className="badge-info">{selectedFeatures.size} selected</span>
          )}
        </div>
        <FeatureSelector onSelectFeature={setActiveFeature} />
      </div>

      {/* Right panel — feature form */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-3xl mx-auto">
          {activeFeature && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Configure</span>
                <span className="text-gray-400">/</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {activeFeature.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )}
          <div className="card p-5">
            <FeatureFormRouter feature={activeFeature} />
          </div>
        </div>
      </div>
    </div>
  );
}
