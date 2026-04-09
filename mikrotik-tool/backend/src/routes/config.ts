import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  generateIpAddressScript,
  generateDhcpScript,
  generateFirewallScript,
  generateWireGuardScript,
  generateVlanScript,
  generateOspfScript,
  generateQueueScript,
  generateDnsScript,
  generateStaticRouteScript,
} from '../services/config-engine';

const router = Router();

const GenerateSchema = z.object({
  featureGroup: z.string(),
  desired: z.record(z.unknown()).or(z.array(z.record(z.unknown()))).optional(),
  existing: z.array(z.record(z.unknown())).optional(),
  // Feature-specific fields
  desiredServers: z.array(z.record(z.unknown())).optional(),
  desiredNetworks: z.array(z.record(z.unknown())).optional(),
  desiredPools: z.array(z.record(z.unknown())).optional(),
  existingServers: z.array(z.record(z.unknown())).optional(),
  existingNetworks: z.array(z.record(z.unknown())).optional(),
  existingPools: z.array(z.record(z.unknown())).optional(),
  desiredInterfaces: z.array(z.record(z.unknown())).optional(),
  desiredPeers: z.array(z.record(z.unknown())).optional(),
  existingInterfaces: z.array(z.record(z.unknown())).optional(),
  existingPeers: z.array(z.record(z.unknown())).optional(),
  desiredInstances: z.array(z.record(z.unknown())).optional(),
  desiredAreas: z.array(z.record(z.unknown())).optional(),
  existingInstances: z.array(z.record(z.unknown())).optional(),
  existingAreas: z.array(z.record(z.unknown())).optional(),
  dnsConfig: z.record(z.unknown()).optional(),
  chain: z.string().optional(),
});

router.post('/generate', (req: Request, res: Response): void => {
  const parse = GenerateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: parse.error.message });
    return;
  }

  const data = parse.data;
  const { featureGroup } = data;

  try {
    let result;

    switch (featureGroup) {
      case 'ip_addresses':
        result = generateIpAddressScript(
          (data.desired as Record<string,unknown>[] || []) as Array<{address: string; interface: string; comment?: string}>,
          data.existing || []
        );
        break;

      case 'dhcp':
        result = generateDhcpScript(
          data.desiredServers || [],
          data.desiredNetworks || [],
          data.desiredPools || [],
          data.existingServers || [],
          data.existingNetworks || [],
          data.existingPools || []
        );
        break;

      case 'firewall':
      case 'nat':
        result = generateFirewallScript(
          data.chain || 'forward',
          data.desired as Record<string,unknown>[] || [],
          data.existing || [],
          featureGroup === 'nat' ? '/ip/firewall/nat' : '/ip/firewall/filter'
        );
        break;

      case 'wireguard':
        result = generateWireGuardScript(
          data.desiredInterfaces || [],
          data.desiredPeers || [],
          data.existingInterfaces || [],
          data.existingPeers || []
        );
        break;

      case 'vlan':
        result = generateVlanScript(data.desired as Record<string,unknown>[] || [], data.existing || []);
        break;

      case 'ospf':
        result = generateOspfScript(
          data.desiredInstances || [],
          data.desiredAreas || [],
          data.existingInstances || [],
          data.existingAreas || []
        );
        break;

      case 'simple_queues':
        result = generateQueueScript(data.desired as Record<string,unknown>[] || [], data.existing || []);
        break;

      case 'dns':
        result = generateDnsScript(
          data.dnsConfig || {},
          data.desired as Record<string,unknown>[] || [],
          data.existing || []
        );
        break;

      case 'static_routes':
        result = generateStaticRouteScript(data.desired as Record<string,unknown>[] || [], data.existing || []);
        break;

      default:
        res.status(400).json({ success: false, error: `Unknown feature group: ${featureGroup}` });
        return;
    }

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
