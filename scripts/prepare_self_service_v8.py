
from pathlib import Path
import shutil, json, sys

repo=Path.cwd()
bs=repo/'backstage'
app=bs/'packages/app/src'
backend=bs/'packages/backend/src'

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
if target.exists(): shutil.rmtree(target)
shutil.copytree(repo/'overlay/backend/selfService',target)
shutil.copy2(repo/'overlay/backend/selfServicePlugin.ts',backend/'selfServicePlugin.ts')

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
