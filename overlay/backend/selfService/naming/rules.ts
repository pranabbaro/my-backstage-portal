export const REGION_CODES: Record<string, string> = {
  centralindia: 'cin',
  southindia: 'sin',
  westindia: 'win',
};

export const ENVIRONMENT_CODES: Record<string, string> = {
  development: 'dev',
  test: 'tst',
  staging: 'stg',
  production: 'prd',
};

export const NAMING_PREFIXES = {
  resourceGroup: 'rg',
  virtualMachine: 'vm',
  networkInterface: 'nic',
  storageAccount: 'st',
  appService: 'app',
  appServicePlan: 'asp',
} as const;
