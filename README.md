# Final Backstage App Service Pack

This is the consolidated deployment pack for the existing `my-backstage-portal` repository.

## Included

- Request Infrastructure software template
- Azure / AWS / Azure Local / Hyper-V request form
- App Service production config
- Persistent MVP SQLite path `/home/data/backstage.db`
- App Service startup script
- GitHub Actions deployment using Azure Publish Profile
- No Azure Client ID / Tenant ID / Subscription ID / Client Secret required by this workflow
- Patch helper for the existing Backstage `app-config.yaml`

## IMPORTANT

This is an overlay for your existing working Backstage repository. Do not replace the entire existing `backstage` directory. Merge these files into it.

## 1. Copy into your repo

Final repo should contain:

```text
my-backstage-portal/
├── .github/
│   └── workflows/
│       └── deploy-backstage-appservice.yml
├── apply_final_pack.py
└── backstage/
    ├── app-config.yaml
    ├── app-config.production.appservice.yaml
    ├── deploy/
    │   └── startup.sh
    └── examples/
        └── infrastructure-template/
            └── template.yaml
```

## 2. Register template

From repository root:

```powershell
python apply_final_pack.py
```

## 3. Commit

```powershell
git add .
git commit -m "Deploy final Backstage MVP to App Service"
git pull --rebase origin main
git push origin main
```

## 4. GitHub secret

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

Name:

`AZURE_WEBAPP_PUBLISH_PROFILE`

Value:

Paste the complete Azure App Service publish profile XML.

## 5. Azure App Service configuration

App Service name expected by workflow:

`backstage-pranab-mvp`

Runtime:
- Linux
- Node.js 24

Application settings:

`BACKSTAGE_BASE_URL=https://backstage-pranab-mvp.azurewebsites.net`

`PORT=8080`

`NODE_ENV=production`

Startup command:

```bash
bash /home/site/wwwroot/backstage/deploy/startup.sh
```

## 6. Disable old workflow

Disable/delete the older Azure-generated workflow such as:

`main_backstage-pranab-mvp.yml`

Keep only:

`deploy-backstage-appservice.yml`

## Validation performed on this pack

- YAML syntax parsed successfully
- Shell startup script syntax checked
- Required pack files verified
- GitHub workflow uses Publish Profile authentication rather than OIDC credentials

This validation does not execute a live deployment into your Azure subscription.
