
param location string
param storageAccountName string
param redundancy string = 'Standard_LRS'
param accessTier string = 'Hot'
param publicNetworkAccess string = 'Enabled'

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: redundancy
  }
  properties: {
    accessTier: accessTier
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: publicNetworkAccess
  }
}

output resourceId string = storage.id
