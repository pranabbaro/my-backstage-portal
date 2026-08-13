import { JsonRecord } from '../../types';
import {
  validateLocation,
  validateResourceGroup,
} from '../../validation';
import { StorageAccountRequest } from './model';

const ALLOWED_SKUS = [
  'Standard_LRS',
  'Standard_ZRS',
  'Standard_GRS',
];

export function validateStorageAccountRequest(
  input: JsonRecord,
): StorageAccountRequest {
  const request: StorageAccountRequest = {
    resourceGroup: validateResourceGroup(
      String(input.resourceGroup || ''),
    ),
    location: validateLocation(String(input.location || '')),
    name: String(input.name || '').trim().toLowerCase(),
    sku: String(input.sku || 'Standard_LRS'),
  };

  if (!/^[a-z0-9]{3,24}$/.test(request.name)) {
    throw new Error(
      'Storage account name must be 3-24 lowercase letters/numbers',
    );
  }

  if (!ALLOWED_SKUS.includes(request.sku)) {
    throw new Error(
      `Storage SKU '${request.sku}' is not approved`,
    );
  }

  return request;
}
