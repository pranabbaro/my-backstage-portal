
import json
import os
import subprocess
import sys
from pathlib import Path

APPROVED = {
    "virtual-machine": "modules/virtual-machine/main.bicep",
    "storage-account": "modules/storage-account/main.bicep",
    "app-service": "modules/app-service/main.bicep",
    "key-vault": "modules/key-vault/main.bicep",
}

def run(args):
    print("+", " ".join(args))
    subprocess.run(args, check=True)

def main():
    raw = os.environ["REQUEST_JSON"]
    request = json.loads(raw)

    service = request["serviceType"]
    if service not in APPROVED:
        raise SystemExit(f"Unsupported serviceType: {service}")

    subscription = request["subscriptionId"]
    rg = request["resourceGroup"]
    rg_mode = request["resourceGroupMode"]
    location = request["location"]
    params = dict(request.get("parameters") or {})

    run(["az", "account", "set", "--subscription", subscription])

    if rg_mode == "new":
        run(["az", "group", "create", "--name", rg, "--location", location])

    # Key Vault service-endpoint mode needs a safe subnet update before the
    # Bicep module adds the Key Vault VNet firewall rule.
    if service == "key-vault" and params.get("networkMode") == "service-endpoint":
        subnet_id = params.get("subnetResourceId")
        if not subnet_id:
            raise SystemExit("subnetResourceId is required for service-endpoint")
        run([
            "az", "network", "vnet", "subnet", "update",
            "--ids", subnet_id,
            "--service-endpoints", "Microsoft.KeyVault",
        ])

    # Key Vault needs tenantId; get it from the logged-in federated identity.
    if service == "key-vault":
        tenant = subprocess.check_output(
            ["az", "account", "show", "--query", "tenantId", "-o", "tsv"],
            text=True,
        ).strip()
        params["tenantId"] = tenant

    params["location"] = location

    parameter_file = Path("/tmp/iac-parameters.json")
    parameter_file.write_text(json.dumps({
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            key: {"value": value}
            for key, value in params.items()
        },
    }))

    template = Path("iac") / APPROVED[service]

    run([
        "az", "deployment", "group", "create",
        "--resource-group", rg,
        "--template-file", str(template),
        "--parameters", f"@{parameter_file}",
        "--name", f"backstage-{service}",
    ])

if __name__ == "__main__":
    main()
