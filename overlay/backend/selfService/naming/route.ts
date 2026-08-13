import { Router } from 'express';
import { buildNamingPreview } from './namingEngine';

export function createNamingRouter(): Router {
  const router = Router();

  router.get('/preview', (req, res) => {
    try {
      const preview = buildNamingPreview({
        workload: String(req.query.workload || ''),
        environment: String(req.query.environment || ''),
        location: String(req.query.location || ''),
        instance: String(req.query.instance || '01'),
      });

      res.json(preview);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  return router;
}
