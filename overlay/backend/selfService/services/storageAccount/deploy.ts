import { arm, ensureResourceGroup } from '../../azureClient';
import { subscriptionId } from '../../config';
import { StorageAccountRequest } from './model';

export async function deployStorageAccount(
  request: StorageAccountRequest,
) {
  const sub = subscriptionId();

  await ensureResourceGroup(
    request.resourceGroup,
    request.location,
  );

  const result = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(
      request.resourceGroup,
    )}/providers/Microsoft.Storage/storageAccounts/${encodeURIComponent(
      request.name,
    )}`,
    '2023-05-01',
    {
      location: request.location,
      kind: 'StorageV2',
      sku: {
        name: request.sku,
      },
      tags: {
        ManagedBy: 'Backstage',
        ServiceType: 'Storage',
      },
      properties: {
        minimumTlsVersion: 'TLS1_2',
        allowBlobPublicAccess: false,
        supportsHttpsTrafficOnly: true,
      },
    },
  );

  return {
    message: 'Storage account deployment accepted',
    resourceId: `/subscriptions/${sub}/resourceGroups/${request.resourceGroup}/providers/Microsoft.Storage/storageAccounts/${request.name}`,
    azure: result.data,
  };
}
