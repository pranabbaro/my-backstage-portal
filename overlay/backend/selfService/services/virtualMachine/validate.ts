import { JsonRecord } from '../../types';
import {
  validateLocation,
  validateSubnetId,
} from '../../validation';
import { buildNamingPreview } from '../../naming/namingEngine';
import { VirtualMachineRequest } from './model';

const ALLOWED_VM_SIZES = [
  'Standard_B2s',
  'Standard_D2s_v5',
  'Standard_D4s_v5',
];

export function validateVirtualMachineRequest(
  input: JsonRecord,
): VirtualMachineRequest {
  const location = validateLocation(String(input.location || ''));
  const names = buildNamingPreview({
    workload: String(input.workload || ''),
    environment: String(input.environment || ''),
    location,
    instance: String(input.instance || '01'),
  });

  const vmSize = String(input.vmSize || 'Standard_B2s');
  const adminUsername = String(input.adminUsername || 'azureadmin').trim();
  const subnetResourceId = validateSubnetId(
    String(input.subnetResourceId || ''),
  );
  const sshPublicKey = String(input.sshPublicKey || '').trim();

  if (!ALLOWED_VM_SIZES.includes(vmSize)) {
    throw new Error(
      `VM size '${vmSize}' is not approved. Allowed: ${ALLOWED_VM_SIZES.join(', ')}`,
    );
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,31}$/.test(adminUsername)) {
    throw new Error('Invalid administrator username');
  }

  if (!sshPublicKey.startsWith('ssh-')) {
    throw new Error('A valid SSH public key is required');
  }

  return {
    workload: names.workload,
    environment: names.environment,
    instance: names.instance,
    resourceGroup: names.resourceGroup,
    location,
    name: names.virtualMachine,
    networkInterfaceName: names.networkInterface,
    vmSize,
    adminUsername,
    subnetResourceId,
    sshPublicKey,
  };
}
