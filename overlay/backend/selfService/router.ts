import { json, Router } from 'express';
import { platformStatus } from './config';
import { createAppServiceRouter } from './services/appService/route';
import { createStorageAccountRouter } from './services/storageAccount/route';
import { createVirtualMachineRouter } from './services/virtualMachine/route';
import { SelfServiceLogger } from './types';

export function createSelfServiceRouter(
  logger: SelfServiceLogger,
): Router {
  const router = Router();

  // One common JSON parser for all Self-Service APIs.
  router.use(json());

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      ...platformStatus(),
    });
  });

  router.get('/config', (_req, res) => {
    res.json(platformStatus());
  });

  // Keep the API URLs already used by the working frontend.
  router.use('/deploy/vm', createVirtualMachineRouter(logger));
  router.use(
    '/deploy/storage',
    createStorageAccountRouter(logger),
  );
  router.use(
    '/deploy/app-service',
    createAppServiceRouter(logger),
  );

  return router;
}
