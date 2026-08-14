import json
import os
import subprocess
from pathlib import Path

APPROVED = {
    ('azure', 'virtual-machine'): 'iac/azure/modules/virtual-machine/main.bicep',
    ('azure', 'storage-account'): 'iac/azure/modules/storage-account/main.bicep',
    ('azure', 'app-service'): 'iac/azure/modules/app-service/main.bicep',
    ('azure', 'key-vault'): 'iac/azure/modules/key-vault/main.bicep',
}

def run(args):
    print('+', ' '.join(args))
    subprocess.run(args, check=True)

def deploy_azure(request):
    service = request['serviceType']
    key = ('azure', service)
    if key not in APPROVED:
        raise SystemExit(f'Unsupported Azure serviceType: {service}')
    target = request.get('target') or {}
    subscription = target.get('subscriptionId') or request.get('subscriptionId')
    rg = target.get('resourceGroup') or request.get('resourceGroup')
    rg_mode = target.get('resourceGroupMode') or request.get('resourceGroupMode')
    location = request['location']
    params = dict(request.get('parameters') or {})
    if not subscription or not rg:
        raise SystemExit('Azure target requires subscriptionId and resourceGroup')
    run(['az','account','set','--subscription',subscription])
    if rg_mode == 'new':
        run(['az','group','create','--name',rg,'--location',location])
    if service == 'key-vault' and params.get('networkMode') == 'service-endpoint':
        subnet_id=params.get('subnetResourceId')
        if not subnet_id: raise SystemExit('subnetResourceId is required for service-endpoint')
        run(['az','network','vnet','subnet','update','--ids',subnet_id,'--service-endpoints','Microsoft.KeyVault'])
    if service == 'key-vault':
        tenant=subprocess.check_output(['az','account','show','--query','tenantId','-o','tsv'],text=True).strip()
        params['tenantId']=tenant
    params['location']=location
    parameter_file=Path('/tmp/iac-parameters.json')
    parameter_file.write_text(json.dumps({'$schema':'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#','contentVersion':'1.0.0.0','parameters':{k:{'value':v} for k,v in params.items()}}))
    run(['az','deployment','group','create','--resource-group',rg,'--template-file',APPROVED[key],'--parameters',f'@{parameter_file}','--name',f'backstage-{service}'])

def main():
    request=json.loads(os.environ['REQUEST_JSON'])
    platform=request.get('platform')
    if platform == 'azure':
        deploy_azure(request)
        return
    if platform in {'aws','gcp','azure-local','hyperv'}:
        raise SystemExit(f"Platform '{platform}' is registered but its approved deployment adapter is not enabled yet")
    raise SystemExit(f'Unsupported platform: {platform}')

if __name__ == '__main__':
    main()
