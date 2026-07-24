# Push-Only Final Backstage App Service Update

This package is customized for:

- GitHub repo: `pranabbaro/my-backstage-portal`
- Azure App Service: `backstage-pranab-mvp`
- Existing Azure-generated GitHub secret:
  `AZUREAPPSERVICE_PUBLISHPROFILE_BB60165ACCCD4F3EB8AD10FD8D3BF808`

The existing secret was identified from your Azure-generated workflow, so **no new Client ID, Client Secret, Tenant ID, Subscription ID, or new publish-profile secret is required**.

## What this package changes

1. Installs one final workflow:
   `.github/workflows/deploy-backstage-appservice.yml`
2. Removes the duplicate old:
   `.github/workflows/main_backstage-pranab-mvp.yml`
3. Adds App Service production config.
4. Adds App Service startup script.
5. Adds the `Request Infrastructure` template.

## Easiest installation on your laptop

Extract this ZIP anywhere.

From PowerShell inside the extracted folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-INTO-REPO.ps1 -RepoPath D:\my-backstage-portal
```

Then:

```powershell
cd D:\my-backstage-portal
git add .
git commit -m "Final Backstage App Service deployment"
git pull --rebase origin main
git push origin main
```

That push triggers GitHub Actions and deploys to Azure App Service.

## Validation performed

- Workflow YAML syntax
- Production YAML syntax
- Bash syntax
- Exact existing publish-profile secret reference
- Correct Backstage folder build path
- Uses Node 24, matching the repository's `22 || 24` engine
- Uses `yarn build:backend`, which exists in the repository
- Removes the duplicate Azure-generated workflow

A live Azure deployment cannot be executed from this environment because the Azure subscription itself is not connected here.
