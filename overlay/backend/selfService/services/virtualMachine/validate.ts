import { JsonRecord } from '../../types';
import {
  validateLocation,
  validateResourceGroup,
  validateSimpleName,
  validateSubnetId,
} from '../../validation';
import { VirtualMachineRequest } from './model';

const ALLOWED_VM_SIZES = [
  'Standard_B2s',
  'Standard_D2s_v5',
  'Standard_D4s_v5',
];

export function validateVirtualMachineRequest(
  input: JsonRecord,
): VirtualMachineRequest {
  const request: VirtualMachineRequest = {
    resourceGroup: validateResourceGroup(
      String(input.resourceGroup || ''),
    ),
    location: validateLocation(String(input.location || '')),
    name: validateSimpleName(String(input.name || ''), 'VM name', 15),
    vmSize: String(input.vmSize || 'Standard_B2s'),
    adminUsername: String(
      input.adminUsername || 'azureadmin',
    ).trim(),
    subnetResourceId: validateSubnetId(
      String(input.subnetResourceId || ''),
    ),
    sshPublicKey: String(input.sshPublicKey || '').trim(),
  };

  if (!ALLOWED_VM_SIZES.includes(request.vmSize)) {
    throw new Error(
      `VM size '${request.vmSize}' is not approved. Allowed: ${ALLOWED_VM_SIZES.join(
        ', ',
      )}`,
    );
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,31}$/.test(request.adminUsername)) {
    throw new Error('Invalid administrator username');
  }

  if (!request.sshPublicKey.startsWith('ssh-')) {
    throw new Error('A valid SSH public key is required');
  }

  return request;
}
