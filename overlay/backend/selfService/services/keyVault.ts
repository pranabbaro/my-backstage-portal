
import {
  arm,
  ensureResourceGroup,
  managedIdentityTenantId,
} from '../azureClient';
import { names } from '../naming';
import {
  configureKeyVaultPrivateEndpoint,
  enableKeyVaultServiceEndpoint,
} from './keyVaultNetworking';

const ALLOWED_SKUS = ['standard', 'premium'] as const;
const NETWORK_MODES = [
  'public',
  'service-endpoint',
  'private-endpoint',
] as const;

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
  networkMode: string;
  trustedServicesBypass: boolean;
  vnetId?: string;
  subnetResourceId?: string;
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

  if (!NETWORK_MODES.includes(args.networkMode as any)) {
    throw new Error(
      `Key Vault network mode '${args.networkMode}' is invalid`,
    );
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

  const requiresNetwork =
    args.networkMode === 'service-endpoint' ||
    args.networkMode === 'private-endpoint';

  if (
    requiresNetwork &&
    (!args.vnetId || !args.subnetResourceId)
  ) {
    throw new Error(
      'VNet and Subnet are required for the selected Key Vault network mode',
    );
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

  if (
    args.networkMode === 'service-endpoint' &&
    args.subnetResourceId
  ) {
    await enableKeyVaultServiceEndpoint(
      args.subnetResourceId,
    );
  }

  const tenantId = await managedIdentityTenantId();

  const vaultResourceId =
    `/subscriptions/${args.subscriptionId}` +
    `/resourceGroups/${resourceGroup}` +
    `/providers/Microsoft.KeyVault/vaults/` +
    `${generated.keyVault}`;

  const publicNetworkAccess =
    args.networkMode === 'private-endpoint'
      ? 'Disabled'
      : 'Enabled';

  const defaultAction =
    args.networkMode === 'public' ? 'Allow' : 'Deny';

  const virtualNetworkRules =
    args.networkMode === 'service-endpoint' &&
    args.subnetResourceId
      ? [
          {
            id: args.subnetResourceId,
            ignoreMissingVnetServiceEndpoint: false,
          },
        ]
      : [];

  const result = await arm(
    'PUT',
    vaultResourceId,
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
        publicNetworkAccess,
        networkAcls: {
          bypass: args.trustedServicesBypass
            ? 'AzureServices'
            : 'None',
          defaultAction,
          ipRules: [],
          virtualNetworkRules,
        },
      },
    },
  );

  let privateEndpoint:
    | {
        privateEndpointId: string;
        privateDnsZoneId: string;
      }
    | undefined;

  if (
    args.networkMode === 'private-endpoint' &&
    args.subnetResourceId &&
    args.vnetId
  ) {
    privateEndpoint =
      await configureKeyVaultPrivateEndpoint({
        subscriptionId: args.subscriptionId,
        resourceGroup,
        location: args.location,
        subnetId: args.subnetResourceId,
        vnetId: args.vnetId,
        vaultResourceId,
        privateEndpointName:
          generated.keyVaultPrivateEndpoint,
        connectionName:
          generated.keyVaultPrivateConnection,
        dnsLinkName: generated.keyVaultDnsLink,
      });
  }

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
    networkMode: args.networkMode,
    publicNetworkAccess,
    trustedServicesBypass:
      args.trustedServicesBypass,
    authorizationModel: 'Azure RBAC',
    privateEndpoint,
    azure: result.data,
  };
}
