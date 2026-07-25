import React from 'react';
import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { rootRouteRef } from './routes';

const CloudIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M19.35 10.04A7.49 7.49 0 0 0 5.5 8A6 6 0 0 0 6 20h13a5 5 0 0 0 .35-9.96ZM19 18H6a4 4 0 0 1-.02-8 1 1 0 0 0 .95-.68A5.5 5.5 0 0 1 17.6 11a1 1 0 0 0 .96.86A3 3 0 0 1 19 18Z"
    />
  </svg>
);

const selfServicePage = PageBlueprint.make({
  params: {
    routeRef: rootRouteRef,
    path: '/self-service',
    title: 'Self-Service Cloud',
    icon: <CloudIcon />,
    loader: () =>
      import('./components/SelfServicePage').then(m => <m.SelfServicePage />),
  },
});

export default createFrontendPlugin({
  pluginId: 'cloud-self-service',
  title: 'Self-Service Cloud',
  icon: <CloudIcon />,
  info: {
    packageJson: () => import('../package.json'),
  },
  routes: {
    root: rootRouteRef,
  },
  extensions: [selfServicePage],
});
