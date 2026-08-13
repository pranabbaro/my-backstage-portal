import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createSelfServiceRouter } from './router';

export default createBackendPlugin({
  pluginId: 'azure-self-service',

  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },

      async init({ httpRouter, logger }) {
        httpRouter.use(
          createSelfServiceRouter(logger),
        );
      },
    });
  },
});
