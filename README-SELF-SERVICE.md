# Direct Push Azure Self-Service Cloud V2

This fixes the exact workflow error:
`Could not determine @backstage/backend-plugin-api version from packages/backend/package.json`

V2 resolves the Backstage versions from the existing `backstage/yarn.lock`,
so it uses the versions already pinned in your working portal.

Copy this ZIP over `D:\my-backstage-portal`, overwrite matching files, then run only:

```powershell
git add .
git commit -m "Fix Azure Self-Service Cloud"
git pull --rebase origin main
git push origin main
```

Do not run npm/yarn locally.

GitHub Actions performs install, type-check, build, package, and App Service deployment.
