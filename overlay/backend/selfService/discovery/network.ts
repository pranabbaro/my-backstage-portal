
import { arm } from '../azureClient';

export async function listVnets(subscriptionId: string, location: string) {
  const result = await arm(
    'GET',
    `/subscriptions/${subscriptionId}/providers/Microsoft.Network/virtualNetworks`,
    '2025-05-01',
  );
  const value = (result.data as { value?: Array<any> }).value || [];
  return value
    .filter(x => x.id && x.name && String(x.location||'').toLowerCase() === location.toLowerCase())
    .map(x => ({
      id:String(x.id), name:String(x.name), location:String(x.location),
      resourceGroup:(String(x.id).match(/\/resourceGroups\/([^/]+)/i)?.[1] || ''),
      addressPrefixes:x.properties?.addressSpace?.addressPrefixes || [],
    }))
    .sort((a,b) => a.name.localeCompare(b.name));
}

export async function listSubnets(vnetId: string) {
  if (!/^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.Network\/virtualNetworks\/[^/]+$/i.test(vnetId)) {
    throw new Error('Invalid VNet resource ID');
  }
  const result = await arm('GET', `${vnetId}/subnets`, '2025-05-01');
  const value = (result.data as { value?: Array<any> }).value || [];
  return value
    .filter(x => x.id && x.name)
    .map(x => ({
      id:String(x.id), name:String(x.name),
      addressPrefixes:x.properties?.addressPrefixes ||
        (x.properties?.addressPrefix ? [x.properties.addressPrefix] : []),
    }))
    .sort((a,b) => a.name.localeCompare(b.name));
}
