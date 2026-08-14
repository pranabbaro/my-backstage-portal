
import {
  arm,
  ensureResourceGroup,
  managedIdentityTenantId,
} from '../azureClient';
import { names } from '../naming';

const ALLOWED_SKUS = ['standard', 'premium'] as const;

export async function deployKeyVault(args: {
  subscriptionId: string;
  resourceGroupMode: string;
  resourceGroup: string;
  workload: string;
  environment: string;
  location: string;
  instance: string;
  sku: string;
  softDeleteRetentionInDays: number;
  purgeProtection: boolean;
  publicNetworkAccess: string;
}) {
  const generated = names(
    args.workload,
    args.environment,
    args.location,
    args.instance,
  );

  if (!ALLOWED_SKUS.includes(args.sku as any)) {
    throw new Error(`Key Vault SKU '${args.sku}' is not approved`);
  }

  if (
    !Number.isInteger(args.softDeleteRetentionInDays) ||
    args.softDeleteRetentionInDays < 7 ||
    args.softDeleteRetentionInDays > 90
  ) {
    throw new Error(
      'Key Vault soft-delete retention must be between 7 and 90 days',
    );
  }

  if (!['Enabled', 'Disabled'].includes(args.publicNetworkAccess)) {
    throw new Error('Invalid Key Vault public network access option');
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

  const tenantId = await managedIdentityTenantId();

  const result = await arm(
    'PUT',
    `/subscriptions/${args.subscriptionId}/resourceGroups/${encodeURIComponent(
      resourceGroup,
    )}/providers/Microsoft.KeyVault/vaults/${encodeURIComponent(
      generated.keyVault,
    )}`,
    '2024-11-01',
    {
      location: args.location,
      tags: {
        ManagedBy: 'Backstage',
        Workload: generated.workload,
        Environment: generated.environment,
        ServiceType: 'KeyVault',
      },
      properties: {
        tenantId,
        sku: {
          family: 'A',
          name: args.sku,
        },
        accessPolicies: [],
        enableRbacAuthorization: true,
        enableSoftDelete: true,
        softDeleteRetentionInDays:
          args.softDeleteRetentionInDays,
        enablePurgeProtection: args.purgeProtection,
        publicNetworkAccess: args.publicNetworkAccess,
        networkAcls: {
          bypass: 'AzureServices',
          defaultAction:
            args.publicNetworkAccess === 'Disabled'
              ? 'Deny'
              : 'Allow',
          ipRules: [],
          virtualNetworkRules: [],
        },
      },
    },
  );

  return {
    message: 'Key Vault deployment accepted',
    subscriptionId: args.subscriptionId,
    resourceGroup,
    keyVaultName: generated.keyVault,
    vaultUri:
      (result.data as {
        properties?: { vaultUri?: string };
      }).properties?.vaultUri ||
      `https://${generated.keyVault}.vault.azure.net/`,
    sku: args.sku,
    softDeleteRetentionInDays:
      args.softDeleteRetentionInDays,
    purgeProtection: args.purgeProtection,
    publicNetworkAccess: args.publicNetworkAccess,
    authorizationModel: 'Azure RBAC',
    azure: result.data,
  };
}
