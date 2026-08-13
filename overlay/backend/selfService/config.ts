
const DEFAULT_LOCATIONS=['centralindia','southindia','westindia'];

export function allowedLocations():string[] {
  const raw=process.env.AZURE_ALLOWED_LOCATIONS?.trim();
  return raw ? raw.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean) : DEFAULT_LOCATIONS;
}

export function platformStatus() {
  return {
    managedIdentity:Boolean(process.env.IDENTITY_ENDPOINT && process.env.IDENTITY_HEADER),
    subscriptionRoutingConfigured:Boolean(
      process.env.AZURE_SUBSCRIPTION_INTERNAL ||
      process.env.AZURE_SUBSCRIPTION_INTRANET ||
      process.env.AZURE_SUBSCRIPTION_DMZ ||
      process.env.AZURE_SUBSCRIPTION_ID
    ),
    allowedLocations:allowedLocations(),
  };
}
