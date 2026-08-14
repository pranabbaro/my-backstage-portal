import { listResourceGroups } from './discovery/resourceGroups';

export type AccessibleResourceGroup = {
  id: string;
  name: string;
  location: string;
};

type EntitlementMap = Record<string, string[]>;

function entitlementMap(): EntitlementMap {
  const raw = process.env.AZURE_EXISTING_RG_ENTITLEMENTS?.trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as EntitlementMap;
  } catch {
    throw new Error(
      'AZURE_EXISTING_RG_ENTITLEMENTS must be valid JSON',
    );
  }
}

function entitlementPatterns(
  userEntityRef: string,
  ownershipEntityRefs: string[],
): string[] {
  const map = entitlementMap();
  const result = new Set<string>();

  for (const principal of [
    userEntityRef,
    ...ownershipEntityRefs,
  ].map(value => value.toLowerCase())) {
    for (const pattern of map[principal] || []) {
      result.add(String(pattern).toLowerCase());
    }
  }

  return [...result];
}

function entitlementAllows(
  patterns: string[],
  subscriptionId: string,
  resourceGroup: string,
): boolean {
  const sub = subscriptionId.toLowerCase();
  const rg = resourceGroup.toLowerCase();

  return patterns.some(pattern => {
    if (pattern === '*') return true;
    if (pattern === rg) return true;
    if (pattern === `${sub}/${rg}`) return true;
    if (pattern === `${sub}/*`) return true;
    return false;
  });
}

async function userHasAzureAccessToRg(
  userToken: string,
  subscriptionId: string,
  resourceGroup: string,
): Promise<boolean> {
  const path =
    `/subscriptions/${subscriptionId}` +
    `/resourceGroups/${encodeURIComponent(resourceGroup)}` +
    '/providers/Microsoft.Authorization/permissions';

  const separator = path.includes('?') ? '&' : '?';
  const url =
    `https://management.azure.com${path}` +
    `${separator}api-version=2022-04-01`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Azure user-access check failed for '${resourceGroup}' (${response.status}): ${text}`,
    );
  }

  const body = (await response.json()) as {
    value?: Array<{
      actions?: string[];
      dataActions?: string[];
    }>;
  };

  return (body.value || []).some(permission =>
    Boolean(
      (permission.actions && permission.actions.length > 0) ||
        (permission.dataActions && permission.dataActions.length > 0),
    ),
  );
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let index = 0;

  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= values.length) return;
      results[current] = await fn(values[current]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length || 1) },
      () => worker(),
    ),
  );

  return results;
}

export async function listUserAccessibleResourceGroups(args: {
  subscriptionId: string;
  location?: string;
  userEntityRef: string;
  ownershipEntityRefs: string[];
  azureUserToken?: string;
}): Promise<{
  mode: 'azure-rbac' | 'entitlement-map' | 'none';
  value: AccessibleResourceGroup[];
}> {
  // Managed Identity lists candidate RGs. This does NOT grant the end user
  // deployment rights; it only provides candidates for visibility filtering.
  const all = await listResourceGroups(
    args.subscriptionId,
    args.location,
  );

  if (args.azureUserToken) {
    const checked = await mapWithConcurrency(
      all,
      8,
      async rg => ({
        rg,
        allowed: await userHasAzureAccessToRg(
          args.azureUserToken as string,
          args.subscriptionId,
          rg.name,
        ),
      }),
    );

    return {
      mode: 'azure-rbac',
      value: checked
        .filter(item => item.allowed)
        .map(item => item.rg),
    };
  }

  // Safe fallback for environments where Microsoft delegated auth has not yet
  // been configured. No mapping means no existing RGs are exposed.
  const patterns = entitlementPatterns(
    args.userEntityRef,
    args.ownershipEntityRefs,
  );

  if (patterns.length === 0) {
    return { mode: 'none', value: [] };
  }

  return {
    mode: 'entitlement-map',
    value: all.filter(rg =>
      entitlementAllows(
        patterns,
        args.subscriptionId,
        rg.name,
      ),
    ),
  };
}

export async function assertUserCanSelectExistingRg(args: {
  subscriptionId: string;
  resourceGroup: string;
  location?: string;
  userEntityRef: string;
  ownershipEntityRefs: string[];
  azureUserToken?: string;
}): Promise<void> {
  const accessible = await listUserAccessibleResourceGroups({
    subscriptionId: args.subscriptionId,
    location: args.location,
    userEntityRef: args.userEntityRef,
    ownershipEntityRefs: args.ownershipEntityRefs,
    azureUserToken: args.azureUserToken,
  });

  if (
    !accessible.value.some(
      rg =>
        rg.name.toLowerCase() ===
        args.resourceGroup.toLowerCase(),
    )
  ) {
    throw new Error(
      'The signed-in user does not have access to the selected existing Resource Group',
    );
  }
}
