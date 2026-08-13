
import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { createSelfServiceRouter } from './router';

export default createBackendPlugin({
  pluginId:'azure-self-service',
  register(env) {
    env.registerInit({
      deps:{
        httpRouter:coreServices.httpRouter,
        logger:coreServices.logger,
        httpAuth:coreServices.httpAuth,
        userInfo:coreServices.userInfo,
      },
      async init({httpRouter,logger,httpAuth,userInfo}) {
        httpRouter.use(createSelfServiceRouter(logger,httpAuth,userInfo));
      },
    });
  },
});
