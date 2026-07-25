#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

repo = Path.cwd()
bs = repo / "backstage"

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def save(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

if not (bs / "package.json").exists():
    raise SystemExit("backstage/package.json not found")

app_pkg_path = bs / "packages/app/package.json"
backend_pkg_path = bs / "packages/backend/package.json"
front_pkg_path = bs / "plugins/cloud-self-service/package.json"
back_pkg_path = bs / "plugins/cloud-provisioning-backend/package.json"

app_pkg = load(app_pkg_path)
backend_pkg = load(backend_pkg_path)
front_pkg = load(front_pkg_path)
back_pkg = load(back_pkg_path)

def version_from(pkg, name):
    for section in ("dependencies", "devDependencies", "peerDependencies"):
        value = pkg.get(section, {}).get(name)
        if value:
            return value
    return None

required_front = {
    "@backstage/core-components": version_from(app_pkg, "@backstage/core-components"),
    "@backstage/frontend-plugin-api": version_from(app_pkg, "@backstage/frontend-plugin-api"),
    "react": version_from(app_pkg, "react"),
}
for name, version in required_front.items():
    if not version:
        raise SystemExit(f"Could not determine version of {name} from packages/app/package.json")

front_pkg["dependencies"] = required_front
front_pkg["devDependencies"] = {
    "@backstage/cli": "^0.36.4",
    "@types/react": version_from(app_pkg, "@types/react") or "^18",
}
save(front_pkg_path, front_pkg)

backend_api_version = version_from(
    backend_pkg, "@backstage/backend-plugin-api"
)
if not backend_api_version:
    raise SystemExit(
        "Could not determine @backstage/backend-plugin-api version from packages/backend/package.json"
    )

back_pkg["dependencies"] = {
    "@backstage/backend-plugin-api": backend_api_version,
    "express": "^4.21.2",
}
back_pkg["devDependencies"] = {
    "@backstage/cli": "^0.36.4",
    "@types/express": "^5.0.0",
}
save(back_pkg_path, back_pkg)

app_pkg.setdefault("dependencies", {})[
    "@internal/plugin-cloud-self-service"
] = "workspace:^"
save(app_pkg_path, app_pkg)

backend_pkg.setdefault("dependencies", {})[
    "@internal/plugin-cloud-provisioning-backend"
] = "workspace:^"
save(backend_pkg_path, backend_pkg)

# Register backend plugin
backend_index = bs / "packages/backend/src/index.ts"
text = backend_index.read_text(encoding="utf-8")
registration = "backend.add(import('@internal/plugin-cloud-provisioning-backend'));"
if registration not in text:
    if "backend.start();" not in text:
        raise SystemExit("Could not find backend.start() in backend index")
    text = text.replace(
        "backend.start();",
        f"{registration}\n\nbackend.start();",
        1,
    )
    backend_index.write_text(text, encoding="utf-8")

# Ensure new frontend feature discovery is enabled.
config = bs / "app-config.yaml"
config_text = config.read_text(encoding="utf-8")
app_match = re.search(r"(?m)^app:\s*$", config_text)
if not app_match:
    raise SystemExit("Could not find top-level app: in app-config.yaml")

# Only insert packages: all if there isn't already an app.packages setting.
app_end = len(config_text)
for match in re.finditer(r"(?m)^[A-Za-z][A-Za-z0-9_-]*:\s*$", config_text):
    if match.start() > app_match.start():
        app_end = match.start()
        break
app_block = config_text[app_match.start():app_end]
if not re.search(r"(?m)^\s{2}packages:\s*all\s*$", app_block):
    insert_at = app_match.end()
    config_text = (
        config_text[:insert_at]
        + "\n  packages: all"
        + config_text[insert_at:]
    )
    config.write_text(config_text, encoding="utf-8")

print("Self-Service Cloud plugin prepared successfully.")
