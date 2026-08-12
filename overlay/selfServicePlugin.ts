import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';

type JsonRecord = Record<string, unknown>;

const MANAGEMENT = 'https://management.azure.com';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required App Service setting: ${name}`);
  return value;
}

function subscriptionId(): string {
  return requiredEnv('AZURE_SUBSCRIPTION_ID');
}

function allowedLocations(): string[] {
  const configured = process.env.AZURE_ALLOWED_LOCATIONS?.trim();
  if (!configured) return ['centralindia', 'southindia', 'westindia'];
  return configured
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

function validateLocation(location: string): string {
  const value = String(location || '').trim().toLowerCase();
  if (!allowedLocations().includes(value)) {
    throw new Error(
      `Location '${value}' is not allowed. Allowed locations: ${allowedLocations().join(', ')}`,
    );
  }
  return value;
}

function validateResourceGroup(name: string): string {
  const value = String(name || '').trim();
  if (!/^[a-zA-Z0-9._()-]{1,90}$/.test(value)) {
    throw new Error('Invalid resource group name');
  }
  return value;
}

function validateSimpleName(name: string, label: string, max = 64): string {
  const value = String(name || '').trim();
  if (!new RegExp(`^[a-zA-Z0-9-]{2,${max}}$`).test(value)) {
    throw new Error(`${label} must contain only letters, numbers and hyphens`);
  }
  return value;
}

async function managedIdentityToken(): Promise<string> {
  const endpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader = process.env.IDENTITY_HEADER;
  if (!endpoint || !identityHeader) {
    throw new Error(
      'Azure App Service Managed Identity is not enabled. Enable System Assigned Managed Identity on this App Service.',
    );
  }

  const url = new URL(endpoint);
  url.searchParams.set('api-version', '2019-08-01');
  url.searchParams.set('resource', `${MANAGEMENT}/`);

  const response = await fetch(url, {
    headers: {
      'X-IDENTITY-HEADER': identityHeader,
      Metadata: 'true',
    },
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Managed Identity token request failed: ${data.error_description || data.error || response.statusText}`,
    );
  }
  return data.access_token;
}

async function arm(
  method: string,
  path: string,
  apiVersion: string,
  body?: JsonRecord,
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const token = await managedIdentityToken();
  const separator = path.includes('?') ? '&' : '?';
  const url = `${MANAGEMENT}${path}${separator}api-version=${encodeURIComponent(apiVersion)}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data);
    throw new Error(`Azure ARM ${method} failed (${response.status}): ${detail}`);
  }
  return { status: response.status, data, headers: response.headers };
}

async function ensureResourceGroup(resourceGroup: string, location: string) {
  const sub = subscriptionId();
  return arm(
    'PUT',
    `/subscriptions/${sub}/resourcegroups/${encodeURIComponent(resourceGroup)}`,
    '2022-09-01',
    {
      location,
      tags: {
        ManagedBy: 'Backstage',
        Portal: 'EnterpriseDeveloperPortal',
      },
    },
  );
}

async function deployStorage(input: JsonRecord) {
  const sub = subscriptionId();
  const resourceGroup = validateResourceGroup(String(input.resourceGroup || ''));
  const location = validateLocation(String(input.location || ''));
  const name = String(input.name || '').trim().toLowerCase();

  if (!/^[a-z0-9]{3,24}$/.test(name)) {
    throw new Error(
      'Storage account name must be 3-24 lowercase letters/numbers with no hyphens',
    );
  }

  await ensureResourceGroup(resourceGroup, location);

  const result = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Storage/storageAccounts/${encodeURIComponent(name)}`,
    '2023-05-01',
    {
      location,
      kind: 'StorageV2',
      sku: { name: String(input.sku || 'Standard_LRS') },
      tags: { ManagedBy: 'Backstage', ServiceType: 'Storage' },
      properties: {
        minimumTlsVersion: 'TLS1_2',
        allowBlobPublicAccess: false,
        supportsHttpsTrafficOnly: true,
        publicNetworkAccess: 'Enabled',
      },
    },
  );

  return {
    message: 'Storage account deployment accepted',
    resourceId: `/subscriptions/${sub}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${name}`,
    azure: result.data,
  };
}

async function deployAppService(input: JsonRecord) {
  const sub = subscriptionId();
  const resourceGroup = validateResourceGroup(String(input.resourceGroup || ''));
  const location = validateLocation(String(input.location || ''));
  const appName = validateSimpleName(String(input.name || ''), 'App Service name', 60).toLowerCase();
  const planName = validateSimpleName(
    String(input.planName || `${appName}-plan`),
    'App Service plan name',
    40,
  );

  await ensureResourceGroup(resourceGroup, location);

  const planId = `/subscriptions/${sub}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/serverfarms/${planName}`;

  await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Web/serverfarms/${encodeURIComponent(planName)}`,
    '2023-12-01',
    {
      location,
      kind: 'linux',
      sku: {
        name: String(input.sku || 'B1'),
        tier: 'Basic',
        size: String(input.sku || 'B1'),
        capacity: 1,
      },
      properties: { reserved: true },
      tags: { ManagedBy: 'Backstage', ServiceType: 'AppServicePlan' },
    },
  );

  const site = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Web/sites/${encodeURIComponent(appName)}`,
    '2023-12-01',
    {
      location,
      kind: 'app,linux',
      identity: { type: 'SystemAssigned' },
      tags: { ManagedBy: 'Backstage', ServiceType: 'AppService' },
      properties: {
        serverFarmId: planId,
        httpsOnly: true,
        publicNetworkAccess: 'Enabled',
        siteConfig: {
          linuxFxVersion: 'NODE|24-lts',
          minTlsVersion: '1.2',
          ftpsState: 'Disabled',
          alwaysOn: false,
        },
      },
    },
  );

  return {
    message: 'App Service deployment accepted',
    resourceId: `/subscriptions/${sub}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/sites/${appName}`,
    hostname: `${appName}.azurewebsites.net`,
    azure: site.data,
  };
}

function validateSubnetId(value: string): string {
  const subnet = String(value || '').trim();
  const sub = subscriptionId().toLowerCase();
  if (
    !subnet.toLowerCase().startsWith(`/subscriptions/${sub}/resourcegroups/`) ||
    !subnet.toLowerCase().includes('/providers/microsoft.network/virtualnetworks/') ||
    !subnet.toLowerCase().includes('/subnets/')
  ) {
    throw new Error(
      'Subnet Resource ID must be a subnet in the configured Azure subscription',
    );
  }
  return subnet;
}

async function deployVm(input: JsonRecord) {
  const sub = subscriptionId();
  const resourceGroup = validateResourceGroup(String(input.resourceGroup || ''));
  const location = validateLocation(String(input.location || ''));
  const vmName = validateSimpleName(String(input.name || ''), 'VM name', 15);
  const adminUsername = String(input.adminUsername || 'azureadmin').trim();
  const sshPublicKey = String(input.sshPublicKey || '').trim();
  const subnetId = validateSubnetId(String(input.subnetResourceId || ''));

  if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,31}$/.test(adminUsername)) {
    throw new Error('Invalid admin username');
  }
  if (!sshPublicKey.startsWith('ssh-')) {
    throw new Error('A valid SSH public key is required');
  }

  await ensureResourceGroup(resourceGroup, location);

  const nicName = `${vmName}-nic`;
  const nic = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Network/networkInterfaces/${encodeURIComponent(nicName)}`,
    '2023-11-01',
    {
      location,
      tags: { ManagedBy: 'Backstage', ServiceType: 'VM-NIC' },
      properties: {
        enableAcceleratedNetworking: false,
        ipConfigurations: [
          {
            name: 'ipconfig1',
            properties: {
              privateIPAllocationMethod: 'Dynamic',
              subnet: { id: subnetId },
            },
          },
        ],
      },
    },
  );

  const nicId =
    (nic.data as { id?: string })?.id ||
    `/subscriptions/${sub}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${nicName}`;

  const vm = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Compute/virtualMachines/${encodeURIComponent(vmName)}`,
    '2023-09-01',
    {
      location,
      tags: { ManagedBy: 'Backstage', ServiceType: 'VirtualMachine' },
      properties: {
        hardwareProfile: { vmSize: String(input.vmSize || 'Standard_B2s') },
        storageProfile: {
          imageReference: {
            publisher: 'Canonical',
            offer: '0001-com-ubuntu-server-jammy',
            sku: '22_04-lts-gen2',
            version: 'latest',
          },
          osDisk: {
            createOption: 'FromImage',
            managedDisk: { storageAccountType: 'Premium_LRS' },
          },
        },
        osProfile: {
          computerName: vmName,
          adminUsername,
          linuxConfiguration: {
            disablePasswordAuthentication: true,
            ssh: {
              publicKeys: [
                {
                  path: `/home/${adminUsername}/.ssh/authorized_keys`,
                  keyData: sshPublicKey,
                },
              ],
            },
          },
        },
        networkProfile: {
          networkInterfaces: [{ id: nicId, properties: { primary: true } }],
        },
      },
    },
  );

  return {
    message: 'Linux VM deployment accepted',
    resourceId: `/subscriptions/${sub}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}`,
    networkInterfaceId: nicId,
    azure: vm.data,
  };
}

export default createBackendPlugin({
  pluginId: 'azure-self-service',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ httpRouter, logger }) {
        const router = Router();

        router.get('/health', (_req, res) => {
          res.json({
            status: 'ok',
            managedIdentity:
              Boolean(process.env.IDENTITY_ENDPOINT) &&
              Boolean(process.env.IDENTITY_HEADER),
            subscriptionConfigured: Boolean(process.env.AZURE_SUBSCRIPTION_ID),
          });
        });

        router.get('/config', (_req, res) => {
          res.json({
            managedIdentity:
              Boolean(process.env.IDENTITY_ENDPOINT) &&
              Boolean(process.env.IDENTITY_HEADER),
            subscriptionConfigured: Boolean(process.env.AZURE_SUBSCRIPTION_ID),
            subscriptionId: process.env.AZURE_SUBSCRIPTION_ID
              ? `${process.env.AZURE_SUBSCRIPTION_ID.slice(0, 8)}...`
              : '',
            allowedLocations: allowedLocations(),
          });
        });

        router.post('/deploy/storage', async (req, res) => {
          try {
            const result = await deployStorage(req.body as JsonRecord);
            logger.info('Azure self-service storage request completed');
            res.status(200).json(result);
          } catch (error) {
            logger.error(`Azure storage deployment failed: ${String(error)}`);
            res.status(400).json({ error: String(error) });
          }
        });

        router.post('/deploy/app-service', async (req, res) => {
          try {
            const result = await deployAppService(req.body as JsonRecord);
            logger.info('Azure self-service App Service request completed');
            res.status(200).json(result);
          } catch (error) {
            logger.error(`Azure App Service deployment failed: ${String(error)}`);
            res.status(400).json({ error: String(error) });
          }
        });

        router.post('/deploy/vm', async (req, res) => {
          try {
            const result = await deployVm(req.body as JsonRecord);
            logger.info('Azure self-service VM request completed');
            res.status(200).json(result);
          } catch (error) {
            logger.error(`Azure VM deployment failed: ${String(error)}`);
            res.status(400).json({ error: String(error) });
          }
        });

        httpRouter.use(router);
      },
    });
  },
});
