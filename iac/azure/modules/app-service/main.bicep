
param location string
param appServiceName string
param appServicePlanName string
param planSku string = 'B1'
param runtime string = 'NODE|22-lts'
param publicNetworkAccess string = 'Enabled'

var tier = planSku == 'P1v3' ? 'PremiumV3' : 'Basic'

resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: planSku
    tier: tier
    size: planSku
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2025-03-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: publicNetworkAccess
    siteConfig: {
      linuxFxVersion: runtime
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

output resourceId string = app.id
