
import { arm, ensureResourceGroup } from '../azureClient';
import { names } from '../naming';

const ALLOWED_REDUNDANCY = [
  'Standard_LRS',
  'Standard_ZRS',
  'Standard_GRS',
] as const;

const ALLOWED_ACCESS_TIERS = ['Hot', 'Cool'] as const;

export async function deployStorageAccount(args: {
  subscriptionId: string;
  resourceGroupMode: string;
  resourceGroup: string;
  workload: string;
  environment: string;
  location: string;
  instance: string;
  redundancy: string;
  accessTier: string;
  publicNetworkAccess: string;
}) {
  const generated = names(
    args.workload,
    args.environment,
    args.location,
    args.instance,
  );

  if (!ALLOWED_REDUNDANCY.includes(args.redundancy as any)) {
    throw new Error(`Storage redundancy '${args.redundancy}' is not approved`);
  }

  if (!ALLOWED_ACCESS_TIERS.includes(args.accessTier as any)) {
    throw new Error(`Storage access tier '${args.accessTier}' is not approved`);
  }

  if (!['Enabled', 'Disabled'].includes(args.publicNetworkAccess)) {
    throw new Error('Invalid Storage public network access option');
  }

  const resourceGroup =
    args.resourceGroupMode === 'new'
      ? generated.resourceGroup
      : args.resourceGroup.trim();

  if (!resourceGroup) {
    throw new Error('Resource Group is required');
  }

  if (args.resourceGroupMode === 'new') {
    await ensureResourceGroup(
      args.subscriptionId,
      resourceGroup,
      args.location,
    );
  }

  const result = await arm(
    'PUT',
    `/subscriptions/${args.subscriptionId}/resourceGroups/${encodeURIComponent(
      resourceGroup,
    )}/providers/Microsoft.Storage/storageAccounts/${encodeURIComponent(
      generated.storageAccount,
    )}`,
    '2024-01-01',
    {
      location: args.location,
      kind: 'StorageV2',
      sku: {
        name: args.redundancy,
      },
      tags: {
        ManagedBy: 'Backstage',
        Workload: generated.workload,
        Environment: generated.environment,
        ServiceType: 'StorageAccount',
      },
      properties: {
        accessTier: args.accessTier,
        minimumTlsVersion: 'TLS1_2',
        allowBlobPublicAccess: false,
        supportsHttpsTrafficOnly: true,
        publicNetworkAccess: args.publicNetworkAccess,
      },
    },
  );

  return {
    message: 'Storage Account deployment accepted',
    subscriptionId: args.subscriptionId,
    resourceGroup,
    storageAccountName: generated.storageAccount,
    redundancy: args.redundancy,
    accessTier: args.accessTier,
    publicNetworkAccess: args.publicNetworkAccess,
    azure: result.data,
  };
}
