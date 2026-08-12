import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';

const selfServicePage = PageBlueprint.make({
  params: {
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
  extensions: [selfServicePage],
});