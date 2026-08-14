
import { DeploymentProviderName } from './model';

export function deploymentProvider(): DeploymentProviderName {
  const value = String(
    process.env.SELF_SERVICE_DEPLOYMENT_PROVIDER || 'direct-arm',
  )
    .trim()
    .toLowerCase();

  if (value !== 'direct-arm' && value !== 'github') {
    throw new Error(
      `Unsupported SELF_SERVICE_DEPLOYMENT_PROVIDER '${value}'`,
    );
  }

  return value;
}

export function githubIaCConfig() {
  const owner = process.env.GITHUB_IAC_OWNER?.trim();
  const repo = process.env.GITHUB_IAC_REPO?.trim();
  const workflow =
    process.env.GITHUB_IAC_WORKFLOW?.trim() ||
    'deploy-approved-resource.yml';
  const ref = process.env.GITHUB_IAC_REF?.trim() || 'main';
  const token = process.env.GITHUB_IAC_TOKEN?.trim();
  const apiUrl = (
    process.env.GITHUB_API_URL?.trim() ||
    'https://api.github.com'
  ).replace(/\/$/, '');

  if (!owner || !repo || !token) {
    throw new Error(
      'GitHub IaC provider requires GITHUB_IAC_OWNER, GITHUB_IAC_REPO and GITHUB_IAC_TOKEN',
    );
  }

  return {
    owner,
    repo,
    workflow,
    ref,
    token,
    apiUrl,
  };
}
