
import { arm } from '../azureClient';

const NETWORK_API = '2025-05-01';
const PRIVATE_DNS_API = '2018-09-01';
export const KEY_VAULT_PRIVATE_DNS_ZONE =
  'privatelink.vaultcore.azure.net';

type SubnetProperties = {
  addressPrefix?: string;
  addressPrefixes?: string[];
  networkSecurityGroup?: { id: string };
  routeTable?: { id: string };
  natGateway?: { id: string };
  delegations?: Array<Record<string, unknown>>;
  serviceEndpoints?: Array<{
    service?: string;
    locations?: string[];
  }>;
  serviceEndpointPolicies?: Array<{ id: string }>;
  privateEndpointNetworkPolicies?: string;
  privateLinkServiceNetworkPolicies?: string;
};

function validateSubnetId(subnetId: string) {
  const match = subnetId.match(
    /^\/subscriptions\/([^/]+)\/resourceGroups\/([^/]+)\/providers\/Microsoft\.Network\/virtualNetworks\/([^/]+)\/subnets\/([^/]+)$/i,
  );

  if (!match) {
    throw new Error('Invalid subnet resource ID');
  }

  return {
    subscriptionId: match[1],
    resourceGroup: match[2],
    vnetName: match[3],
    subnetName: match[4],
    vnetId:
      `/subscriptions/${match[1]}` +
      `/resourceGroups/${match[2]}` +
      `/providers/Microsoft.Network/virtualNetworks/${match[3]}`,
  };
}

async function getSubnet(subnetId: string) {
  const result = await arm('GET', subnetId, NETWORK_API);

  return result.data as {
    id?: string;
    properties?: SubnetProperties;
  };
}

function writableSubnetProperties(
  properties: SubnetProperties | undefined,
) {
  const p = properties || {};

  return {
    ...(p.addressPrefix
      ? { addressPrefix: p.addressPrefix }
      : {}),
    ...(p.addressPrefixes
      ? { addressPrefixes: p.addressPrefixes }
      : {}),
    ...(p.networkSecurityGroup
      ? { networkSecurityGroup: p.networkSecurityGroup }
      : {}),
    ...(p.routeTable ? { routeTable: p.routeTable } : {}),
    ...(p.natGateway ? { natGateway: p.natGateway } : {}),
    ...(p.delegations ? { delegations: p.delegations } : {}),
    ...(p.serviceEndpointPolicies
      ? { serviceEndpointPolicies: p.serviceEndpointPolicies }
      : {}),
    ...(p.privateEndpointNetworkPolicies
      ? {
          privateEndpointNetworkPolicies:
            p.privateEndpointNetworkPolicies,
        }
      : {}),
    ...(p.privateLinkServiceNetworkPolicies
      ? {
          privateLinkServiceNetworkPolicies:
            p.privateLinkServiceNetworkPolicies,
        }
      : {}),
  };
}

export async function enableKeyVaultServiceEndpoint(
  subnetId: string,
) {
  validateSubnetId(subnetId);
  const subnet = await getSubnet(subnetId);
  const current = subnet.properties?.serviceEndpoints || [];

  const alreadyPresent = current.some(
    endpoint =>
      String(endpoint.service || '').toLowerCase() ===
      'microsoft.keyvault',
  );

  if (alreadyPresent) {
    return;
  }

  await arm('PUT', subnetId, NETWORK_API, {
    properties: {
      ...writableSubnetProperties(subnet.properties),
      serviceEndpoints: [
        ...current.map(item => ({
          service: item.service,
          ...(item.locations
            ? { locations: item.locations }
            : {}),
        })),
        {
          service: 'Microsoft.KeyVault',
        },
      ],
    },
  });
}

export async function preparePrivateEndpointSubnet(
  subnetId: string,
) {
  validateSubnetId(subnetId);
  const subnet = await getSubnet(subnetId);

  await arm('PUT', subnetId, NETWORK_API, {
    properties: {
      ...writableSubnetProperties(subnet.properties),
      serviceEndpoints:
        subnet.properties?.serviceEndpoints || [],
      privateEndpointNetworkPolicies: 'Disabled',
    },
  });
}

export async function configureKeyVaultPrivateEndpoint(args: {
  subscriptionId: string;
  resourceGroup: string;
  location: string;
  subnetId: string;
  vnetId: string;
  vaultResourceId: string;
  privateEndpointName: string;
  connectionName: string;
  dnsLinkName: string;
}) {
  const subnet = validateSubnetId(args.subnetId);

  if (
    subnet.subscriptionId.toLowerCase() !==
    args.subscriptionId.toLowerCase()
  ) {
    throw new Error(
      'Private Endpoint subnet must be in the resolved target subscription',
    );
  }

  if (
    subnet.vnetId.toLowerCase() !== args.vnetId.toLowerCase()
  ) {
    throw new Error(
      'Selected subnet does not belong to the selected VNet',
    );
  }

  await preparePrivateEndpointSubnet(args.subnetId);

  const privateEndpointId =
    `/subscriptions/${args.subscriptionId}` +
    `/resourceGroups/${args.resourceGroup}` +
    `/providers/Microsoft.Network/privateEndpoints/` +
    `${args.privateEndpointName}`;

  await arm('PUT', privateEndpointId, NETWORK_API, {
    location: args.location,
    properties: {
      subnet: {
        id: args.subnetId,
      },
      privateLinkServiceConnections: [
        {
          name: args.connectionName,
          properties: {
            privateLinkServiceId: args.vaultResourceId,
            groupIds: ['vault'],
          },
        },
      ],
    },
  });

  const privateDnsZoneId =
    `/subscriptions/${args.subscriptionId}` +
    `/resourceGroups/${args.resourceGroup}` +
    `/providers/Microsoft.Network/privateDnsZones/` +
    KEY_VAULT_PRIVATE_DNS_ZONE;

  await arm(
    'PUT',
    privateDnsZoneId,
    PRIVATE_DNS_API,
    {
      location: 'global',
    },
  );

  await arm(
    'PUT',
    `${privateDnsZoneId}/virtualNetworkLinks/${args.dnsLinkName}`,
    PRIVATE_DNS_API,
    {
      location: 'global',
      properties: {
        virtualNetwork: {
          id: args.vnetId,
        },
        registrationEnabled: false,
      },
    },
  );

  await arm(
    'PUT',
    `${privateEndpointId}/privateDnsZoneGroups/default`,
    NETWORK_API,
    {
      properties: {
        privateDnsZoneConfigs: [
          {
            name: 'keyvault',
            properties: {
              privateDnsZoneId,
            },
          },
        ],
      },
    },
  );

  return {
    privateEndpointId,
    privateDnsZoneId,
  };
}
