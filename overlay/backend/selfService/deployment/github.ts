
import { githubIaCConfig } from './config';
import {
  DispatchedDeployment,
  IaCDeploymentRequest,
} from './model';

export async function dispatchGitHubDeployment(
  request: IaCDeploymentRequest,
): Promise<DispatchedDeployment> {
  const config = githubIaCConfig();

  const url =
    `${config.apiUrl}/repos/` +
    `${encodeURIComponent(config.owner)}/` +
    `${encodeURIComponent(config.repo)}/actions/workflows/` +
    `${encodeURIComponent(config.workflow)}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: config.ref,
      inputs: {
        request_json: JSON.stringify(request),
      },
    }),
  });

  const text = await response.text();
  let data: {
    workflow_run_id?: number;
    html_url?: string;
    message?: string;
  } = {};

  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new Error(
      `GitHub workflow dispatch failed (${response.status}): ${
        data.message || text || response.statusText
      }`,
    );
  }

  return {
    provider: 'github',
    status: 'accepted',
    repository: `${config.owner}/${config.repo}`,
    workflow: config.workflow,
    ref: config.ref,
    workflowRunId: data.workflow_run_id,
    workflowRunUrl: data.html_url,
  };
}
