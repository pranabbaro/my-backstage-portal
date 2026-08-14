
import { arm, ensureResourceGroup } from '../azureClient';
import { names } from '../naming';

const APPROVED_PLAN_SKUS: Record<
  string,
  { tier: string; size: string }
> = {
  B1: { tier: 'Basic', size: 'B1' },
  P1v3: { tier: 'PremiumV3', size: 'P1v3' },
};

const APPROVED_RUNTIMES = [
  'NODE|20-lts',
  'NODE|22-lts',
  'PYTHON|3.12',
] as const;

export async function deployAppService(args: {
  subscriptionId: string;
  resourceGroupMode: string;
  resourceGroup: string;
  workload: string;
  environment: string;
  location: string;
  instance: string;
  planSku: string;
  runtime: string;
  publicNetworkAccess: string;
}) {
  const generated = names(
    args.workload,
    args.environment,
    args.location,
    args.instance,
  );

  const sku = APPROVED_PLAN_SKUS[args.planSku];
  if (!sku) {
    throw new Error(`App Service Plan SKU '${args.planSku}' is not approved`);
  }

  if (!APPROVED_RUNTIMES.includes(args.runtime as any)) {
    throw new Error(`Runtime '${args.runtime}' is not approved`);
  }

  if (!['Enabled', 'Disabled'].includes(args.publicNetworkAccess)) {
    throw new Error('Invalid App Service public network access option');
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

  const planId =
    `/subscriptions/${args.subscriptionId}` +
    `/resourceGroups/${resourceGroup}` +
    `/providers/Microsoft.Web/serverfarms/${generated.appServicePlan}`;

  await arm(
    'PUT',
    `/subscriptions/${args.subscriptionId}/resourceGroups/${encodeURIComponent(
      resourceGroup,
    )}/providers/Microsoft.Web/serverfarms/${encodeURIComponent(
      generated.appServicePlan,
    )}`,
    '2024-11-01',
    {
      location: args.location,
      kind: 'linux',
      sku: {
        name: args.planSku,
        tier: sku.tier,
        size: sku.size,
        capacity: 1,
      },
      properties: {
        reserved: true,
      },
      tags: {
        ManagedBy: 'Backstage',
        Workload: generated.workload,
        Environment: generated.environment,
        ServiceType: 'AppServicePlan',
      },
    },
  );

  const site = await arm(
    'PUT',
    `/subscriptions/${args.subscriptionId}/resourceGroups/${encodeURIComponent(
      resourceGroup,
    )}/providers/Microsoft.Web/sites/${encodeURIComponent(
      generated.appService,
    )}`,
    '2025-03-01',
    {
      location: args.location,
      kind: 'app,linux',
      identity: {
        type: 'SystemAssigned',
      },
      tags: {
        ManagedBy: 'Backstage',
        Workload: generated.workload,
        Environment: generated.environment,
        ServiceType: 'AppService',
      },
      properties: {
        serverFarmId: planId,
        httpsOnly: true,
        publicNetworkAccess: args.publicNetworkAccess,
        siteConfig: {
          linuxFxVersion: args.runtime,
          minTlsVersion: '1.2',
          ftpsState: 'Disabled',
        },
      },
    },
  );

  return {
    message: 'App Service deployment accepted',
    subscriptionId: args.subscriptionId,
    resourceGroup,
    appServiceName: generated.appService,
    appServicePlanName: generated.appServicePlan,
    planSku: args.planSku,
    runtime: args.runtime,
    publicNetworkAccess: args.publicNetworkAccess,
    hostname: `${generated.appService}.azurewebsites.net`,
    azure: site.data,
  };
}
