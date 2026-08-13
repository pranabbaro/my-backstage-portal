const DEFAULT_LOCATIONS = ['centralindia', 'southindia', 'westindia'];

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required App Service setting: ${name}`);
  }
  return value;
}

export function subscriptionId(): string {
  return requiredEnv('AZURE_SUBSCRIPTION_ID');
}

export function allowedLocations(): string[] {
  const configured = process.env.AZURE_ALLOWED_LOCATIONS?.trim();

  if (!configured) {
    return DEFAULT_LOCATIONS;
  }

  return configured
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export function platformStatus() {
  return {
    managedIdentity: Boolean(
      process.env.IDENTITY_ENDPOINT && process.env.IDENTITY_HEADER,
    ),
    subscriptionConfigured: Boolean(process.env.AZURE_SUBSCRIPTION_ID),
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID
      ? `${process.env.AZURE_SUBSCRIPTION_ID.slice(0, 8)}...`
      : '',
    allowedLocations: allowedLocations(),
  };
}
