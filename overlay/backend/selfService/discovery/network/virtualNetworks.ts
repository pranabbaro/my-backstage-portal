import { arm } from '../../azureClient';
import { subscriptionId } from '../../config';
import { VirtualNetworkOption } from './model';

type AzureVirtualNetwork = {
  id?: string;
  name?: string;
  location?: string;
  properties?: {
    addressSpace?: {
      addressPrefixes?: string[];
    };
  };
};

function resourceGroupFromId(id: string): string {
  const match = id.match(/\/resourceGroups\/([^/]+)/i);
  return match?.[1] || '';
}

export async function listVirtualNetworks(
  location: string,
): Promise<VirtualNetworkOption[]> {
  const sub = subscriptionId();
  const result = await arm(
    'GET',
    `/subscriptions/${sub}/providers/Microsoft.Network/virtualNetworks`,
    '2025-05-01',
  );

  const value =
    (result.data as { value?: AzureVirtualNetwork[] })?.value || [];

  return value
    .filter(
      item =>
        item.id &&
        item.name &&
        String(item.location || '').toLowerCase() === location.toLowerCase(),
    )
    .map(item => ({
      id: String(item.id),
      name: String(item.name),
      location: String(item.location),
      resourceGroup: resourceGroupFromId(String(item.id)),
      addressPrefixes:
        item.properties?.addressSpace?.addressPrefixes || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
