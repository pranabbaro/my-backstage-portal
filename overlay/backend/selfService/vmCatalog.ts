
import { arm } from './azureClient';

export const APPROVED_VM_SIZES = [
  'Standard_B2s',
  'Standard_D2s_v5',
  'Standard_D4s_v5',
] as const;

export type ApprovedVmSize = (typeof APPROVED_VM_SIZES)[number];

export type VmSizeOption = {
  name: string;
  vcpus: number | null;
  memoryGB: number | null;
  premiumIO: boolean | null;
  hourlyPrice: number | null;
  monthlyPrice: number | null;
  currencyCode: string;
  priceSource: 'Azure Retail Prices' | 'Unavailable';
};

type CacheEntry = {
  expiresAt: number;
  value: VmSizeOption[];
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map<string, CacheEntry>();

function cacheKey(subscriptionId: string, location: string) {
  return `${subscriptionId.toLowerCase()}::${location.toLowerCase()}`;
}

function emptyCatalog(): VmSizeOption[] {
  return APPROVED_VM_SIZES.map(name => ({
    name,
    vcpus: null,
    memoryGB: null,
    premiumIO: null,
    hourlyPrice: null,
    monthlyPrice: null,
    currencyCode: 'INR',
    priceSource: 'Unavailable',
  }));
}

function capability(
  capabilities: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string | undefined {
  return capabilities?.find(
    item => String(item.name || '').toLowerCase() === name.toLowerCase(),
  )?.value;
}

async function retailPrice(
  armSkuName: string,
  location: string,
): Promise<number | null> {
  try {
    const filter = [
      `armRegionName eq '${location}'`,
      `armSkuName eq '${armSkuName}'`,
      `priceType eq 'Consumption'`,
      `serviceName eq 'Virtual Machines'`,
    ].join(' and ');

    const url =
      'https://prices.azure.com/api/retail/prices' +
      `?currencyCode='INR'&$filter=${encodeURIComponent(filter)}`;

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      Items?: Array<{
        retailPrice?: number;
        unitPrice?: number;
        meterName?: string;
        productName?: string;
      }>;
    };

    const items = data.Items || [];

    const linuxConsumption = items.find(item => {
      const meter = String(item.meterName || '').toLowerCase();
      const product = String(item.productName || '').toLowerCase();

      return (
        !meter.includes('spot') &&
        !meter.includes('low priority') &&
        !product.includes('windows')
      );
    });

    const price =
      linuxConsumption?.retailPrice ??
      linuxConsumption?.unitPrice ??
      null;

    return typeof price === 'number' ? price : null;
  } catch {
    return null;
  }
}

async function loadCatalog(
  subscriptionId: string,
  location: string,
): Promise<VmSizeOption[]> {
  const result = await arm(
    'GET',
    `/subscriptions/${subscriptionId}/providers/Microsoft.Compute/skus`,
    '2021-07-01',
  );

  const value =
    (result.data as {
      value?: Array<{
        name?: string;
        resourceType?: string;
        locations?: string[];
        capabilities?: Array<{
          name?: string;
          value?: string;
        }>;
        restrictions?: unknown[];
      }>;
    }).value || [];

  const matching = new Map<
    string,
    {
      capabilities?: Array<{
        name?: string;
        value?: string;
      }>;
    }
  >();

  for (const sku of value) {
    if (
      sku.resourceType !== 'virtualMachines' ||
      !sku.name ||
      !APPROVED_VM_SIZES.includes(sku.name as ApprovedVmSize)
    ) {
      continue;
    }

    const availableInRegion =
      !sku.locations ||
      sku.locations.some(
        item => item.toLowerCase() === location.toLowerCase(),
      );

    if (availableInRegion) {
      matching.set(sku.name, {
        capabilities: sku.capabilities,
      });
    }
  }

  return Promise.all(
    APPROVED_VM_SIZES.map(
      async (name): Promise<VmSizeOption> => {
        const sku = matching.get(name);
        const caps = sku?.capabilities;

        const vcpusRaw = capability(caps, 'vCPUs');
        const memoryRaw = capability(caps, 'MemoryGB');
        const premiumRaw = capability(caps, 'PremiumIO');

        const price = await retailPrice(name, location);

        return {
          name,
          vcpus:
            vcpusRaw && !Number.isNaN(Number(vcpusRaw))
              ? Number(vcpusRaw)
              : null,
          memoryGB:
            memoryRaw && !Number.isNaN(Number(memoryRaw))
              ? Number(memoryRaw)
              : null,
          premiumIO:
            premiumRaw === undefined
              ? null
              : premiumRaw.toLowerCase() === 'true',
          hourlyPrice: price,
          monthlyPrice:
            price === null ? null : Number((price * 730).toFixed(2)),
          currencyCode: 'INR',
          priceSource:
            price === null
              ? 'Unavailable'
              : 'Azure Retail Prices',
        };
      },
    ),
  );
}

export function approvedVmSizeNames(): string[] {
  return [...APPROVED_VM_SIZES];
}

export async function listApprovedVmSizes(
  subscriptionId: string,
  location: string,
): Promise<VmSizeOption[]> {
  const key = cacheKey(subscriptionId, location);
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const value = await loadCatalog(subscriptionId, location);

    cache.set(key, {
      expiresAt: now + CACHE_TTL_MS,
      value,
    });

    return value;
  } catch {
    // SKU metadata/pricing must never block the form or deployment.
    const fallback = emptyCatalog();

    cache.set(key, {
      expiresAt: now + 5 * 60 * 1000,
      value: fallback,
    });

    return fallback;
  }
}

export async function assertApprovedVmSize(
  subscriptionId: string,
  location: string,
  name: string,
): Promise<void> {
  if (!APPROVED_VM_SIZES.includes(name as ApprovedVmSize)) {
    throw new Error(`VM size '${name}' is not approved`);
  }

  // Do not force a pricing/SKU lookup before deployment.
  // The approved allow-list is the deployment authorization control.
  void subscriptionId;
  void location;
}
