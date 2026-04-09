import { Router, Request, Response } from 'express';
import { getRestClient } from '../adapters/connection-manager';

const router = Router();

router.get('/:host', async (req: Request, res: Response): Promise<void> => {
  const { host } = req.params;
  const username = req.query['username'] as string || 'admin';

  const client = getRestClient(host, username);
  if (!client) {
    res.status(503).json({ success: false, error: 'No active connection to this device' });
    return;
  }

  try {
    const [resource, interfaces, dhcpLeases, firewallFilter, logs] = await Promise.allSettled([
      client.get('/system/resource'),
      client.get('/interface'),
      client.get('/ip/dhcp-server/lease', { active: 'true' }),
      client.get('/ip/firewall/filter'),
      client.get('/log', { count: '20' }),
    ]);

    const resourceData = resource.status === 'fulfilled' ? resource.value : {};
    const interfaceData = interfaces.status === 'fulfilled' ? interfaces.value : [];
    const leaseData = dhcpLeases.status === 'fulfilled' ? dhcpLeases.value : [];
    const filterData = firewallFilter.status === 'fulfilled' ? firewallFilter.value : [];
    const logData = logs.status === 'fulfilled' ? logs.value : [];

    // Top 5 firewall rules by packet count
    const topRules = (filterData as Record<string,unknown>[])
      .filter(r => r['packets'] !== undefined)
      .sort((a, b) => Number(b['packets'] || 0) - Number(a['packets'] || 0))
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        resource: resourceData,
        interfaces: interfaceData,
        dhcpLeases: Array.isArray(leaseData) ? leaseData.length : 0,
        topFirewallRules: topRules,
        recentLogs: logData,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
