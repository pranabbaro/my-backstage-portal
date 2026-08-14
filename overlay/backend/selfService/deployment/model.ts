
export type DeploymentProviderName = 'direct-arm' | 'github';

export type TargetPlatform =
  | 'azure'
  | 'aws'
  | 'gcp'
  | 'azure-local'
  | 'hyperv';

export type IaCServiceType =
  | 'virtual-machine'
  | 'storage-account'
  | 'app-service'
  | 'key-vault';

export type IaCDeploymentRequest = {
  platform: TargetPlatform;
  serviceType: IaCServiceType | string;
  environment: string;
  location: string;
  workload: string;
  instance: string;
  target: Record<string, unknown>;
  parameters: Record<string, unknown>;
  subscriptionId?: string;
  resourceGroupMode?: 'existing' | 'new';
  resourceGroup?: string;
};

export type DispatchedDeployment = {
  provider: 'github';
  status: 'accepted';
  repository: string;
  workflow: string;
  ref: string;
  workflowRunId?: number;
  workflowRunUrl?: string;
};
