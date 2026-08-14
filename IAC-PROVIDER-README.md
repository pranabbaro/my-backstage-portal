# Self-Service IaC Deployment Provider

The portal supports two deployment engines.

## 1. Direct ARM (default)

No change from the existing MVP:

SELF_SERVICE_DEPLOYMENT_PROVIDER=direct-arm

Backstage -> Managed Identity -> Azure ARM

## 2. GitHub IaC

SELF_SERVICE_DEPLOYMENT_PROVIDER=github
GITHUB_IAC_OWNER=<github-owner-or-enterprise-org>
GITHUB_IAC_REPO=<iac-repository>
GITHUB_IAC_WORKFLOW=deploy-approved-resource.yml
GITHUB_IAC_REF=main
GITHUB_IAC_TOKEN=<GitHub App installation token or fine-grained token>

For GitHub Enterprise Server also configure:

GITHUB_API_URL=https://github.company.example/api/v3

The token is used only to dispatch the approved workflow.
Azure deployment credentials are NOT passed from Backstage to GitHub.

The GitHub workflow authenticates to Azure using workload identity federation
with these repository/environment secrets:

AZURE_CLIENT_ID
AZURE_TENANT_ID

The workflow takes the target subscription from the validated request.

## Golden IaC

The repository includes:

iac/azure/modules/virtual-machine/main.bicep
iac/azure/modules/storage-account/main.bicep
iac/azure/modules/app-service/main.bicep
iac/azure/modules/key-vault/main.bicep
iac/scripts/deploy.py
.github/workflows/deploy-approved-resource.yml

You may test this in the same repository first.

Later, create a dedicated cloud-iac repository and copy:
- iac/
- .github/workflows/deploy-approved-resource.yml

Then change GITHUB_IAC_OWNER/GITHUB_IAC_REPO in the Backstage App Service.

## Design

Portal:
- user experience
- naming
- subscription routing
- RG/VNet/Subnet discovery
- request validation
- catalog selection

IaC repo:
- approved Bicep modules
- validation
- GitHub Actions
- Azure deployment identity
- version-controlled deployment implementation

Direct ARM remains available as a rollback/MVP mode.
