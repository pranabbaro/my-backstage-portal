import {
  ENVIRONMENT_CODES,
  NAMING_PREFIXES,
  REGION_CODES,
} from './rules';
import { NamingInput, NamingPreview } from './model';

function sanitizeWorkload(value: string): string {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!cleaned || cleaned.length < 2) {
    throw new Error(
      'Workload/Application name must contain at least 2 letters or numbers',
    );
  }

  return cleaned.slice(0, 20);
}

function normalizeInstance(value: string): string {
  const digits = String(value || '').replace(/[^0-9]/g, '');

  if (!digits) {
    return '01';
  }

  const numeric = Number(digits);

  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 999) {
    throw new Error('Instance must be between 1 and 999');
  }

  return String(numeric).padStart(2, '0');
}

export function buildNamingPreview(
  input: NamingInput,
): NamingPreview {
  const workload = sanitizeWorkload(input.workload);
  const environment = String(input.environment || '')
    .trim()
    .toLowerCase();
  const location = String(input.location || '')
    .trim()
    .toLowerCase();
  const environmentCode = ENVIRONMENT_CODES[environment];
  const regionCode = REGION_CODES[location];
  const instance = normalizeInstance(input.instance);

  if (!environmentCode) {
    throw new Error(
      `Unsupported environment '${environment}'. Supported: ${Object.keys(
        ENVIRONMENT_CODES,
      ).join(', ')}`,
    );
  }

  if (!regionCode) {
    throw new Error(
      `No naming code is configured for Azure region '${location}'`,
    );
  }

  const suffix = `${workload}-${environmentCode}-${regionCode}-${instance}`;
  const resourceGroup = `${NAMING_PREFIXES.resourceGroup}-${workload}-${environmentCode}-${regionCode}`;
  const virtualMachine = `${NAMING_PREFIXES.virtualMachine}-${suffix}`.slice(0, 64);
  const networkInterface = `${NAMING_PREFIXES.networkInterface}-${suffix}`.slice(0, 80);
  const storageAccount = `${NAMING_PREFIXES.storageAccount}${workload}${environmentCode}${regionCode}${instance}`
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
  const appService = `${NAMING_PREFIXES.appService}-${suffix}`.slice(0, 60);
  const appServicePlan = `${NAMING_PREFIXES.appServicePlan}-${workload}-${environmentCode}-${regionCode}`.slice(0, 40);

  return {
    workload,
    environment,
    environmentCode,
    location,
    regionCode,
    instance,
    resourceGroup,
    virtualMachine,
    networkInterface,
    storageAccount,
    appService,
    appServicePlan,
  };
}
