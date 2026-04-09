import type { ConfigChange, DiffLine, GeneratedConfig, FeatureGroup } from '../../../shared/types';

// ─── Tag prefix for identifying tool-managed rules ───────────────────────────
const TAG_PREFIX = '# TOOL:';

// ─── Main script generator ────────────────────────────────────────────────────

export function generateScript(
  featureGroup: FeatureGroup,
  desired: Record<string, unknown>[],
  existing: Record<string, unknown>[],
  options?: {
    path: string;
    identityKey?: string;
    nameKey?: string;
  }
): GeneratedConfig {
  const changes: ConfigChange[] = [];
  const path = options?.path || '';
  const identityKey = options?.identityKey || 'name';

  // Compute diff
  const existingMap = new Map(
    existing.map(e => [String((e as Record<string,unknown>)[identityKey] || e['.id']), e])
  );
  const desiredMap = new Map(
    desired.map(d => [String((d as Record<string,unknown>)[identityKey] || ''), d])
  );

  // Find entries to add or update
  for (const [key, desiredEntry] of desiredMap) {
    const existingEntry = existingMap.get(key);
    if (!existingEntry) {
      // ADD new entry
      const params = cleanParams(desiredEntry as Record<string, unknown>);
      changes.push({
        action: 'add',
        path,
        params,
        rosCommand: buildRosAddCommand(path, params),
        description: `Add ${featureGroup} entry: ${key}`,
      });
    } else {
      // Check if different (SET)
      const diff = computeParamDiff(
        existingEntry as Record<string, unknown>,
        desiredEntry as Record<string, unknown>
      );
      if (Object.keys(diff).length > 0) {
        const id = String((existingEntry as Record<string,unknown>)['.id'] || '');
        changes.push({
          action: 'set',
          path,
          params: { ...diff, '.id': id },
          rosCommand: buildRosSetCommand(path, id, diff),
          description: `Update ${featureGroup} entry: ${key}`,
        });
      }
    }
  }

  const script = generateRosScript(featureGroup, changes, path, existing);
  const diffLines = generateDiffLines(script, existing);

  return { featureGroup, changes, script, diffLines };
}

// ─── Firewall-specific generator (with comment tagging) ──────────────────────

export function generateFirewallScript(
  chain: string,
  desired: Record<string, unknown>[],
  existing: Record<string, unknown>[],
  path: string
): GeneratedConfig {
  const changes: ConfigChange[] = [];

  for (const rule of desired) {
    const comment = String(rule['comment'] || '');
    const tag = `${TAG_PREFIX}firewall:${rule['action'] || 'accept'}`;
    const fullComment = comment ? `${comment} ${tag}` : tag;

    // Check if rule with this tag already exists
    const existingRule = existing.find(e =>
      String((e as Record<string,unknown>)['comment'] || '').includes(TAG_PREFIX) &&
      String((e as Record<string,unknown>)['comment'] || '').includes(String(rule['action'] || ''))
    );

    const params = cleanParams({ ...rule as Record<string,unknown>, comment: fullComment, chain });

    if (!existingRule) {
      changes.push({
        action: 'add',
        path,
        params,
        rosCommand: buildRosAddCommand(path, params),
        description: `Add firewall rule: ${fullComment}`,
      });
    } else {
      const id = String((existingRule as Record<string,unknown>)['.id'] || '');
      const diff = computeParamDiff(existingRule as Record<string,unknown>, params);
      if (Object.keys(diff).length > 0) {
        changes.push({
          action: 'set',
          path,
          params: { ...diff, '.id': id },
          rosCommand: buildRosSetCommand(path, id, diff),
          description: `Update firewall rule: ${fullComment}`,
        });
      }
    }
  }

  const script = generateRosScript('firewall', changes, path, existing);
  const diffLines = generateDiffLines(script, existing);
  return { featureGroup: 'firewall', changes, script, diffLines };
}

// ─── Feature-specific script builders ────────────────────────────────────────

export function generateIpAddressScript(
  desired: Array<{ address: string; interface: string; comment?: string }>,
  existing: Record<string, unknown>[]
): GeneratedConfig {
  return generateScript('ip_addresses', desired as Record<string,unknown>[], existing, {
    path: '/ip/address',
    identityKey: 'address',
  });
}

export function generateDhcpScript(
  desiredServers: Record<string, unknown>[],
  desiredNetworks: Record<string, unknown>[],
  desiredPools: Record<string, unknown>[],
  existingServers: Record<string, unknown>[],
  existingNetworks: Record<string, unknown>[],
  existingPools: Record<string, unknown>[]
): GeneratedConfig {
  const serverChanges = generateScript('dhcp', desiredServers, existingServers, {
    path: '/ip/dhcp-server', identityKey: 'name',
  });
  const networkChanges = generateScript('dhcp', desiredNetworks, existingNetworks, {
    path: '/ip/dhcp-server/network', identityKey: 'address',
  });
  const poolChanges = generateScript('dhcp', desiredPools, existingPools, {
    path: '/ip/pool', identityKey: 'name',
  });

  const allChanges = [
    ...poolChanges.changes,
    ...networkChanges.changes,
    ...serverChanges.changes,
  ];

  const script = [
    '# DHCP Server Configuration',
    poolChanges.script,
    networkChanges.script,
    serverChanges.script,
  ].join('\n');

  return {
    featureGroup: 'dhcp',
    changes: allChanges,
    script,
    diffLines: generateDiffLines(script, [...existingServers, ...existingNetworks, ...existingPools]),
  };
}

export function generateWireGuardScript(
  desiredInterfaces: Record<string, unknown>[],
  desiredPeers: Record<string, unknown>[],
  existingInterfaces: Record<string, unknown>[],
  existingPeers: Record<string, unknown>[]
): GeneratedConfig {
  const ifChanges = generateScript('wireguard', desiredInterfaces, existingInterfaces, {
    path: '/interface/wireguard', identityKey: 'name',
  });
  const peerChanges = generateScript('wireguard', desiredPeers, existingPeers, {
    path: '/interface/wireguard/peers', identityKey: 'public-key',
  });

  const allChanges = [...ifChanges.changes, ...peerChanges.changes];
  const script = [
    '# WireGuard Configuration',
    ifChanges.script,
    peerChanges.script,
  ].join('\n');

  return {
    featureGroup: 'wireguard',
    changes: allChanges,
    script,
    diffLines: generateDiffLines(script, [...existingInterfaces, ...existingPeers]),
  };
}

export function generateVlanScript(
  desired: Record<string, unknown>[],
  existing: Record<string, unknown>[]
): GeneratedConfig {
  return generateScript('vlan', desired, existing, {
    path: '/interface/vlan', identityKey: 'name',
  });
}

export function generateQueueScript(
  desired: Record<string, unknown>[],
  existing: Record<string, unknown>[]
): GeneratedConfig {
  return generateScript('simple_queues', desired, existing, {
    path: '/queue/simple', identityKey: 'name',
  });
}

export function generateOspfScript(
  desiredInstances: Record<string, unknown>[],
  desiredAreas: Record<string, unknown>[],
  existingInstances: Record<string, unknown>[],
  existingAreas: Record<string, unknown>[]
): GeneratedConfig {
  const instanceChanges = generateScript('ospf', desiredInstances, existingInstances, {
    path: '/routing/ospf/instance', identityKey: 'name',
  });
  const areaChanges = generateScript('ospf', desiredAreas, existingAreas, {
    path: '/routing/ospf/area', identityKey: 'name',
  });

  const allChanges = [...instanceChanges.changes, ...areaChanges.changes];
  const script = ['# OSPF Configuration', instanceChanges.script, areaChanges.script].join('\n');

  return {
    featureGroup: 'ospf',
    changes: allChanges,
    script,
    diffLines: generateDiffLines(script, [...existingInstances, ...existingAreas]),
  };
}

export function generateStaticRouteScript(
  desired: Record<string, unknown>[],
  existing: Record<string, unknown>[]
): GeneratedConfig {
  return generateScript('static_routes', desired, existing, {
    path: '/ip/route', identityKey: 'dst-address',
  });
}

export function generateDnsScript(
  desiredConfig: Record<string, unknown>,
  desiredStatic: Record<string, unknown>[],
  existingStatic: Record<string, unknown>[]
): GeneratedConfig {
  const changes: ConfigChange[] = [];

  // DNS global config
  const dnsParams = cleanParams(desiredConfig);
  if (Object.keys(dnsParams).length > 0) {
    changes.push({
      action: 'set',
      path: '/ip/dns',
      params: dnsParams,
      rosCommand: buildRosSetCommand('/ip/dns', '', dnsParams),
      description: 'Configure DNS settings',
    });
  }

  // Static entries
  const staticResult = generateScript('dns', desiredStatic, existingStatic, {
    path: '/ip/dns/static', identityKey: 'name',
  });
  changes.push(...staticResult.changes);

  const script = [
    '# DNS Configuration',
    Object.keys(dnsParams).length > 0
      ? `/ip dns set ${Object.entries(dnsParams).map(([k, v]) => `${k}="${v}"`).join(' ')}`
      : '',
    staticResult.script,
  ].filter(Boolean).join('\n');

  return {
    featureGroup: 'dns',
    changes,
    script,
    diffLines: generateDiffLines(script, existingStatic),
  };
}

// ─── Rollback generator ───────────────────────────────────────────────────────

export function generateRollbackCommand(
  action: string,
  path: string,
  id: string | undefined,
  originalParams: Record<string, unknown>
): string {
  switch (action) {
    case 'add':
      return id ? buildRosSetCommand(path, id, {}) + ' remove' : `# Cannot rollback add without ID`;
    case 'set':
      return id ? buildRosSetCommand(path, id, originalParams) : `# Cannot rollback set without ID`;
    case 'remove':
      return buildRosAddCommand(path, originalParams);
    default:
      return `# No rollback for action: ${action}`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanParams(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '.id' || k === 'id') continue;
    if (v === undefined || v === null || v === '') continue;
    cleaned[k] = v;
  }
  return cleaned;
}

function computeParamDiff(
  existing: Record<string, unknown>,
  desired: Record<string, unknown>
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(desired)) {
    if (k === '.id' || k === 'id') continue;
    if (String(existing[k] ?? '') !== String(v ?? '')) {
      diff[k] = v;
    }
  }
  return diff;
}

function buildRosAddCommand(path: string, params: Record<string, unknown>): string {
  const rosPath = path.replace(/^\//, '').replace(/\//g, ' ');
  const paramStr = Object.entries(params)
    .filter(([k]) => k !== '.id')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `/${rosPath} add ${paramStr}`;
}

function buildRosSetCommand(path: string, id: string, params: Record<string, unknown>): string {
  const rosPath = path.replace(/^\//, '').replace(/\//g, ' ');
  const paramStr = Object.entries(params)
    .filter(([k]) => k !== '.id')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  if (id) return `/${rosPath} set [find where .id="${id}"] ${paramStr}`;
  return `/${rosPath} set ${paramStr}`;
}

function generateRosScript(
  featureGroup: string,
  changes: ConfigChange[],
  path: string,
  _existing: unknown[]
): string {
  const lines: string[] = [
    `# Generated by MikroTik Config Tool`,
    `# Feature: ${featureGroup}`,
    `# Path: ${path}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
  ];

  for (const change of changes) {
    lines.push(`# ${change.description}`);
    lines.push(change.rosCommand);
    lines.push('');
  }

  if (changes.length === 0) {
    lines.push('# No changes needed — configuration is up to date');
  }

  return lines.join('\n');
}

function generateDiffLines(
  script: string,
  existing: unknown[]
): DiffLine[] {
  const lines: DiffLine[] = [];
  const scriptLines = script.split('\n');

  for (const line of scriptLines) {
    if (line.startsWith('# ')) {
      lines.push({ type: 'unchanged', content: line });
    } else if (line.includes(' add ') || line.includes(' set ')) {
      // Check if it modifies existing
      const isModifying = existing.length > 0 && line.includes(' set ');
      lines.push({ type: isModifying ? 'remove' : 'add', content: line });
      if (isModifying) {
        lines.push({ type: 'add', content: line });
      }
    } else {
      lines.push({ type: 'unchanged', content: line });
    }
  }

  return lines;
}
