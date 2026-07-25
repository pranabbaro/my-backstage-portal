import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { json, Router } from 'express';

const allowedRegions = new Set([
  'centralindia',
  'southindia',
  'westindia',
  'eastus',
  'westeurope',
]);

const allowedEnvironments = new Set(['dev', 'test', 'uat', 'prod']);

function makeRequestId(): string {
  return `REQ-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function requiredString(
  body: Record<string, unknown>,
  field: string,
  maxLength = 100,
): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
  if (value.length > maxLength) {
    throw new Error(`${field} exceeds ${maxLength} characters`);
  }
  return value.trim();
}

function common(body: Record<string, unknown>) {
  const resourceGroup = requiredString(body, 'resourceGroup', 90);
  const location = requiredString(body, 'location', 50);
  const environment = requiredString(body, 'environment', 10);
  const owner = requiredString(body, 'owner', 100);
  const costCenter = requiredString(body, 'costCenter', 50);

  if (!allowedRegions.has(location)) {
    throw new Error(`Unsupported region: ${location}`);
  }
  if (!allowedEnvironments.has(environment)) {
    throw new Error(`Unsupported environment: ${environment}`);
  }

  return { resourceGroup, location, environment, owner, costCenter };
}

function tags(values: ReturnType<typeof common>) {
  return {
    Environment: values.environment,
    Owner: values.owner,
    CostCenter: values.costCenter,
    ManagedBy: 'Backstage',
  };
}

export default createBackendPlugin({
  pluginId: 'cloud-provisioning',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ logger, httpRouter }) {
        const router = Router();
        router.use(json({ limit: '64kb' }));

        // Validation-only MVP. Real deployment will require authenticated users.
        ['/health', '/vm', '/storage', '/appservice'].forEach(path => {
          httpRouter.addAuthPolicy({
            path,
            allow: 'unauthenticated',
          });
        });

        router.get('/health', (_req, res) => {
          res.json({
            status: 'ok',
            plugin: 'cloud-provisioning',
            mode: 'validation-only',
          });
        });

        router.post('/vm', (req, res) => {
          try {
            const body = req.body as Record<string, unknown>;
            const base = common(body);
            const vmName = requiredString(body, 'vmName', 64);
            const osType = requiredString(body, 'osType', 20);
            const vmSize = requiredString(body, 'vmSize', 50);
            const adminUsername = requiredString(body, 'adminUsername', 64);

            if (!/^[A-Za-z0-9-]+$/.test(vmName)) {
              throw new Error(
                'vmName can contain only letters, numbers, and hyphens',
              );
            }
            if (!['Ubuntu', 'Windows'].includes(osType)) {
              throw new Error('osType must be Ubuntu or Windows');
            }

            const id = makeRequestId();
            logger.info(`Validated Azure VM request ${id} (${vmName})`);

            res.json({
              status: 'validated',
              requestId: id,
              message: `Azure VM ${vmName} validated successfully`,
              normalizedRequest: {
                resourceType: 'Microsoft.Compute/virtualMachines',
                vmName,
                osType,
                vmSize,
                adminUsername,
                ...base,
                tags: tags(base),
              },
            });
          } catch (error) {
            res.status(400).json({
              error: error instanceof Error ? error.message : 'Invalid request',
            });
          }
        });

        router.post('/storage', (req, res) => {
          try {
            const body = req.body as Record<string, unknown>;
            const base = common(body);
            const storageAccountName = requiredString(
              body,
              'storageAccountName',
              24,
            );
            const sku = requiredString(body, 'sku', 30);
            const publicNetworkAccess = Boolean(body.publicNetworkAccess);

            if (!/^[a-z0-9]{3,24}$/.test(storageAccountName)) {
              throw new Error(
                'storageAccountName must be 3-24 lowercase letters or numbers',
              );
            }

            const id = makeRequestId();
            logger.info(
              `Validated Azure Storage request ${id} (${storageAccountName})`,
            );

            res.json({
              status: 'validated',
              requestId: id,
              message: `Storage account ${storageAccountName} validated successfully`,
              normalizedRequest: {
                resourceType: 'Microsoft.Storage/storageAccounts',
                storageAccountName,
                sku,
                publicNetworkAccess,
                ...base,
                security: {
                  httpsOnly: true,
                  minimumTlsVersion: 'TLS1_2',
                  allowBlobPublicAccess: false,
                },
                tags: tags(base),
              },
            });
          } catch (error) {
            res.status(400).json({
              error: error instanceof Error ? error.message : 'Invalid request',
            });
          }
        });

        router.post('/appservice', (req, res) => {
          try {
            const body = req.body as Record<string, unknown>;
            const base = common(body);
            const appName = requiredString(body, 'appName', 60);
            const runtime = requiredString(body, 'runtime', 50);
            const sku = requiredString(body, 'sku', 20);

            if (!/^[A-Za-z0-9-]{2,60}$/.test(appName)) {
              throw new Error(
                'appName can contain only letters, numbers, and hyphens',
              );
            }

            const id = makeRequestId();
            logger.info(`Validated App Service request ${id} (${appName})`);

            res.json({
              status: 'validated',
              requestId: id,
              message: `App Service ${appName} validated successfully`,
              normalizedRequest: {
                resourceType: 'Microsoft.Web/sites',
                appName,
                runtime,
                sku,
                operatingSystem: 'Linux',
                httpsOnly: true,
                ...base,
                tags: tags(base),
              },
            });
          } catch (error) {
            res.status(400).json({
              error: error instanceof Error ? error.message : 'Invalid request',
            });
          }
        });

        httpRouter.use(router);
        logger.info(
          'Cloud provisioning plugin started in validation-only mode',
        );
      },
    });
  },
});
