
export type DeploymentProviderName = 'direct-arm' | 'github';

export type IaCServiceType =
  | 'virtual-machine'
  | 'storage-account'
  | 'app-service'
  | 'key-vault';

export type IaCDeploymentRequest = {
  serviceType: IaCServiceType;
  subscriptionId: string;
  resourceGroupMode: 'existing' | 'new';
  resourceGroup: string;
  location: string;
  workload: string;
  environment: string;
  instance: string;
  parameters: Record<string, unknown>;
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
