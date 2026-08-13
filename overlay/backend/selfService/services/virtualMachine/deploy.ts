import { arm, ensureResourceGroup } from '../../azureClient';
import { subscriptionId } from '../../config';
import { VirtualMachineRequest } from './model';

export async function deployVirtualMachine(
  request: VirtualMachineRequest,
) {
  const sub = subscriptionId();
  await ensureResourceGroup(request.resourceGroup, request.location);

  const nicName = request.networkInterfaceName;
  const nic = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(
      request.resourceGroup,
    )}/providers/Microsoft.Network/networkInterfaces/${encodeURIComponent(
      nicName,
    )}`,
    '2023-11-01',
    {
      location: request.location,
      tags: {
        ManagedBy: 'Backstage',
        ServiceType: 'VM-NIC',
        Workload: request.workload,
        Environment: request.environment,
      },
      properties: {
        enableAcceleratedNetworking: false,
        ipConfigurations: [
          {
            name: 'ipconfig1',
            properties: {
              privateIPAllocationMethod: 'Dynamic',
              subnet: { id: request.subnetResourceId },
            },
          },
        ],
      },
    },
  );

  const nicId =
    (nic.data as { id?: string })?.id ||
    `/subscriptions/${sub}/resourceGroups/${request.resourceGroup}/providers/Microsoft.Network/networkInterfaces/${nicName}`;

  const vm = await arm(
    'PUT',
    `/subscriptions/${sub}/resourceGroups/${encodeURIComponent(
      request.resourceGroup,
    )}/providers/Microsoft.Compute/virtualMachines/${encodeURIComponent(
      request.name,
    )}`,
    '2023-09-01',
    {
      location: request.location,
      tags: {
        ManagedBy: 'Backstage',
        ServiceType: 'VirtualMachine',
        Workload: request.workload,
        Environment: request.environment,
      },
      properties: {
        hardwareProfile: { vmSize: request.vmSize },
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
          computerName: request.name,
          adminUsername: request.adminUsername,
          linuxConfiguration: {
            disablePasswordAuthentication: true,
            ssh: {
              publicKeys: [
                {
                  path: `/home/${request.adminUsername}/.ssh/authorized_keys`,
                  keyData: request.sshPublicKey,
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

  return {
    message: 'Linux VM deployment accepted',
    resourceGroup: request.resourceGroup,
    virtualMachineName: request.name,
    networkInterfaceName: request.networkInterfaceName,
    resourceId:
      `/subscriptions/${sub}/resourceGroups/${request.resourceGroup}` +
      `/providers/Microsoft.Compute/virtualMachines/${request.name}`,
    networkInterfaceId: nicId,
    azure: vm.data,
  };
}
