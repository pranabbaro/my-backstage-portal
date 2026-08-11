#!/usr/bin/env python3
from pathlib import Path
import json
import re

repo = Path.cwd()
bs = repo / "backstage"

def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def save(path: Path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

if not (bs / "package.json").exists():
    raise SystemExit("backstage/package.json not found")

lock_path = bs / "yarn.lock"
if not lock_path.exists():
    raise SystemExit("backstage/yarn.lock not found")

lock_text = lock_path.read_text(encoding="utf-8")

def version_from_package_json(pkg, name):
    for section in ("dependencies", "devDependencies", "peerDependencies"):
        value = pkg.get(section, {}).get(name)
        if value:
            return value
    return None

def semver_key(v):
    nums = re.findall(r"\d+", v)
    return tuple(int(x) for x in nums[:4])

def version_from_lock(name):
    versions = []
    lines = lock_text.splitlines()

    for i, line in enumerate(lines):
        if line.startswith((" ", "\t")):
            continue
        if f"{name}@npm:" not in line:
            continue

        for j in range(i + 1, min(i + 12, len(lines))):
            next_line = lines[j]
            if next_line and not next_line.startswith((" ", "\t")):
                break
            m = re.match(r"\s+version:\s+\"?([^\"\s]+)\"?\s*$", next_line)
            if m:
                versions.append(m.group(1))
                break

    if not versions:
        return None

    versions.sort(key=semver_key, reverse=True)
    return versions[0]

def resolve_version(name, *pkgs, required=True):
    for pkg in pkgs:
        if pkg:
            direct = version_from_package_json(pkg, name)
            if direct:
                return direct

    locked = version_from_lock(name)
    if locked:
        return locked

    if required:
        raise SystemExit(
            f"Could not resolve {name} from package.json files or backstage/yarn.lock"
        )
    return None

root_pkg = load(bs / "package.json")
app_pkg_path = bs / "packages/app/package.json"
backend_pkg_path = bs / "packages/backend/package.json"
front_pkg_path = bs / "plugins/cloud-self-service/package.json"
back_pkg_path = bs / "plugins/cloud-provisioning-backend/package.json"

app_pkg = load(app_pkg_path)
backend_pkg = load(backend_pkg_path)
front_pkg = load(front_pkg_path)
back_pkg = load(back_pkg_path)

core_components = resolve_version("@backstage/core-components", app_pkg, root_pkg)
frontend_plugin_api = resolve_version("@backstage/frontend-plugin-api", app_pkg, root_pkg)
react_version = resolve_version("react", app_pkg, root_pkg)
backend_plugin_api = resolve_version("@backstage/backend-plugin-api", backend_pkg, root_pkg)
backstage_cli = resolve_version("@backstage/cli", root_pkg, app_pkg, backend_pkg)
types_react = resolve_version("@types/react", app_pkg, root_pkg, required=False) or "^18"
express_version = resolve_version("express", backend_pkg, root_pkg, required=False) or "^4.21.2"
types_express = resolve_version("@types/express", backend_pkg, root_pkg, required=False) or "^5.0.0"

print("Resolved versions:")
print(f"  @backstage/core-components       {core_components}")
print(f"  @backstage/frontend-plugin-api   {frontend_plugin_api}")
print(f"  @backstage/backend-plugin-api    {backend_plugin_api}")
print(f"  @backstage/cli                   {backstage_cli}")
print(f"  react                            {react_version}")
print(f"  express                          {express_version}")

front_pkg["dependencies"] = {
    "@backstage/core-components": core_components,
    "@backstage/frontend-plugin-api": frontend_plugin_api,
    "react": react_version,
}
front_pkg["devDependencies"] = {
    "@backstage/cli": backstage_cli,
    "@types/react": types_react,
}
save(front_pkg_path, front_pkg)

back_pkg["dependencies"] = {
    "@backstage/backend-plugin-api": backend_plugin_api,
    "express": express_version,
}
back_pkg["devDependencies"] = {
    "@backstage/cli": backstage_cli,
    "@types/express": types_express,
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

backend_index = bs / "packages/backend/src/index.ts"
text = backend_index.read_text(encoding="utf-8")
registration = "backend.add(import('@internal/plugin-cloud-provisioning-backend'));"

if registration not in text:
    if "backend.start();" not in text:
        raise SystemExit("Could not find backend.start() in backstage/packages/backend/src/index.ts")
    text = text.replace("backend.start();", f"{registration}\n\nbackend.start();", 1)
    backend_index.write_text(text, encoding="utf-8")

config_path = bs / "app-config.yaml"
config_text = config_path.read_text(encoding="utf-8")

app_match = re.search(r"(?m)^app:\s*$", config_text)
if not app_match:
    raise SystemExit("Could not find top-level app: in backstage/app-config.yaml")

app_end = len(config_text)
for match in re.finditer(r"(?m)^[A-Za-z][A-Za-z0-9_-]*:\s*$", config_text):
    if match.start() > app_match.start():
        app_end = match.start()
        break

app_block = config_text[app_match.start():app_end]

if not re.search(r"(?m)^\s{2}packages:\s*all\s*$", app_block):
    insert_at = app_match.end()
    config_text = config_text[:insert_at] + "\n  packages: all" + config_text[insert_at:]
    config_path.write_text(config_text, encoding="utf-8")

print("Self-Service Cloud dependency wiring completed successfully.")
