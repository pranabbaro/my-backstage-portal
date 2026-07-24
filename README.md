# Backstage App Service Ready Pack

This pack is designed for the existing repository:

`pranabbaro/my-backstage-portal`

It does **not** regenerate Backstage. It adds production deployment files to the working source you already pushed.

## What is included

- Native Backstage `Request Infrastructure` software template
- Azure / AWS / Azure Local / Hyper-V request options
- Enterprise Developer Portal production configuration
- Persistent SQLite path for an MVP on Azure App Service
- App Service startup script
- GitHub Actions CI/CD workflow
- Automatic helper to register the template in your existing `app-config.yaml`

## Apply it

Extract this ZIP at the root of your existing `my-backstage-portal` repository.

The final layout should include:

```
my-backstage-portal/
├── .github/
│   └── workflows/
│       └── deploy-backstage-appservice.yml
├── apply_to_existing_repo.py
└── backstage/
    ├── app-config.yaml
    ├── app-config.production.appservice.yaml
    ├── examples/
    │   └── infrastructure-template/
    │       └── template.yaml
    └── deploy/
        └── startup.sh
```

Then run:

```bash
python3 apply_to_existing_repo.py
cd backstage
yarn install --immutable
yarn build:backend
```

Commit:

```bash
cd ..
git add .
git commit -m "Add App Service deployment and infrastructure template"
git push origin main
```

## Azure App Service settings

Create a Linux App Service with Node.js 24.

Set these App Settings:

- `BACKSTAGE_BASE_URL=https://<YOUR-APP-NAME>.azurewebsites.net`
- `PORT=8080`
- `NODE_ENV=production`

Set the Startup Command to:

```bash
bash /home/site/wwwroot/backstage/deploy/startup.sh
```

## GitHub Actions secrets

Configure:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_WEBAPP_NAME`

The workflow uses Azure OIDC, so configure a federated credential for the GitHub repository in Microsoft Entra ID.

## MVP database

This pack uses:

`/home/data/backstage.db`

This is suitable for a single-instance MVP. For production, use Azure Database for PostgreSQL.

## Authentication

Guest auth remains enabled for the MVP. Replace it with Microsoft Entra ID before enterprise production.

## Current MVP flow

User
→ Enterprise Developer Portal
→ Create
→ Request Infrastructure
→ Validate request
→ MVP success result

Next phase:

Backstage
→ ArchMindCanvas
→ Approval
→ GitHub / Azure DevOps
→ Terraform / Bicep
→ Azure / AWS / Azure Local
