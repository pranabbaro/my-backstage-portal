# Fresh Backstage Enterprise Developer Portal

Target repository: `pranabbaro/my-backstage-portal`

Target Azure App Service: `backstage-pranab-mvp`

Public App Service URL: `https://backstage-pranab-mvp.azurewebsites.net`

## What happens after you push this repository

The GitHub Action does the work:

1. Generates a fresh official Backstage application using pinned `@backstage/create-app@0.9.0` if `/backstage` does not exist.
2. Applies the Enterprise Developer Portal branding.
3. Adds the Request Infrastructure template.
4. Installs dependencies.
5. Runs TypeScript validation.
6. Runs the Backstage production build.
7. Commits the complete generated `/backstage` source back into your GitHub repo automatically.
8. Creates the production runtime package.
9. Deploys to `backstage-pranab-mvp` on Azure App Service.

The generated-source commit uses `[skip ci]` so it does not create a deployment loop.

## Deployment credential

This workflow references the existing Azure-created GitHub Actions secret:

`AZUREAPPSERVICE_PUBLISHPROFILE_BB60165ACCCD4F3EB8AD10FD8D3BF808`

That exact secret name was already referenced by the Azure-generated workflow in this same GitHub repository.

The uploaded `.PublishSettings` file is **not** included in this ZIP and must never be committed to GitHub.

## Included MVP feature

Backstage -> Create -> Request Infrastructure

Inputs:
- Project
- Development/Test/Build/Sandbox
- Azure/AWS/Azure Local/Hyper-V
- Region
- Windows/Linux
- VM size and count
- Cost center/owner
- Lifetime and auto-cleanup

The MVP validates the request only; it intentionally does not deploy cloud resources yet.

## Upload

Delete old source/workflow files from the repo if you truly want a fresh start, then upload the CONTENTS of this ZIP to the repository root and commit to `main`.

The workflow should start automatically.

## Important

This package intentionally does not contain your App Service publish profile or password.
