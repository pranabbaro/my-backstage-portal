import { Router } from 'express';
import { SelfServiceLogger } from '../../types';
import { deployVirtualMachine } from './deploy';
import { validateVirtualMachineRequest } from './validate';

export function createVirtualMachineRouter(
  logger: SelfServiceLogger,
): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      if (!req.body) {
        res.status(400).json({
          error: 'Request body is missing',
        });
        return;
      }

      const request = validateVirtualMachineRequest(req.body);
      const result = await deployVirtualMachine(request);

      logger.info(
        `Azure Self-Service VM deployment accepted: ${request.name}`,
      );

      res.status(200).json(result);
    } catch (error) {
      logger.error(
        `Azure Self-Service VM deployment failed: ${String(error)}`,
      );

      res.status(400).json({
        error: String(error),
      });
    }
  });

  return router;
}
