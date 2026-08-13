import { arm, ensureResourceGroup } from '../../azureClient';
import { subscriptionId } from '../../config';
import { AppServiceRequest } from './model';

export async function deployAppService(
  request: AppServiceRequest,
) {
  const sub = subscriptionId();

  await ensureResourceGroup(
    request.resourceGroup,
    request.location,
  );

  const planId =
    `/subscriptions/${sub}/resourceGroups/${request.resourceGroup}` +
    `/providers/Microsoft.Web/serverfarms/${request.planName}`;

  await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(
      request.resourceGroup,
    )}/providers/Microsoft.Web/serverfarms/${encodeURIComponent(
      request.planName,
    )}`,
    '2023-12-01',
    {
      location: request.location,
      kind: 'linux',
      sku: {
        name: request.sku,
        tier: 'Basic',
        size: request.sku,
        capacity: 1,
      },
      properties: {
        reserved: true,
      },
      tags: {
        ManagedBy: 'Backstage',
        ServiceType: 'AppServicePlan',
      },
    },
  );

  const site = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(
      request.resourceGroup,
    )}/providers/Microsoft.Web/sites/${encodeURIComponent(
      request.name,
    )}`,
    '2023-12-01',
    {
      location: request.location,
      kind: 'app,linux',
      identity: {
        type: 'SystemAssigned',
      },
      tags: {
        ManagedBy: 'Backstage',
        ServiceType: 'AppService',
      },
      properties: {
        serverFarmId: planId,
        httpsOnly: true,
        siteConfig: {
          linuxFxVersion: 'NODE|24-lts',
          minTlsVersion: '1.2',
          ftpsState: 'Disabled',
        },
      },
    },
  );

  return {
    message: 'App Service deployment accepted',
    resourceId: `/subscriptions/${sub}/resourceGroups/${request.resourceGroup}/providers/Microsoft.Web/sites/${request.name}`,
    hostname: `${request.name}.azurewebsites.net`,
    azure: site.data,
  };
}
