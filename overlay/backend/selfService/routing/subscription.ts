
import { arm } from '../azureClient';

export type NetworkType = 'internal' | 'intranet' | 'dmz' | 'business-managed';
export type SubscriptionOption = { subscriptionId: string; displayName: string };

export async function listSubscriptions(): Promise<SubscriptionOption[]> {
  const result = await arm('GET', '/subscriptions', '2022-12-01');
  const value = (result.data as { value?: Array<{subscriptionId?: string; displayName?: string; state?: string}> }).value || [];
  return value
    .filter(x => x.subscriptionId && x.displayName && (!x.state || x.state === 'Enabled'))
    .map(x => ({ subscriptionId: String(x.subscriptionId), displayName: String(x.displayName) }))
    .sort((a,b) => a.displayName.localeCompare(b.displayName));
}

function envFor(type: Exclude<NetworkType,'business-managed'>): string {
  if (type === 'internal') return 'AZURE_SUBSCRIPTION_INTERNAL';
  if (type === 'intranet') return 'AZURE_SUBSCRIPTION_INTRANET';
  return 'AZURE_SUBSCRIPTION_DMZ';
}

export async function resolvePlatformSubscription(
  type: Exclude<NetworkType,'business-managed'>,
  location: string,
): Promise<SubscriptionOption> {
  const all = await listSubscriptions();
  const configured = process.env[envFor(type)]?.trim() || process.env.AZURE_SUBSCRIPTION_ID?.trim();

  if (configured) {
    const found = all.find(s => s.subscriptionId.toLowerCase() === configured.toLowerCase());
    if (!found) throw new Error(`Configured ${type} subscription is not accessible`);
    return found;
  }

  const regionCodes: Record<string,string[]> = {
    centralindia: ['centralindia','central-india','cin'],
    southindia: ['southindia','south-india','sin'],
    westindia: ['westindia','west-india','win'],
  };
  const networkCodes: Record<string,string[]> = {
    internal: ['internal','int'],
    intranet: ['intranet','intra'],
    dmz: ['dmz'],
  };
  const found = all.find(s => {
    const n = s.displayName.toLowerCase();
    return (networkCodes[type] || [type]).some(x => n.includes(x))
      && (regionCodes[location] || [location]).some(x => n.includes(x));
  });
  if (!found) throw new Error(`No ${type} subscription resolved for ${location}. Configure ${envFor(type)}.`);
  return found;
}

export function entitlementIds(userRef: string, ownershipRefs: string[]): Set<string> {
  const raw = process.env.AZURE_BUSINESS_SUBSCRIPTION_ENTITLEMENTS?.trim();
  if (!raw) return new Set<string>();
  let map: Record<string,string[]>;
  try { map = JSON.parse(raw); }
  catch { throw new Error('AZURE_BUSINESS_SUBSCRIPTION_ENTITLEMENTS must be valid JSON'); }

  const ids = new Set<string>();
  for (const principal of [userRef, ...ownershipRefs].map(x => x.toLowerCase())) {
    for (const id of map[principal] || []) ids.add(String(id).toLowerCase());
  }
  return ids;
}
