import { Router } from 'express';
import { SelfServiceLogger } from '../../types';
import { deployStorageAccount } from './deploy';
import { validateStorageAccountRequest } from './validate';

export function createStorageAccountRouter(
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

      const request = validateStorageAccountRequest(req.body);
      const result = await deployStorageAccount(request);

      logger.info(
        `Azure Self-Service Storage deployment accepted: ${request.name}`,
      );

      res.status(200).json(result);
    } catch (error) {
      logger.error(
        `Azure Self-Service Storage deployment failed: ${String(error)}`,
      );

      res.status(400).json({
        error: String(error),
      });
    }
  });

  return router;
}
