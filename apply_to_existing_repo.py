#!/usr/bin/env python3
from pathlib import Path

root = Path.cwd()
cfg = root / "backstage" / "app-config.yaml"
if not cfg.exists():
    raise SystemExit("Run this from the repository root containing backstage/app-config.yaml")

text = cfg.read_text()

# Add Template to existing allow list if needed
text = text.replace(
    "allow: [Component, System, API, Resource, Location]",
    "allow: [Component, System, API, Resource, Location, Template]",
)

location = '''
    - type: file
      target: ./examples/infrastructure-template/template.yaml
      rules:
        - allow: [Template]
'''

if "infrastructure-template/template.yaml" not in text:
    # Add under the first catalog locations block, if present; otherwise append safely.
    if "  locations:" in text:
        idx = text.index("  locations:") + len("  locations:")
        text = text[:idx] + location + text[idx:]
    else:
        text += "\n\ncatalog:\n  rules:\n    - allow: [Component, System, API, Resource, Location, Template]\n  locations:" + location

cfg.write_text(text)
print("Updated backstage/app-config.yaml for the Request Infrastructure template.")
