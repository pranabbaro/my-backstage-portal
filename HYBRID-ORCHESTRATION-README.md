# Multi-Cloud + Hybrid Self-Service Architecture

Targets: Azure, AWS, GCP, Azure Local, Hyper-V.

Azure is the enabled catalog in V13. Other platforms are registered now so their adapters can be added without redesigning the common request contract.

Common request envelope uses `platform`, `serviceType`, common metadata, generic `target`, and resource-specific `parameters`.

Repository layout:
- iac/azure/modules
- iac/aws
- iac/gcp
- iac/azure-local
- iac/hyperv
- catalog/platforms.json
- catalog/service-mapping.json

Future adapters:
- AWS: GitHub OIDC -> IAM role -> Terraform/CloudFormation
- GCP: GitHub OIDC -> Workload Identity Federation -> Terraform
- Azure Local: Arc/management-plane connectivity -> Bicep/automation
- Hyper-V: self-hosted runner -> PowerShell/DSC/Ansible
