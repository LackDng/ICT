import { useConfigStore, FEATURE_GROUPS } from '../../store/configStore';
import type { FeatureGroup } from '../../../../shared/types';

interface FeatureSelectorProps {
  onSelectFeature: (group: FeatureGroup) => void;
}

export function FeatureSelector({ onSelectFeature }: FeatureSelectorProps) {
  const { selectedFeatures, activeFeature, toggleFeature, setActiveFeature } = useConfigStore();

  const handleSelect = (id: FeatureGroup) => {
    setActiveFeature(id);
    onSelectFeature(id);
  };

  return (
    <div className="space-y-3">
      {FEATURE_GROUPS.map((group) => (
        <div key={group.group} className="card overflow-hidden">
          {/* Group header */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Group {group.group} — {group.label}
            </span>
          </div>

          {/* Features */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {group.features.map((feature) => {
              const isSelected = selectedFeatures.has(feature.id);
              const isActive = activeFeature === feature.id;

              return (
                <div
                  key={feature.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => handleSelect(feature.id)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); toggleFeature(feature.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  />

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      isActive ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {feature.label}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{feature.description}</div>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
