export interface NamingInput {
  workload: string;
  environment: string;
  location: string;
  instance: string;
}

export interface NamingPreview {
  workload: string;
  environment: string;
  environmentCode: string;
  location: string;
  regionCode: string;
  instance: string;
  resourceGroup: string;
  virtualMachine: string;
  networkInterface: string;
  storageAccount: string;
  appService: string;
  appServicePlan: string;
}
