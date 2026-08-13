import { allowedLocations, subscriptionId } from './config';

export function validateLocation(location: string): string {
  const value = String(location || '').trim().toLowerCase();

  if (!allowedLocations().includes(value)) {
    throw new Error(
      `Location '${value}' is not allowed. Allowed: ${allowedLocations().join(', ')}`,
    );
  }

  return value;
}

export function validateResourceGroup(name: string): string {
  const value = String(name || '').trim();

  if (!/^[a-zA-Z0-9._()-]{1,90}$/.test(value)) {
    throw new Error('Invalid resource group name');
  }

  return value;
}

export function validateSimpleName(
  name: string,
  label: string,
  max = 64,
): string {
  const value = String(name || '').trim();

  if (!new RegExp(`^[a-zA-Z0-9-]{2,${max}}$`).test(value)) {
    throw new Error(
      `${label} must contain only letters, numbers and hyphens`,
    );
  }

  return value;
}

export function validateSubnetId(value: string): string {
  const subnet = String(value || '').trim();
  const normalized = subnet.toLowerCase();
  const sub = subscriptionId().toLowerCase();

  if (
    !normalized.startsWith(`/subscriptions/${sub}/resourcegroups/`) ||
    !normalized.includes('/providers/microsoft.network/virtualnetworks/') ||
    !normalized.includes('/subnets/')
  ) {
    throw new Error(
      'Subnet Resource ID must be a subnet in the configured Azure subscription',
    );
  }

  return subnet;
}
