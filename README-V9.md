# Backstage Self-Service V9

V9 preserves the existing V8 subscription-routing behavior and adds two features:

1. Existing Resource Groups are filtered for the signed-in user.
2. VM Size shows live vCPU, RAM and estimated Azure retail compute cost.

## Subscription routing is unchanged

- Internal -> automatically resolved subscription
- Intranet -> automatically resolved subscription
- DMZ -> automatically resolved subscription
- Business Managed -> only subscriptions assigned to the Backstage user/group

## Resource Group behavior

### Create new

There is NO end-user Resource Group access restriction.

The naming engine generates the RG name and the App Service Managed Identity creates it.

### Use existing

The App Service Managed Identity first gets the candidate RG list in the resolved subscription.
The portal then filters those candidates for the signed-in user.

Preferred mode: Azure RBAC
- The frontend requests a short-lived Microsoft OAuth access token with scope:
  https://management.azure.com/user_impersonation
- The token is used only to call Microsoft.Authorization/permissions for each candidate RG.
- It is never used to deploy the VM.
- The deployment remains Managed Identity only.
- The selected RG is checked again at submit time.

Safe fallback mode: explicit Backstage entitlement map

If Microsoft delegated auth is not configured, set an App Service environment variable such as:

AZURE_EXISTING_RG_ENTITLEMENTS={"user:default/alice":["<subscription-guid>/rg-app-dev","rg-shared"],"group:default/finance":["<subscription-guid>/*"]}

If there is no delegated Azure token and no entitlement for the signed-in user/group, the Existing RG dropdown is empty and deployment is disabled in Existing mode.

## Microsoft auth prerequisite for live Azure-RBAC filtering

The Backstage Microsoft authentication provider must be configured and the Backstage Entra app registration must have the Azure Service Management delegated permission `user_impersonation`.

The token requested by the page is used ONLY for RG visibility/access checks. Managed Identity continues to create all Azure resources.

## VM size and cost

V9 calls Azure Compute Resource SKUs for the resolved subscription/region and extracts:

- vCPU (`vCPUs` capability)
- RAM (`MemoryGB` capability)
- Premium IO capability

Approved VM sizes remain:

- Standard_B2s
- Standard_D2s_v5
- Standard_D4s_v5

V9 also queries the unauthenticated Azure Retail Prices API in INR and shows:

- estimated hourly Linux compute retail price
- estimated monthly Linux compute retail price (`hourly x 730`)

The estimate excludes disks, backup, bandwidth, taxes, reservations, savings plans and negotiated enterprise discounts.

## Push

Extract the ZIP into the existing repository root and replace files, then:

```powershell
cd C:\backstage-full
git add .
git commit -m "Add user-filtered RGs and VM size cost details"
git pull --rebase origin main
git push origin main
```
