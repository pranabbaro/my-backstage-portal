#!/usr/bin/env python3
from pathlib import Path
import json

repo = Path.cwd()
bs = repo / "backstage"

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def save(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

# Remove any leftover custom self-service package references from earlier attempts.
app_pkg_path = bs / "packages" / "app" / "package.json"
backend_pkg_path = bs / "packages" / "backend" / "package.json"

for path, dep in [
    (app_pkg_path, "@internal/plugin-cloud-self-service"),
    (backend_pkg_path, "@internal/plugin-cloud-provisioning-backend"),
]:
    if path.exists():
        data = load(path)
        changed = False
        for section in ("dependencies", "devDependencies", "peerDependencies"):
            deps = data.get(section, {})
            if dep in deps:
                del deps[dep]
                changed = True
        if changed:
            save(path, data)
            print(f"Removed stale dependency {dep} from {path}")

backend_index = bs / "packages" / "backend" / "src" / "index.ts"
if backend_index.exists():
    text = backend_index.read_text(encoding="utf-8")
    stale = "backend.add(import('@internal/plugin-cloud-provisioning-backend'));"
    if stale in text:
        backend_index.write_text(text.replace(stale, ""), encoding="utf-8")
        print("Removed stale cloud-provisioning backend registration")

print("Recovery preparation complete.")
