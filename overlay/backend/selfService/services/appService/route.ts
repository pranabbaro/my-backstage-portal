import { Router } from 'express';
import { SelfServiceLogger } from '../../types';
import { deployAppService } from './deploy';
import { validateAppServiceRequest } from './validate';

export function createAppServiceRouter(
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

      const request = validateAppServiceRequest(req.body);
      const result = await deployAppService(request);

      logger.info(
        `Azure Self-Service App Service deployment accepted: ${request.name}`,
      );

      res.status(200).json(result);
    } catch (error) {
      logger.error(
        `Azure Self-Service App Service deployment failed: ${String(error)}`,
      );

      res.status(400).json({
        error: String(error),
      });
    }
  });

  return router;
}
