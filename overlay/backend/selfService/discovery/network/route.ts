import { Router } from 'express';
import { validateLocation } from '../../validation';
import { SelfServiceLogger } from '../../types';
import { listVirtualNetworks } from './virtualNetworks';
import { listSubnets } from './subnets';

export function createNetworkDiscoveryRouter(
  logger: SelfServiceLogger,
): Router {
  const router = Router();

  router.get('/vnets', async (req, res) => {
    try {
      const location = validateLocation(String(req.query.location || ''));
      const vnets = await listVirtualNetworks(location);
      res.json({ value: vnets });
    } catch (error) {
      logger.error(`VNet discovery failed: ${String(error)}`);
      res.status(400).json({ error: String(error) });
    }
  });

  router.get('/subnets', async (req, res) => {
    try {
      const vnetId = String(req.query.vnetId || '');
      if (!vnetId) {
        res.status(400).json({ error: 'vnetId is required' });
        return;
      }
      const subnets = await listSubnets(vnetId);
      res.json({ value: subnets });
    } catch (error) {
      logger.error(`Subnet discovery failed: ${String(error)}`);
      res.status(400).json({ error: String(error) });
    }
  });

  return router;
}
