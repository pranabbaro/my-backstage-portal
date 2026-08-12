#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

repo = Path.cwd()
bs = repo / "backstage"

app_tsx = bs / "packages" / "app" / "src" / "App.tsx"
root_tsx = bs / "packages" / "app" / "src" / "components" / "Root" / "Root.tsx"
backend_index = bs / "packages" / "backend" / "src" / "index.ts"
backend_pkg = bs / "packages" / "backend" / "package.json"

required = [app_tsx, root_tsx, backend_index, backend_pkg]
missing = [str(p) for p in required if not p.exists()]
if missing:
    print("Missing expected Backstage files:")
    print("\n".join(missing))
    sys.exit(1)

backend_text = backend_index.read_text(encoding="utf-8")
backend_text = backend_text.replace(
    "backend.add(import('@internal/plugin-cloud-provisioning-backend'));", ""
)
backend_text = backend_text.replace(
    "backend.add(import('@internal/plugin-cloud-self-service-backend'));", ""
)

backend_plugin = bs / "packages" / "backend" / "src" / "selfServicePlugin.ts"
backend_plugin.write_text(
    (repo / "overlay" / "selfServicePlugin.ts").read_text(encoding="utf-8"),
    encoding="utf-8",
)

if "import selfServicePlugin from './selfServicePlugin';" not in backend_text:
    marker = "const backend = createBackend();"
    pos = backend_text.find(marker)
    if pos == -1:
        print("Could not find `const backend = createBackend();`")
        sys.exit(1)
    backend_text = (
        backend_text[:pos]
        + "import selfServicePlugin from './selfServicePlugin';\n\n"
        + backend_text[pos:]
    )

if "backend.add(selfServicePlugin);" not in backend_text:
    marker = "const backend = createBackend();"
    backend_text = backend_text.replace(
        marker, marker + "\nbackend.add(selfServicePlugin);", 1
    )

backend_index.write_text(backend_text, encoding="utf-8")

pkg = json.loads(backend_pkg.read_text(encoding="utf-8"))
pkg.setdefault("dependencies", {})
pkg["dependencies"].setdefault("express", "^4.21.2")
pkg.setdefault("devDependencies", {})
pkg["devDependencies"].setdefault("@types/express", "^4.17.23")
backend_pkg.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")

page_dir = bs / "packages" / "app" / "src" / "components" / "selfService"
page_dir.mkdir(parents=True, exist_ok=True)
(page_dir / "SelfServicePage.tsx").write_text(
    (repo / "overlay" / "SelfServicePage.tsx").read_text(encoding="utf-8"),
    encoding="utf-8",
)

app_text = app_tsx.read_text(encoding="utf-8")
route_import = "import { SelfServicePage } from './components/selfService/SelfServicePage';"

if route_import not in app_text:
    marker = "const app = createApp"
    pos = app_text.find(marker)
    if pos == -1:
        marker = "const routes"
        pos = app_text.find(marker)
    if pos == -1:
        print("Could not find a safe import insertion point in App.tsx")
        sys.exit(1)
    app_text = app_text[:pos] + route_import + "\n\n" + app_text[pos:]

route_line = '      <Route path="/self-service" element={<SelfServicePage />} />'
if 'path="/self-service"' not in app_text:
    if "</FlatRoutes>" not in app_text:
        print("Could not find </FlatRoutes> in App.tsx")
        sys.exit(1)
    app_text = app_text.replace(
        "</FlatRoutes>",
        route_line + "\n    </FlatRoutes>",
        1,
    )

app_tsx.write_text(app_text, encoding="utf-8")

root_text = root_tsx.read_text(encoding="utf-8")
icon_import = "import CloudQueueIcon from '@material-ui/icons/CloudQueue';"

if icon_import not in root_text:
    marker = "export const Root"
    pos = root_text.find(marker)
    if pos == -1:
        print("Could not find Root component export")
        sys.exit(1)
    root_text = root_text[:pos] + icon_import + "\n\n" + root_text[pos:]

sidebar_item = '<SidebarItem icon={CloudQueueIcon} to="self-service" text="Self Service" />'
if 'to="self-service"' not in root_text:
    settings_match = re.search(
        r'(?P<indent>\s*)<SidebarItem[^>]+text=["\']Settings["\'][^>]*/>',
        root_text,
    )
    if settings_match:
        indent = settings_match.group("indent")
        root_text = (
            root_text[:settings_match.start()]
            + indent
            + sidebar_item
            + "\n"
            + root_text[settings_match.start():]
        )
    elif "<SidebarSpace />" in root_text:
        root_text = root_text.replace(
            "<SidebarSpace />",
            sidebar_item + "\n      <SidebarSpace />",
            1,
        )
    else:
        print("Could not find a safe sidebar insertion point")
        sys.exit(1)

root_tsx.write_text(root_text, encoding="utf-8")

print("Azure Self-Service source applied successfully.")
print("Frontend route: /self-service")
print("Backend API: /api/azure-self-service")
