# Direct-Push Self-Service Cloud V1

This package is designed for the existing repository:

`pranabbaro/my-backstage-portal`

No local Node/Yarn install is required.

## What it adds

A custom Backstage frontend page:

`/self-service`

with three service cards:

- Deploy Azure VM
- Create Azure Storage Account
- Create Azure App Service

And a custom Backstage backend plugin:

- `GET /api/cloud-provisioning/health`
- `POST /api/cloud-provisioning/vm`
- `POST /api/cloud-provisioning/storage`
- `POST /api/cloud-provisioning/appservice`

This is **not Scaffolder**.

## V1 safety

The endpoints validate and normalize the request only.
They do not deploy Azure resources yet.

Because this is a validation-only MVP, the endpoints temporarily allow unauthenticated access.
Real provisioning must not be enabled until V2 adds authenticated users and permissions.

## Laptop steps

Copy the contents of this ZIP into the root of your existing:

`D:\my-backstage-portal`

Allow `.github/workflows/bootstrap-build-deploy.yml` to overwrite the existing workflow.

Do NOT run yarn/npm locally.

Only run:

```powershell
cd D:\my-backstage-portal
git add .
git commit -m "Add custom Azure Self-Service Cloud"
git pull --rebase origin main
git push origin main
```

GitHub Actions performs:
- plugin dependency wiring
- yarn install
- TypeScript check
- Backstage build
- production packaging
- Azure App Service deployment

## After the GitHub Action is green

Open:

`https://backstage-pranab-mvp-e9gcgmasd5abgth5.centralindia-01.azurewebsites.net/self-service`

The page should also be automatically discoverable by the new Backstage frontend system when `app.packages: all` is enabled.

## V2

V2 will replace validation-only behavior with:

Custom Backstage UI
→ authenticated cloud-provisioning API
→ GitHub deployment request
→ Bicep
→ GitHub Actions
→ Azure OIDC
→ Azure resource
