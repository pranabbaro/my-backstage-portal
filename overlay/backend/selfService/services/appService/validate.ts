import { JsonRecord } from '../../types';
import {
  validateLocation,
  validateResourceGroup,
  validateSimpleName,
} from '../../validation';
import { AppServiceRequest } from './model';

const ALLOWED_SKUS = ['B1'];

export function validateAppServiceRequest(
  input: JsonRecord,
): AppServiceRequest {
  const name = validateSimpleName(
    String(input.name || ''),
    'App Service name',
    60,
  ).toLowerCase();

  const request: AppServiceRequest = {
    resourceGroup: validateResourceGroup(
      String(input.resourceGroup || ''),
    ),
    location: validateLocation(String(input.location || '')),
    name,
    planName: validateSimpleName(
      String(input.planName || `${name}-plan`),
      'App Service plan name',
      40,
    ),
    sku: String(input.sku || 'B1'),
  };

  if (!ALLOWED_SKUS.includes(request.sku)) {
    throw new Error(
      `App Service SKU '${request.sku}' is not approved`,
    );
  }

  return request;
}
