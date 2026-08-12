#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

repo = Path.cwd()
bs = repo / "backstage"

app_tsx = bs / "packages" / "app" / "src" / "App.tsx"
sidebar_tsx = bs / "packages" / "app" / "src" / "modules" / "nav" / "Sidebar.tsx"
app_pkg = bs / "packages" / "app" / "package.json"
backend_index = bs / "packages" / "backend" / "src" / "index.ts"
backend_pkg = bs / "packages" / "backend" / "package.json"

required = [app_tsx, sidebar_tsx, app_pkg, backend_index, backend_pkg]
missing = [str(p) for p in required if not p.exists()]
if missing:
    print("Missing expected Backstage files:")
    print("\n".join(missing))
    sys.exit(1)

# ---- Backend ----
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

plugin_import = "import selfServicePlugin from './selfServicePlugin';"
if plugin_import not in backend_text:
    marker = "const backend = createBackend();"
    pos = backend_text.find(marker)
    if pos == -1:
        print("Could not find `const backend = createBackend();` in backend index")
        sys.exit(1)
    backend_text = backend_text[:pos] + plugin_import + "\n\n" + backend_text[pos:]

if "backend.add(selfServicePlugin);" not in backend_text:
    backend_text = backend_text.replace(
        "const backend = createBackend();",
        "const backend = createBackend();\nbackend.add(selfServicePlugin);",
        1,
    )

backend_index.write_text(backend_text, encoding="utf-8")

backend_data = json.loads(backend_pkg.read_text(encoding="utf-8"))
backend_data.setdefault("dependencies", {})
backend_data["dependencies"].setdefault("express", "^4.21.2")
backend_data.setdefault("devDependencies", {})
backend_data["devDependencies"].setdefault("@types/express", "^4.17.23")
backend_pkg.write_text(json.dumps(backend_data, indent=2) + "\n", encoding="utf-8")

# ---- Frontend page ----
page_dir = bs / "packages" / "app" / "src" / "components" / "selfService"
page_dir.mkdir(parents=True, exist_ok=True)
(page_dir / "SelfServicePage.tsx").write_text(
    (repo / "overlay" / "SelfServicePage.tsx").read_text(encoding="utf-8"),
    encoding="utf-8",
)

app_text = app_tsx.read_text(encoding="utf-8")
route_import = "import { SelfServicePage } from './components/selfService/SelfServicePage';"

if route_import not in app_text:
    # Insert before first top-level const after imports.
    match = re.search(r"(?m)^const\s+", app_text)
    if match:
        app_text = app_text[:match.start()] + route_import + "\n\n" + app_text[match.start():]
    else:
        # Fallback: after last import statement.
        imports = list(re.finditer(r"(?ms)^import .*?;\s*$", app_text))
        if not imports:
            print("Could not find import/const insertion point in App.tsx")
            sys.exit(1)
        pos = imports[-1].end()
        app_text = app_text[:pos] + "\n" + route_import + app_text[pos:]

route_line = '      <Route path="/self-service" element={<SelfServicePage />} />'
if 'path="/self-service"' not in app_text:
    if "</FlatRoutes>" in app_text:
        app_text = app_text.replace(
            "</FlatRoutes>",
            route_line + "\n    </FlatRoutes>",
            1,
        )
    else:
        print("Could not find </FlatRoutes> in App.tsx")
        sys.exit(1)

app_tsx.write_text(app_text, encoding="utf-8")

# ---- Sidebar ----
sidebar_text = sidebar_tsx.read_text(encoding="utf-8")
app_pkg_data = json.loads(app_pkg.read_text(encoding="utf-8"))
all_deps = {
    **app_pkg_data.get("dependencies", {}),
    **app_pkg_data.get("devDependencies", {}),
}

icon_name = None
icon_import_line = None

if "@material-ui/icons" in all_deps:
    icon_name = "CloudQueueIcon"
    icon_import_line = "import CloudQueueIcon from '@material-ui/icons/CloudQueue';"
elif "@mui/icons-material" in all_deps:
    icon_name = "CloudQueueIcon"
    icon_import_line = "import CloudQueueIcon from '@mui/icons-material/CloudQueue';"
else:
    # Reuse an existing default-imported icon already present in Sidebar.tsx.
    icon_match = re.search(
        r"import\s+([A-Za-z_$][\w$]*)\s+from\s+['\"](?:@material-ui/icons/[^'\"]+|@mui/icons-material/[^'\"]+)['\"];",
        sidebar_text,
    )
    if icon_match:
        icon_name = icon_match.group(1)

if icon_import_line and icon_import_line not in sidebar_text:
    imports = list(re.finditer(r"(?m)^import .*?;\s*$", sidebar_text))
    if imports:
        pos = imports[-1].end()
        sidebar_text = sidebar_text[:pos] + "\n" + icon_import_line + sidebar_text[pos:]
    else:
        sidebar_text = icon_import_line + "\n" + sidebar_text

if icon_name:
    sidebar_item = (
        f'<SidebarItem icon={{{icon_name}}} to="self-service" text="Self Service" />'
    )
    if 'to="self-service"' not in sidebar_text:
        # Prefer insertion before Settings, then before SidebarSpace, then before SidebarScrollWrapper close.
        settings = re.search(
            r'(?P<indent>\s*)<SidebarItem[^>]+text=["\']Settings["\'][^>]*/>',
            sidebar_text,
        )
        if settings:
            indent = settings.group("indent")
            sidebar_text = (
                sidebar_text[:settings.start()]
                + indent
                + sidebar_item
                + "\n"
                + sidebar_text[settings.start():]
            )
        elif "<SidebarSpace />" in sidebar_text:
            sidebar_text = sidebar_text.replace(
                "<SidebarSpace />",
                sidebar_item + "\n      <SidebarSpace />",
                1,
            )
        elif "</SidebarScrollWrapper>" in sidebar_text:
            sidebar_text = sidebar_text.replace(
                "</SidebarScrollWrapper>",
                "      " + sidebar_item + "\n    </SidebarScrollWrapper>",
                1,
            )
        else:
            print("WARNING: Could not find a safe sidebar insertion point.")
            print("The /self-service route will still work directly.")
else:
    print("WARNING: Could not determine a compatible Sidebar icon.")
    print("The /self-service route will still work directly.")

sidebar_tsx.write_text(sidebar_text, encoding="utf-8")

print("Azure Self-Service source applied successfully.")
print("Frontend route: /self-service")
print("Navigation file: packages/app/src/modules/nav/Sidebar.tsx")
print("Backend API: /api/azure-self-service")
