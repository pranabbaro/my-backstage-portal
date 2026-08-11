#!/usr/bin/env python3
from pathlib import Path
import shutil, re
repo=Path.cwd(); app=repo/'backstage'
if not (app/'package.json').exists(): raise SystemExit('backstage/package.json not found')
cfg=app/'app-config.yaml'; text=cfg.read_text()
text=re.sub(r'(?m)^(\s*title:\s*).+$', r'\1Enterprise Developer Portal', text, count=1)
text=re.sub(r'(?ms)^organization:\s*\n(?:[ \t].*\n)*', 'organization:\n  name: Enterprise Platform\n', text, count=1)
if 'guest:' not in text:
    if re.search(r'(?m)^auth:\s*$', text):
        text=text.replace('auth:\n','auth:\n  environment: development\n  providers:\n    guest: {}\n',1)
    else:
        text+='\nauth:\n  environment: development\n  providers:\n    guest: {}\n'
text=text.replace('allow: [Component, System, API, Resource, Location]','allow: [Component, System, API, Resource, Location, Template]')
target='./examples/infrastructure-template/template.yaml'
if target not in text:
    entry='    - type: file\n      target: ./examples/infrastructure-template/template.yaml\n      rules:\n        - allow: [Template]\n'
    marker='  locations:'; pos=text.find(marker)
    if pos>=0:
        at=pos+len(marker); text=text[:at]+'\n'+entry+text[at:]
    else:
        text+='\ncatalog:\n  rules:\n    - allow: [Component, System, API, Resource, Location, Template]\n  locations:\n'+entry
cfg.write_text(text)
shutil.copy2(repo/'portal-config/app-config.production.yaml', app/'app-config.production.yaml')
td=app/'examples/infrastructure-template'; td.mkdir(parents=True,exist_ok=True)
shutil.copy2(repo/'portal-config/request-infrastructure-template.yaml', td/'template.yaml')
logo=app/'packages/app/src/modules/nav/LogoFull.tsx'
if logo.exists():
    logo.write_text("""import { makeStyles } from '@material-ui/core';\n\nconst useStyles = makeStyles({\n  logo: { display: 'flex', alignItems: 'center', height: 40, fontSize: 20, fontWeight: 700, color: '#7df3e1', whiteSpace: 'nowrap' },\n});\n\nexport const LogoFull = () => {\n  const classes = useStyles();\n  return <div className={classes.logo}>Developer Portal</div>;\n};\n""")
print('Backstage MVP customization applied successfully.')
