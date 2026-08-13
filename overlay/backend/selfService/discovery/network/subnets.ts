import { arm } from '../../azureClient';
import { subscriptionId } from '../../config';
import { SubnetOption } from './model';

type AzureSubnet = {
  id?: string;
  name?: string;
  properties?: {
    addressPrefix?: string;
    addressPrefixes?: string[];
  };
};

function validateVnetId(vnetId: string): string {
  const normalized = String(vnetId || '').trim();
  const segments = normalized.split('/').filter(Boolean);
  const configuredSubscription = subscriptionId().toLowerCase();

  const valid =
    segments.length === 8 &&
    segments[0].toLowerCase() === 'subscriptions' &&
    segments[1].toLowerCase() === configuredSubscription &&
    segments[2].toLowerCase() === 'resourcegroups' &&
    Boolean(segments[3]) &&
    segments[4].toLowerCase() === 'providers' &&
    segments[5].toLowerCase() === 'microsoft.network' &&
    segments[6].toLowerCase() === 'virtualnetworks' &&
    Boolean(segments[7]);

  if (!valid) {
    throw new Error(
      'Invalid VNet resource ID or VNet is outside the configured subscription',
    );
  }

  return normalized;
}

export async function listSubnets(
  rawVnetId: string,
): Promise<SubnetOption[]> {
  const vnetId = validateVnetId(rawVnetId);
  const result = await arm(
    'GET',
    `${vnetId}/subnets`,
    '2025-05-01',
  );

  const value =
    (result.data as { value?: AzureSubnet[] })?.value || [];

  return value
    .filter(item => item.id && item.name)
    .map(item => {
      const prefixes =
        item.properties?.addressPrefixes ||
        (item.properties?.addressPrefix
          ? [item.properties.addressPrefix]
          : []);

      return {
        id: String(item.id),
        name: String(item.name),
        addressPrefixes: prefixes,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
