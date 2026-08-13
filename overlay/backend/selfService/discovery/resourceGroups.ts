
import { arm } from '../azureClient';

export async function listResourceGroups(subscriptionId: string, location?: string) {
  const result = await arm(
    'GET',
    `/subscriptions/${subscriptionId}/resourcegroups`,
    '2021-04-01',
  );
  const value = (result.data as { value?: Array<{id?:string;name?:string;location?:string}> }).value || [];
  return value
    .filter(x => x.id && x.name && x.location)
    .filter(x => !location || String(x.location).toLowerCase() === location.toLowerCase())
    .map(x => ({ id:String(x.id), name:String(x.name), location:String(x.location) }))
    .sort((a,b) => a.name.localeCompare(b.name));
}
