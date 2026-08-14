import { arm } from './azureClient';

export const APPROVED_VM_SIZES = [
  'Standard_B2s',
  'Standard_D2s_v5',
  'Standard_D4s_v5',
] as const;

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

type ResourceSku = {
  name?: string;
  resourceType?: string;
  locations?: string[];
  capabilities?: Array<{
    name?: string;
    value?: string;
  }>;
  restrictions?: Array<{
    type?: string;
    reasonCode?: string;
    restrictionInfo?: {
      locations?: string[];
    };
  }>;
};

function capability(
  sku: ResourceSku,
  name: string,
): string | undefined {
  return sku.capabilities?.find(
    item => item.name?.toLowerCase() === name.toLowerCase(),
  )?.value;
}

function isRestrictedInLocation(
  sku: ResourceSku,
  location: string,
): boolean {
  return (sku.restrictions || []).some(restriction => {
    if (restriction.type !== 'Location') return false;
    const locations =
      restriction.restrictionInfo?.locations || [];
    return locations.some(
      item => item.toLowerCase() === location.toLowerCase(),
    );
  });
}

async function retailPrice(
  sku: string,
  location: string,
): Promise<{
  hourlyPrice: number | null;
  monthlyPrice: number | null;
  currencyCode: string;
}> {
  const filter =
    `serviceName eq 'Virtual Machines' and ` +
    `armRegionName eq '${location}' and ` +
    `armSkuName eq '${sku}' and ` +
    `priceType eq 'Consumption'`;

  const url =
    'https://prices.azure.com/api/retail/prices' +
    `?currencyCode='INR'&$filter=${encodeURIComponent(filter)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        hourlyPrice: null,
        monthlyPrice: null,
        currencyCode: 'INR',
      };
    }

    const body = (await response.json()) as {
      Items?: Array<{
        armSkuName?: string;
        armRegionName?: string;
        serviceName?: string;
        productName?: string;
        meterName?: string;
        type?: string;
        unitOfMeasure?: string;
        retailPrice?: number;
        currencyCode?: string;
        isPrimaryMeterRegion?: boolean;
      }>;
    };

    const candidates = (body.Items || [])
      .filter(item => item.type === 'Consumption')
      .filter(item =>
        String(item.unitOfMeasure || '')
          .toLowerCase()
          .includes('hour'),
      )
      .filter(item =>
        !String(item.productName || '')
          .toLowerCase()
          .includes('windows'),
      )
      .filter(item => {
        const meter = String(item.meterName || '').toLowerCase();
        return (
          !meter.includes('spot') &&
          !meter.includes('low priority')
        );
      })
      .filter(item => Number(item.retailPrice || 0) > 0)
      .sort((a, b) => {
        const primaryA = a.isPrimaryMeterRegion ? 0 : 1;
        const primaryB = b.isPrimaryMeterRegion ? 0 : 1;
        if (primaryA !== primaryB) return primaryA - primaryB;
        return Number(a.retailPrice) - Number(b.retailPrice);
      });

    const selected = candidates[0];
    if (!selected || selected.retailPrice === undefined) {
      return {
        hourlyPrice: null,
        monthlyPrice: null,
        currencyCode: 'INR',
      };
    }

    const hourly = Number(selected.retailPrice);
    return {
      hourlyPrice: Number(hourly.toFixed(4)),
      monthlyPrice: Number((hourly * 730).toFixed(2)),
      currencyCode: selected.currencyCode || 'INR',
    };
  } catch {
    return {
      hourlyPrice: null,
      monthlyPrice: null,
      currencyCode: 'INR',
    };
  }
}

export async function listApprovedVmSizes(
  subscriptionId: string,
  location: string,
): Promise<VmSizeOption[]> {
  const result = await arm(
    'GET',
    `/subscriptions/${subscriptionId}/providers/Microsoft.Compute/skus`,
    '2025-04-01',
  );

  const value =
    (result.data as { value?: ResourceSku[] }).value || [];

  const skuMap = new Map(
    value
      .filter(item => item.resourceType === 'virtualMachines')
      .filter(item =>
        (item.locations || []).some(
          loc => loc.toLowerCase() === location.toLowerCase(),
        ),
      )
      .filter(item => item.name)
      .map(item => [String(item.name), item]),
  );

  const options = await Promise.all(
    APPROVED_VM_SIZES.map(async name => {
      const sku = skuMap.get(name);
      const available =
        sku && !isRestrictedInLocation(sku, location);

      if (!available || !sku) {
        return null;
      }

      const vcpusRaw = capability(sku, 'vCPUs');
      const memoryRaw = capability(sku, 'MemoryGB');
      const premiumRaw = capability(sku, 'PremiumIO');
      const price = await retailPrice(name, location);

      return {
        name,
        vcpus:
          vcpusRaw === undefined ? null : Number(vcpusRaw),
        memoryGB:
          memoryRaw === undefined ? null : Number(memoryRaw),
        premiumIO:
          premiumRaw === undefined
            ? null
            : premiumRaw.toLowerCase() === 'true',
        hourlyPrice: price.hourlyPrice,
        monthlyPrice: price.monthlyPrice,
        currencyCode: price.currencyCode,
        priceSource:
          price.hourlyPrice === null
            ? ('Unavailable' as const)
            : ('Azure Retail Prices' as const),
      };
    }),
  );

  return options.filter(
    (item): item is VmSizeOption => item !== null,
  );
}

export function assertApprovedVmSize(name: string): void {
  if (!(APPROVED_VM_SIZES as readonly string[]).includes(name)) {
    throw new Error(
      `VM size '${name}' is not approved. Allowed sizes: ${APPROVED_VM_SIZES.join(', ')}`,
    );
  }
}
