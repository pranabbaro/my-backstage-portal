#!/usr/bin/env python3
from pathlib import Path
import shutil

repo = Path.cwd()
cfg = repo / "backstage" / "app-config.yaml"
template_src = repo / "backstage" / "examples" / "infrastructure-template" / "template.yaml"

if not cfg.exists():
    raise SystemExit("ERROR: backstage/app-config.yaml not found. Run from repository root.")

backup = cfg.with_suffix(".yaml.before-final-pack")
shutil.copy2(cfg, backup)

text = cfg.read_text(encoding="utf-8")

old_allow = "allow: [Component, System, API, Resource, Location]"
new_allow = "allow: [Component, System, API, Resource, Location, Template]"
if old_allow in text:
    text = text.replace(old_allow, new_allow, 1)

entry = '''    - type: file
      target: ./examples/infrastructure-template/template.yaml
      rules:
        - allow: [Template]
'''

if "infrastructure-template/template.yaml" not in text:
    if "  locations:" in text:
        pos = text.index("  locations:") + len("  locations:")
        text = text[:pos] + "\n" + entry + text[pos:]
    else:
        text += "\n\ncatalog:\n  rules:\n    - allow: [Component, System, API, Resource, Location, Template]\n  locations:\n" + entry

cfg.write_text(text, encoding="utf-8")
print("Updated backstage/app-config.yaml")
print(f"Backup: {backup}")
