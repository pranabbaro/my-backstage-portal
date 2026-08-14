import { json, Router } from 'express';
import {
  HttpAuthService,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { allowedLocations, platformStatus } from './config';
import { arm, ensureResourceGroup } from './azureClient';
import { SelfServiceLogger } from './types';
import {
  entitlementIds,
  listSubscriptions,
  NetworkType,
  resolvePlatformSubscription,
} from './routing/subscription';
import { listSubnets, listVnets } from './discovery/network';
import { names } from './naming';
import { listResourceGroups } from './discovery/resourceGroups';
import {
  approvedVmSizeNames,
  assertApprovedVmSize,
  listApprovedVmSizes,
} from './vmCatalog';
import { deployStorageAccount } from './services/storageAccount';
import { deployAppService } from './services/appService';
import { deployKeyVault } from './services/keyVault';
import { dispatchIaCIfConfigured } from './deployment/provider';

function validLocation(raw: string) {
  const value = raw.toLowerCase();
  if (!allowedLocations().includes(value)) {
    throw new Error(`Location '${value}' is not allowed`);
  }
  return value;
}

async function currentUser(
  req: any,
  httpAuth: HttpAuthService,
  userInfo: UserInfoService,
) {
  const credentials = await httpAuth.credentials(req, {
    allow: ['user'],
  });
  return userInfo.getUserInfo(credentials);
}

async function businessSubscriptions(
  req: any,
  httpAuth: HttpAuthService,
  userInfo: UserInfoService,
) {
  const info = await currentUser(req, httpAuth, userInfo);
  const entitled = entitlementIds(
    info.userEntityRef,
    info.ownershipEntityRefs,
  );
  const all = await listSubscriptions();

  return {
    userEntityRef: info.userEntityRef,
    value: all.filter(subscription =>
      entitled.has(subscription.subscriptionId.toLowerCase()),
    ),
  };
}



async function resolveTargetSubscription(
  body: Record<string, unknown>,
  req: any,
  httpAuth: HttpAuthService,
  userInfo: UserInfoService,
  location: string,
): Promise<string> {
  const networkType = String(body.networkType || '') as NetworkType;

  if (networkType === 'business-managed') {
    const entitled = await businessSubscriptions(req, httpAuth, userInfo);
    const requested = String(body.subscriptionId || '');
    const found = entitled.value.find(
      subscription =>
        subscription.subscriptionId.toLowerCase() ===
        requested.toLowerCase(),
    );

    if (!found) {
      throw new Error(
        'Requested Business Managed subscription is not assigned to this user',
      );
    }

    return found.subscriptionId;
  }

  if (!['internal', 'intranet', 'dmz'].includes(networkType)) {
    throw new Error('Invalid Network Connection Type');
  }

  return (
    await resolvePlatformSubscription(
      networkType as 'internal' | 'intranet' | 'dmz',
      location,
    )
  ).subscriptionId;
}

export function createSelfServiceRouter(
  logger: SelfServiceLogger,
  httpAuth: HttpAuthService,
  userInfo: UserInfoService,
): Router {
  const router = Router();
  router.use(json());

  router.get('/config', (_req, res) => {
    res.json(platformStatus());
  });

  router.get('/naming/preview', (req, res) => {
    try {
      res.json(
        names(
          String(req.query.workload || ''),
          String(req.query.environment || ''),
          String(req.query.location || ''),
          String(req.query.instance || '01'),
        ),
      );
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  // Subscription routing is intentionally unchanged from V8.
  router.get('/subscriptions/resolve', async (req, res) => {
    try {
      const networkType = String(
        req.query.networkType || '',
      ) as NetworkType;
      const location = validLocation(
        String(req.query.location || ''),
      );

      if (!['internal', 'intranet', 'dmz'].includes(networkType)) {
        throw new Error(
          'Automatic routing supports Internal, Intranet and DMZ',
        );
      }

      const subscription = await resolvePlatformSubscription(
        networkType as 'internal' | 'intranet' | 'dmz',
        location,
      );

      res.json({ selectionMode: 'automatic', subscription });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  router.get('/subscriptions/business-managed', async (req, res) => {
    try {
      res.json(await businessSubscriptions(req, httpAuth, userInfo));
    } catch (error) {
      logger.error(
        `Business Managed discovery failed: ${String(error)}`,
      );
      res.status(403).json({
        error:
          'Business Managed requires an authenticated Backstage user with explicit subscription entitlement',
        detail: String(error),
      });
    }
  });

  // Existing RG discovery.
  // Managed Identity lists Resource Groups in the already resolved/selected
  // subscription. End-user Azure RBAC filtering can be reintroduced later.
  router.get('/resource-groups/accessible', async (req, res) => {
    try {
      const subscriptionId = String(
        req.query.subscriptionId || '',
      ).trim();

      if (!subscriptionId) {
        throw new Error('subscriptionId is required');
      }

      const location = req.query.location
        ? validLocation(String(req.query.location))
        : undefined;

      res.json({
        mode: 'managed-identity',
        value: await listResourceGroups(subscriptionId, location),
      });
    } catch (error) {
      logger.error(
        `Resource Group discovery failed: ${String(error)}`,
      );
      res.status(400).json({
        error: String(error),
        value: [],
      });
    }
  });

  router.get('/network/vnets', async (req, res) => {
    try {
      const subscriptionId = String(
        req.query.subscriptionId || '',
      );
      if (!subscriptionId) {
        throw new Error('subscriptionId is required');
      }

      res.json({
        value: await listVnets(
          subscriptionId,
          validLocation(String(req.query.location || '')),
        ),
      });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  router.get('/network/subnets', async (req, res) => {
    try {
      res.json({
        value: await listSubnets(String(req.query.vnetId || '')),
      });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  router.get('/vm-size-names', (_req, res) => {
    res.json({
      value: approvedVmSizeNames(),
    });
  });

  router.get('/vm-sizes', async (req, res) => {
    try {
      const subscriptionId = String(
        req.query.subscriptionId || '',
      ).trim();
      if (!subscriptionId) {
        throw new Error('subscriptionId is required');
      }

      const location = validLocation(
        String(req.query.location || ''),
      );

      res.json({
        value: await listApprovedVmSizes(
          subscriptionId,
          location,
        ),
        pricingNote:
          'Estimated Microsoft Azure retail Linux compute price only. Monthly estimate uses 730 hours and excludes disks, backup, bandwidth, taxes, reservations, savings plans and negotiated discounts.',
      });
    } catch (error) {
      logger.error(`VM size discovery failed: ${String(error)}`);
      res.status(400).json({ error: String(error), value: [] });
    }
  });

  router.post('/deploy/vm', async (req, res) => {
    try {
      const body = req.body || {};
      const networkType = String(
        body.networkType || '',
      ) as NetworkType;
      const location = validLocation(String(body.location || ''));
      let subscriptionId = '';

      if (networkType === 'business-managed') {
        const entitled = await businessSubscriptions(
          req,
          httpAuth,
          userInfo,
        );
        const requested = String(body.subscriptionId || '');
        const found = entitled.value.find(
          subscription =>
            subscription.subscriptionId.toLowerCase() ===
            requested.toLowerCase(),
        );

        if (!found) {
          throw new Error(
            'Requested Business Managed subscription is not assigned to this user',
          );
        }
        subscriptionId = found.subscriptionId;
      } else {
        if (!['internal', 'intranet', 'dmz'].includes(networkType)) {
          throw new Error('Invalid Network Connection Type');
        }

        subscriptionId = (
          await resolvePlatformSubscription(
            networkType as 'internal' | 'intranet' | 'dmz',
            location,
          )
        ).subscriptionId;
      }

      const generated = names(
        String(body.workload || ''),
        String(body.environment || ''),
        location,
        String(body.instance || '01'),
      );

      const resourceGroupMode = String(
        body.resourceGroupMode || 'new',
      );
      if (!['existing', 'new'].includes(resourceGroupMode)) {
        throw new Error('Invalid Resource Group mode');
      }

      const resourceGroup =
        resourceGroupMode === 'new'
          ? generated.resourceGroup
          : String(body.resourceGroup || '').trim();

      if (!resourceGroup) {
        throw new Error('Resource Group is required');
      }


      const subnetId = String(body.subnetResourceId || '');
      if (
        !subnetId
          .toLowerCase()
          .startsWith(
            `/subscriptions/${subscriptionId.toLowerCase()}/`,
          )
      ) {
        throw new Error(
          'Selected subnet is not in the resolved subscription',
        );
      }

      const sshPublicKey = String(body.sshPublicKey || '').trim();
      if (!sshPublicKey.startsWith('ssh-')) {
        throw new Error('A valid SSH public key is required');
      }

      const vmSize = String(body.vmSize || 'Standard_B2s');
      await assertApprovedVmSize(subscriptionId, location, vmSize);

      const dispatched = await dispatchIaCIfConfigured({
        serviceType: 'virtual-machine',
        subscriptionId,
        resourceGroupMode:
          resourceGroupMode as 'existing' | 'new',
        resourceGroup,
        location,
        workload: generated.workload,
        environment: generated.environment,
        instance: generated.instance,
        parameters: {
          virtualMachineName: generated.virtualMachine,
          networkInterfaceName: generated.networkInterface,
          vmSize,
          adminUsername: String(
            body.adminUsername || 'azureadmin',
          ),
          subnetResourceId: subnetId,
          sshPublicKey,
          networkType,
        },
      });

      if (dispatched) {
        res.status(202).json({
          message:
            'Virtual Machine deployment submitted to approved IaC pipeline',
          deploymentProvider: dispatched.provider,
          subscriptionId,
          resourceGroup,
          virtualMachineName: generated.virtualMachine,
          ...dispatched,
        });
        return;
      }

      if (resourceGroupMode === 'new') {
        await ensureResourceGroup(
          subscriptionId,
          resourceGroup,
          location,
        );
      }

      const nic = await arm(
        'PUT',
        `/subscriptions/${subscriptionId}/resourceGroups/${encodeURIComponent(
          resourceGroup,
        )}/providers/Microsoft.Network/networkInterfaces/${encodeURIComponent(
          generated.networkInterface,
        )}`,
        '2023-11-01',
        {
          location,
          tags: {
            ManagedBy: 'Backstage',
            Workload: generated.workload,
            Environment: generated.environment,
            NetworkType: networkType,
          },
          properties: {
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
        (nic.data as { id?: string }).id ||
        `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}` +
          `/providers/Microsoft.Network/networkInterfaces/${generated.networkInterface}`;

      const adminUsername = String(
        body.adminUsername || 'azureadmin',
      );

      const vm = await arm(
        'PUT',
        `/subscriptions/${subscriptionId}/resourceGroups/${encodeURIComponent(
          resourceGroup,
        )}/providers/Microsoft.Compute/virtualMachines/${encodeURIComponent(
          generated.virtualMachine,
        )}`,
        '2023-09-01',
        {
          location,
          tags: {
            ManagedBy: 'Backstage',
            Workload: generated.workload,
            Environment: generated.environment,
            NetworkType: networkType,
          },
          properties: {
            hardwareProfile: { vmSize },
            storageProfile: {
              imageReference: {
                publisher: 'Canonical',
                offer: '0001-com-ubuntu-server-jammy',
                sku: '22_04-lts-gen2',
                version: 'latest',
              },
              osDisk: {
                createOption: 'FromImage',
                managedDisk: {
                  storageAccountType: 'Premium_LRS',
                },
              },
            },
            osProfile: {
              computerName: generated.virtualMachine,
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
              networkInterfaces: [
                { id: nicId, properties: { primary: true } },
              ],
            },
          },
        },
      );

      res.json({
        message: 'Linux VM deployment accepted',
        subscriptionId,
        networkType,
        resourceGroupMode,
        resourceGroup,
        virtualMachineName: generated.virtualMachine,
        networkInterfaceName: generated.networkInterface,
        vmSize,
        azure: vm.data,
      });
    } catch (error) {
      logger.error(`VM deployment failed: ${String(error)}`);
      res.status(400).json({ error: String(error) });
    }
  });

  router.post('/deploy/storage', async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const location = validLocation(String(body.location || ''));
      const subscriptionId = await resolveTargetSubscription(
        body,
        req,
        httpAuth,
        userInfo,
        location,
      );

      const generated = names(
        String(body.workload || ''),
        String(body.environment || ''),
        location,
        String(body.instance || '01'),
      );

      const resourceGroupMode = String(
        body.resourceGroupMode || 'new',
      ) as 'existing' | 'new';

      const resourceGroup =
        resourceGroupMode === 'new'
          ? generated.resourceGroup
          : String(body.resourceGroup || '').trim();

      const dispatched = await dispatchIaCIfConfigured({
        serviceType: 'storage-account',
        subscriptionId,
        resourceGroupMode,
        resourceGroup,
        location,
        workload: generated.workload,
        environment: generated.environment,
        instance: generated.instance,
        parameters: {
          storageAccountName: generated.storageAccount,
          redundancy: String(
            body.redundancy || 'Standard_LRS',
          ),
          accessTier: String(body.accessTier || 'Hot'),
          publicNetworkAccess: String(
            body.publicNetworkAccess || 'Enabled',
          ),
        },
      });

      if (dispatched) {
        res.status(202).json({
          message:
            'Storage Account deployment submitted to approved IaC pipeline',
          deploymentProvider: dispatched.provider,
          subscriptionId,
          resourceGroup,
          storageAccountName: generated.storageAccount,
          ...dispatched,
        });
        return;
      }

      const result = await deployStorageAccount({
        subscriptionId,
        resourceGroupMode: String(body.resourceGroupMode || 'new'),
        resourceGroup: String(body.resourceGroup || ''),
        workload: String(body.workload || ''),
        environment: String(body.environment || ''),
        location,
        instance: String(body.instance || '01'),
        redundancy: String(body.redundancy || 'Standard_LRS'),
        accessTier: String(body.accessTier || 'Hot'),
        publicNetworkAccess: String(
          body.publicNetworkAccess || 'Enabled',
        ),
      });

      res.json(result);
    } catch (error) {
      logger.error(`Storage Account deployment failed: ${String(error)}`);
      res.status(400).json({ error: String(error) });
    }
  });

  router.post('/deploy/app-service', async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const location = validLocation(String(body.location || ''));
      const subscriptionId = await resolveTargetSubscription(
        body,
        req,
        httpAuth,
        userInfo,
        location,
      );

      const generated = names(
        String(body.workload || ''),
        String(body.environment || ''),
        location,
        String(body.instance || '01'),
      );

      const resourceGroupMode = String(
        body.resourceGroupMode || 'new',
      ) as 'existing' | 'new';

      const resourceGroup =
        resourceGroupMode === 'new'
          ? generated.resourceGroup
          : String(body.resourceGroup || '').trim();

      const dispatched = await dispatchIaCIfConfigured({
        serviceType: 'app-service',
        subscriptionId,
        resourceGroupMode,
        resourceGroup,
        location,
        workload: generated.workload,
        environment: generated.environment,
        instance: generated.instance,
        parameters: {
          appServiceName: generated.appService,
          appServicePlanName: generated.appServicePlan,
          planSku: String(body.planSku || 'B1'),
          runtime: String(body.runtime || 'NODE|22-lts'),
          publicNetworkAccess: String(
            body.publicNetworkAccess || 'Enabled',
          ),
        },
      });

      if (dispatched) {
        res.status(202).json({
          message:
            'App Service deployment submitted to approved IaC pipeline',
          deploymentProvider: dispatched.provider,
          subscriptionId,
          resourceGroup,
          appServiceName: generated.appService,
          ...dispatched,
        });
        return;
      }

      const result = await deployAppService({
        subscriptionId,
        resourceGroupMode: String(body.resourceGroupMode || 'new'),
        resourceGroup: String(body.resourceGroup || ''),
        workload: String(body.workload || ''),
        environment: String(body.environment || ''),
        location,
        instance: String(body.instance || '01'),
        planSku: String(body.planSku || 'B1'),
        runtime: String(body.runtime || 'NODE|22-lts'),
        publicNetworkAccess: String(
          body.publicNetworkAccess || 'Enabled',
        ),
      });

      res.json(result);
    } catch (error) {
      logger.error(`App Service deployment failed: ${String(error)}`);
      res.status(400).json({ error: String(error) });
    }
  });

  router.post('/deploy/key-vault', async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const location = validLocation(String(body.location || ''));

      const subscriptionId = await resolveTargetSubscription(
        body,
        req,
        httpAuth,
        userInfo,
        location,
      );

      const retention = Number(
        body.softDeleteRetentionInDays || 90,
      );

      const purgeProtection =
        body.purgeProtection === true ||
        String(body.purgeProtection).toLowerCase() === 'true' ||
        String(body.purgeProtection).toLowerCase() === 'enabled';

      const generated = names(
        String(body.workload || ''),
        String(body.environment || ''),
        location,
        String(body.instance || '01'),
      );

      const resourceGroupMode = String(
        body.resourceGroupMode || 'new',
      ) as 'existing' | 'new';

      const resourceGroup =
        resourceGroupMode === 'new'
          ? generated.resourceGroup
          : String(body.resourceGroup || '').trim();

      const dispatched = await dispatchIaCIfConfigured({
        serviceType: 'key-vault',
        subscriptionId,
        resourceGroupMode,
        resourceGroup,
        location,
        workload: generated.workload,
        environment: generated.environment,
        instance: generated.instance,
        parameters: {
          keyVaultName: generated.keyVault,
          sku: String(
            body.sku || 'standard',
          ).toLowerCase(),
          softDeleteRetentionInDays: retention,
          purgeProtection,
          networkMode: String(
            body.networkMode || 'public',
          ),
          trustedServicesBypass:
            body.trustedServicesBypass === true ||
            String(
              body.trustedServicesBypass,
            ).toLowerCase() === 'true' ||
            String(
              body.trustedServicesBypass,
            ).toLowerCase() === 'enabled',
          vnetId: body.vnetId
            ? String(body.vnetId)
            : '',
          subnetResourceId: body.subnetResourceId
            ? String(body.subnetResourceId)
            : '',
          privateEndpointName:
            generated.keyVaultPrivateEndpoint,
          privateConnectionName:
            generated.keyVaultPrivateConnection,
          privateDnsLinkName:
            generated.keyVaultDnsLink,
        },
      });

      if (dispatched) {
        res.status(202).json({
          message:
            'Key Vault deployment submitted to approved IaC pipeline',
          deploymentProvider: dispatched.provider,
          subscriptionId,
          resourceGroup,
          keyVaultName: generated.keyVault,
          ...dispatched,
        });
        return;
      }

      const result = await deployKeyVault({
        subscriptionId,
        resourceGroupMode: String(
          body.resourceGroupMode || 'new',
        ),
        resourceGroup: String(body.resourceGroup || ''),
        workload: String(body.workload || ''),
        environment: String(body.environment || ''),
        location,
        instance: String(body.instance || '01'),
        sku: String(body.sku || 'standard').toLowerCase(),
        softDeleteRetentionInDays: retention,
        purgeProtection,
        networkMode: String(
          body.networkMode || 'public',
        ),
        trustedServicesBypass:
          body.trustedServicesBypass === true ||
          String(body.trustedServicesBypass).toLowerCase() ===
            'true' ||
          String(body.trustedServicesBypass).toLowerCase() ===
            'enabled',
        vnetId: body.vnetId
          ? String(body.vnetId)
          : undefined,
        subnetResourceId: body.subnetResourceId
          ? String(body.subnetResourceId)
          : undefined,
      });

      res.json(result);
    } catch (error) {
      logger.error(
        `Key Vault deployment failed: ${String(error)}`,
      );
      res.status(400).json({ error: String(error) });
    }
  });

  return router;
}
