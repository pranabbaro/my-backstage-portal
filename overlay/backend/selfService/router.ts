
import { json, Router } from 'express';
import { HttpAuthService, UserInfoService } from '@backstage/backend-plugin-api';
import { allowedLocations, platformStatus } from './config';
import { arm, ensureResourceGroup } from './azureClient';
import { SelfServiceLogger } from './types';
import {
  entitlementIds, listSubscriptions, NetworkType, resolvePlatformSubscription,
} from './routing/subscription';
import { listResourceGroups } from './discovery/resourceGroups';
import { listSubnets, listVnets } from './discovery/network';
import { names } from './naming';

function validLocation(raw:string) {
  const v = raw.toLowerCase();
  if (!allowedLocations().includes(v)) throw new Error(`Location '${v}' is not allowed`);
  return v;
}

async function businessSubscriptions(
  req:any, httpAuth:HttpAuthService, userInfo:UserInfoService,
) {
  const credentials = await httpAuth.credentials(req, { allow:['user'] });
  const info = await userInfo.getUserInfo(credentials);
  const entitled = entitlementIds(info.userEntityRef, info.ownershipEntityRefs);
  const all = await listSubscriptions();
  return {
    userEntityRef:info.userEntityRef,
    value:all.filter(s => entitled.has(s.subscriptionId.toLowerCase())),
  };
}

export function createSelfServiceRouter(
  logger:SelfServiceLogger, httpAuth:HttpAuthService, userInfo:UserInfoService,
):Router {
  const router = Router();
  router.use(json());

  router.get('/config', (_req,res) => res.json(platformStatus()));

  router.get('/naming/preview', (req,res) => {
    try {
      res.json(names(
        String(req.query.workload||''), String(req.query.environment||''),
        String(req.query.location||''), String(req.query.instance||'01'),
      ));
    } catch(e) { res.status(400).json({error:String(e)}); }
  });

  router.get('/subscriptions/resolve', async (req,res) => {
    try {
      const t = String(req.query.networkType||'') as NetworkType;
      const l = validLocation(String(req.query.location||''));
      if (!['internal','intranet','dmz'].includes(t)) throw new Error('Automatic routing supports Internal, Intranet and DMZ');
      const subscription = await resolvePlatformSubscription(t as any, l);
      res.json({ selectionMode:'automatic', subscription });
    } catch(e) { res.status(400).json({error:String(e)}); }
  });

  router.get('/subscriptions/business-managed', async (req,res) => {
    try { res.json(await businessSubscriptions(req,httpAuth,userInfo)); }
    catch(e) {
      logger.error(`Business Managed discovery failed: ${String(e)}`);
      res.status(403).json({
        error:'Business Managed requires an authenticated Backstage user with explicit subscription entitlement',
        detail:String(e),
      });
    }
  });

  router.get('/resource-groups', async (req,res) => {
    try {
      const subscriptionId=String(req.query.subscriptionId||'');
      if (!subscriptionId) throw new Error('subscriptionId is required');
      const location=req.query.location ? validLocation(String(req.query.location)) : undefined;
      res.json({value:await listResourceGroups(subscriptionId,location)});
    } catch(e) { res.status(400).json({error:String(e)}); }
  });

  router.get('/network/vnets', async (req,res) => {
    try {
      const subscriptionId=String(req.query.subscriptionId||'');
      if (!subscriptionId) throw new Error('subscriptionId is required');
      res.json({value:await listVnets(subscriptionId,validLocation(String(req.query.location||'')))});
    } catch(e) { res.status(400).json({error:String(e)}); }
  });

  router.get('/network/subnets', async (req,res) => {
    try { res.json({value:await listSubnets(String(req.query.vnetId||''))}); }
    catch(e) { res.status(400).json({error:String(e)}); }
  });

  router.post('/deploy/vm', async (req,res) => {
    try {
      const b = req.body || {};
      const networkType = String(b.networkType||'') as NetworkType;
      const location = validLocation(String(b.location||''));
      let subscriptionId = '';

      if (networkType === 'business-managed') {
        const entitled = await businessSubscriptions(req,httpAuth,userInfo);
        const requested = String(b.subscriptionId||'');
        const found = entitled.value.find(s => s.subscriptionId.toLowerCase()===requested.toLowerCase());
        if (!found) throw new Error('Requested Business Managed subscription is not assigned to this user');
        subscriptionId = found.subscriptionId;
      } else {
        if (!['internal','intranet','dmz'].includes(networkType)) throw new Error('Invalid Network Connection Type');
        subscriptionId = (await resolvePlatformSubscription(networkType as any,location)).subscriptionId;
      }

      const n = names(
        String(b.workload||''), String(b.environment||''),
        location, String(b.instance||'01'),
      );

      const rgMode = String(b.resourceGroupMode||'new');
      if (!['existing','new'].includes(rgMode)) throw new Error('Invalid Resource Group mode');
      const resourceGroup = rgMode==='new' ? n.resourceGroup : String(b.resourceGroup||'').trim();
      if (!resourceGroup) throw new Error('Resource Group is required');

      const subnetId=String(b.subnetResourceId||'');
      if (!subnetId.toLowerCase().startsWith(`/subscriptions/${subscriptionId.toLowerCase()}/`)) {
        throw new Error('Selected subnet is not in the resolved subscription');
      }

      const ssh=String(b.sshPublicKey||'').trim();
      if (!ssh.startsWith('ssh-')) throw new Error('A valid SSH public key is required');

      if (rgMode==='new') await ensureResourceGroup(subscriptionId,resourceGroup,location);

      const nic = await arm(
        'PUT',
        `/subscriptions/${subscriptionId}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Network/networkInterfaces/${encodeURIComponent(n.networkInterface)}`,
        '2023-11-01',
        {
          location,
          tags:{ManagedBy:'Backstage',Workload:n.workload,Environment:n.environment,NetworkType:networkType},
          properties:{ipConfigurations:[{name:'ipconfig1',properties:{privateIPAllocationMethod:'Dynamic',subnet:{id:subnetId}}}]},
        },
      );
      const nicId=(nic.data as {id?:string}).id ||
        `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${n.networkInterface}`;

      const vmSize=String(b.vmSize||'Standard_B2s');
      const adminUsername=String(b.adminUsername||'azureadmin');
      const vm = await arm(
        'PUT',
        `/subscriptions/${subscriptionId}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Compute/virtualMachines/${encodeURIComponent(n.virtualMachine)}`,
        '2023-09-01',
        {
          location,
          tags:{ManagedBy:'Backstage',Workload:n.workload,Environment:n.environment,NetworkType:networkType},
          properties:{
            hardwareProfile:{vmSize},
            storageProfile:{
              imageReference:{publisher:'Canonical',offer:'0001-com-ubuntu-server-jammy',sku:'22_04-lts-gen2',version:'latest'},
              osDisk:{createOption:'FromImage',managedDisk:{storageAccountType:'Premium_LRS'}},
            },
            osProfile:{
              computerName:n.virtualMachine,adminUsername,
              linuxConfiguration:{
                disablePasswordAuthentication:true,
                ssh:{publicKeys:[{path:`/home/${adminUsername}/.ssh/authorized_keys`,keyData:ssh}]},
              },
            },
            networkProfile:{networkInterfaces:[{id:nicId,properties:{primary:true}}]},
          },
        },
      );

      res.json({
        message:'Linux VM deployment accepted',
        subscriptionId, networkType, resourceGroupMode:rgMode, resourceGroup,
        virtualMachineName:n.virtualMachine, networkInterfaceName:n.networkInterface,
        azure:vm.data,
      });
    } catch(e) {
      logger.error(`VM deployment failed: ${String(e)}`);
      res.status(400).json({error:String(e)});
    }
  });

  return router;
}
