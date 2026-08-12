import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

const selfServicePage = PageBlueprint.make({
  params: {
    path: '/self-service',
    title: 'Self Service',
    loader: () =>
      import('../../components/selfService/SelfServicePage').then(m => (
        <m.SelfServicePage />
      )),
  },
});

export const selfServicePlugin = createFrontendPlugin({
  pluginId: 'azure-self-service',
  title: 'Azure Self-Service',
  extensions: [selfServicePage],
});
