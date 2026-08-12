# Backstage Azure Self-Service V1

Direct-push overlay corrected for your actual Backstage frontend structure (`modules/nav/Sidebar.tsx`).

Adds:
- VM self-service
- Storage Account self-service
- App Service self-service
- Custom Backstage page: `/self-service`
- No Scaffolder dependency for the deployment flow
- Azure calls use App Service System Assigned Managed Identity

## One-time Azure prerequisites

On App Service `backstage-pranab-mvp`:

1. Identity -> System assigned -> On
2. Grant that identity Contributor on a TEST resource group/subscription for initial validation
3. Environment variable:
   AZURE_SUBSCRIPTION_ID=<subscription GUID>

Optional:
   AZURE_ALLOWED_LOCATIONS=centralindia,southindia,westindia

## Push

Copy the ZIP contents into your clean repo root, for example:

C:\backstage-full

Then:

```powershell
cd C:\backstage-full
git add .
git commit -m "Add Azure Self-Service VM Storage App Service"
git pull --rebase origin main
git push origin main
```

Do not run npm/yarn locally.

After the GitHub Action is green, restart the App Service once and open:

https://backstage-pranab-mvp-e9gcgmasd5abgth5.centralindia-01.azurewebsites.net/self-service

The workflow type-checks and builds BEFORE deploying, so a compile failure stops before replacing the currently working Azure package.


## V2 correction

This version no longer assumes `components/Root/Root.tsx`.

It uses your actual file:

`backstage/packages/app/src/modules/nav/Sidebar.tsx`

The page itself uses standard React HTML controls rather than Material UI form
components, which reduces version-specific frontend dependency risk.
