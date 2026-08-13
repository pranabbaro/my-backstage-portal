import { subscriptionId } from './config';
import { JsonRecord } from './types';

const MANAGEMENT = 'https://management.azure.com';

export async function managedIdentityToken(): Promise<string> {
  const endpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader = process.env.IDENTITY_HEADER;

  if (!endpoint || !identityHeader) {
    throw new Error(
      'Azure App Service Managed Identity is not enabled or is unavailable',
    );
  }

  const url = new URL(endpoint);
  url.searchParams.set('api-version', '2019-08-01');
  url.searchParams.set('resource', `${MANAGEMENT}/`);

  const response = await fetch(url, {
    headers: {
      'X-IDENTITY-HEADER': identityHeader,
      Metadata: 'true',
    },
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Managed Identity token request failed: ${
        data.error_description || data.error || response.statusText
      }`,
    );
  }

  return data.access_token;
}

export async function arm(
  method: string,
  path: string,
  apiVersion: string,
  body?: JsonRecord,
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const token = await managedIdentityToken();
  const separator = path.includes('?') ? '&' : '?';
  const url = `${MANAGEMENT}${path}${separator}api-version=${encodeURIComponent(
    apiVersion,
  )}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data: unknown = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data)
        : String(data);

    throw new Error(
      `Azure ARM ${method} failed (${response.status}): ${detail}`,
    );
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

export async function ensureResourceGroup(
  resourceGroup: string,
  location: string,
) {
  const sub = subscriptionId();

  return arm(
    'PUT',
    `/subscriptions/${sub}/resourcegroups/${encodeURIComponent(resourceGroup)}`,
    '2022-09-01',
    {
      location,
      tags: {
        ManagedBy: 'Backstage',
        Portal: 'EnterpriseDeveloperPortal',
      },
    },
  );
}
