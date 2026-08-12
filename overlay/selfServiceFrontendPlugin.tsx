import {
  createFrontendPlugin,
  createRouteRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';

const rootRouteRef = createRouteRef();

const selfServicePage = PageBlueprint.make({
  params: {
    routeRef: rootRouteRef,
    path: '/self-service',
    title: 'Self Service',
    icon: <CloudQueueIcon />,
    loader: () =>
      import('../../components/selfService/SelfServicePage').then(m => (
        <m.SelfServicePage />
      )),
  },
});

export const selfServicePlugin = createFrontendPlugin({
  pluginId: 'azure-self-service',
  title: 'Self Service',
  icon: <CloudQueueIcon />,
  routes: {
    root: rootRouteRef,
  },
  extensions: [selfServicePage],
});