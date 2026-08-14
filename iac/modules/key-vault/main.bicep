
param location string
param keyVaultName string
param tenantId string
param sku string = 'standard'
param softDeleteRetentionInDays int = 90
param purgeProtection bool = true
param networkMode string = 'public'
param trustedServicesBypass bool = true
param subnetResourceId string = ''
param vnetId string = ''
param privateEndpointName string = ''
param privateConnectionName string = ''
param privateDnsLinkName string = ''

var isServiceEndpoint = networkMode == 'service-endpoint'
var isPrivateEndpoint = networkMode == 'private-endpoint'
var privateDnsZoneName = 'privatelink.vaultcore.azure.net'

resource vault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: sku
    }
    accessPolicies: []
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteRetentionInDays
    enablePurgeProtection: purgeProtection
    publicNetworkAccess: isPrivateEndpoint ? 'Disabled' : 'Enabled'
    networkAcls: {
      bypass: trustedServicesBypass ? 'AzureServices' : 'None'
      defaultAction: networkMode == 'public' ? 'Allow' : 'Deny'
      ipRules: []
      virtualNetworkRules: isServiceEndpoint ? [
        {
          id: subnetResourceId
          ignoreMissingVnetServiceEndpoint: false
        }
      ] : []
    }
  }
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2018-09-01' = if (isPrivateEndpoint) {
  name: privateDnsZoneName
  location: 'global'
}

resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2018-09-01' = if (isPrivateEndpoint) {
  parent: privateDnsZone
  name: privateDnsLinkName
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2025-05-01' = if (isPrivateEndpoint) {
  name: privateEndpointName
  location: location
  properties: {
    subnet: {
      id: subnetResourceId
    }
    privateLinkServiceConnections: [
      {
        name: privateConnectionName
        properties: {
          privateLinkServiceId: vault.id
          groupIds: [
            'vault'
          ]
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2025-05-01' = if (isPrivateEndpoint) {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'keyvault'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}

output resourceId string = vault.id
