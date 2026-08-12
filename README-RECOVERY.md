# Backstage Direct Recovery

This package is intentionally focused on restoring the existing Backstage portal.

It removes the custom Self-Service plugin from the build path temporarily and
deploys Backstage with no explicit `backend.database` setting. Current Backstage
then uses its built-in in-memory SQLite database.

## Laptop steps

Copy the contents of this ZIP into the root of your cloned repository:

`C:\backstage-full`

or whichever clean clone you are actively using.

Choose **Replace files in destination**.

Do not run Yarn/NPM locally.

Then run only:

```powershell
git add .
git commit -m "Recover Backstage App Service runtime"
git pull --rebase origin main
git push origin main
```

After GitHub Actions is green, restart the Azure App Service once and open:

https://backstage-pranab-mvp-e9gcgmasd5abgth5.centralindia-01.azurewebsites.net

## Why this recovery build is different

The workflow itself overwrites the two runtime YAML files before building and
packages those exact files into the deployment ZIP. It also fails the GitHub
Action if any `filename:` SQLite configuration appears in those runtime YAMLs.
