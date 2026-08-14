
import { deploymentProvider } from './config';
import { dispatchGitHubDeployment } from './github';
import {
  DispatchedDeployment,
  IaCDeploymentRequest,
} from './model';

export function currentDeploymentProvider() {
  return deploymentProvider();
}

export async function dispatchIaCIfConfigured(
  request: IaCDeploymentRequest,
): Promise<DispatchedDeployment | null> {
  const provider = deploymentProvider();

  if (provider === 'direct-arm') {
    return null;
  }

  return dispatchGitHubDeployment(request);
}
