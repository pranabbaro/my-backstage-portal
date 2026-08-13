
from pathlib import Path
import shutil, json, sys

repo=Path.cwd()
bs=repo/'backstage'
app=bs/'packages/app/src'
backend=bs/'packages/backend/src'

# -----------------------------------------------------------------
# IMPORTANT V8.1 CLEANUP
#
# Windows "Extract and Replace" does not delete files that disappeared
# from a later ZIP version. Older V6/V7 Self-Service files can therefore
# remain under overlay/backend/selfService and get copied back into the
# generated Backstage backend.
#
# Remove every known legacy overlay path BEFORE copying V8.
# -----------------------------------------------------------------
overlay_self_service=repo/'overlay/backend/selfService'

legacy_overlay_paths=[
    overlay_self_service/'services',
    overlay_self_service/'discovery/network',
    overlay_self_service/'discovery/resourceGroups',
    overlay_self_service/'validation.ts',
]

for legacy in legacy_overlay_paths:
    if legacy.exists():
        if legacy.is_dir():
            shutil.rmtree(legacy)
        else:
            legacy.unlink()

# Fail fast if any forbidden V6/V7 file somehow remains.
for forbidden in [
    overlay_self_service/'services/appService/deploy.ts',
    overlay_self_service/'services/storageAccount/deploy.ts',
    overlay_self_service/'services/virtualMachine/deploy.ts',
    overlay_self_service/'discovery/network/subnets.ts',
    overlay_self_service/'discovery/network/virtualNetworks.ts',
    overlay_self_service/'validation.ts',
]:
    if forbidden.exists():
        print(f'ERROR: legacy Self-Service overlay file still exists: {forbidden}')
        sys.exit(1)

for p in [app/'App.tsx',app/'modules/nav/Sidebar.tsx',backend/'index.ts',bs/'packages/backend/package.json']:
    if not p.exists():
        print(f'Missing {p}');sys.exit(1)

# page
page_dir=app/'components/selfService';page_dir.mkdir(parents=True,exist_ok=True)
shutil.copy2(repo/'overlay/frontend/SelfServicePage.tsx',page_dir/'SelfServicePage.tsx')

# frontend plugin: use current working V6 plugin overlay
module_dir=app/'modules/selfService';module_dir.mkdir(parents=True,exist_ok=True)
shutil.copy2(repo/'overlay/frontend/selfServiceFrontendPlugin.tsx',module_dir/'index.tsx')

# App.tsx registration
txt=(app/'App.tsx').read_text()
imp="import { selfServicePlugin } from './modules/selfService';"
if imp not in txt:
    pos=txt.rfind('import ')
    end=txt.find(';',pos)+1
    txt=txt[:end]+'\n'+imp+txt[end:]
if 'selfServicePlugin' not in txt.split('export default',1)[-1]:
    txt=txt.replace('features: [','features: [selfServicePlugin, ',1)
(app/'App.tsx').write_text(txt)

# Sidebar
s=(app/'modules/nav/Sidebar.tsx').read_text()
item="{nav.take('page:azure-self-service')}"
if item not in s:
    s=s.replace("{nav.take('page:scaffolder')}","{nav.take('page:scaffolder')}\n        "+item,1)
(app/'modules/nav/Sidebar.tsx').write_text(s)

# backend modular replacement
target=backend/'selfService'

# V8 is a complete replacement of all previous Self-Service backend modules.
# This prevents legacy V6/V7 TypeScript files from being compiled.
if target.exists():
    shutil.rmtree(target)

legacy_plugin=backend/'selfServicePlugin.ts'
if legacy_plugin.exists():
    legacy_plugin.unlink()

shutil.copytree(repo/'overlay/backend/selfService',target)
shutil.copy2(repo/'overlay/backend/selfServicePlugin.ts',backend/'selfServicePlugin.ts')

# Verify that the generated backend contains ONLY V8 layout.
for forbidden in [
    target/'services',
    target/'discovery/network',
    target/'discovery/resourceGroups',
    target/'validation.ts',
]:
    if forbidden.exists():
        print(f'ERROR: legacy generated Self-Service path exists: {forbidden}')
        sys.exit(1)

print('Legacy V6/V7 Self-Service files removed successfully.')

idx=(backend/'index.ts').read_text()
impb="import selfServicePlugin from './selfServicePlugin';"
if impb not in idx:
    marker='const backend = createBackend();'
    idx=idx.replace(marker,impb+'\n\n'+marker,1)
if 'backend.add(selfServicePlugin);' not in idx:
    idx=idx.replace('const backend = createBackend();','const backend = createBackend();\nbackend.add(selfServicePlugin);',1)
(backend/'index.ts').write_text(idx)

pkgp=bs/'packages/backend/package.json'
pkg=json.loads(pkgp.read_text())
pkg.setdefault('dependencies',{}).setdefault('express','^4.21.2')
pkg.setdefault('devDependencies',{}).setdefault('@types/express','^4.17.23')
pkgp.write_text(json.dumps(pkg,indent=2)+'\n')

print('V8 Self-Service applied')
