#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

repo = Path.cwd()
bs = repo / "backstage"

app_tsx = bs / "packages" / "app" / "src" / "App.tsx"
app_pkg = bs / "packages" / "app" / "package.json"
backend_index = bs / "packages" / "backend" / "src" / "index.ts"
backend_pkg = bs / "packages" / "backend" / "package.json"

required = [app_tsx, app_pkg, backend_index, backend_pkg]
missing = [str(p) for p in required if not p.exists()]
if missing:
    print("Missing expected Backstage files:")
    print("\n".join(missing))
    sys.exit(1)

# ------------------------------------------------------------------
# Backend plugin
# ------------------------------------------------------------------
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

# ------------------------------------------------------------------
# Frontend - Backstage NEW frontend system
# ------------------------------------------------------------------
page_dir = bs / "packages" / "app" / "src" / "components" / "selfService"
page_dir.mkdir(parents=True, exist_ok=True)
(page_dir / "SelfServicePage.tsx").write_text(
    (repo / "overlay" / "SelfServicePage.tsx").read_text(encoding="utf-8"),
    encoding="utf-8",
)

module_dir = bs / "packages" / "app" / "src" / "modules" / "selfService"
module_dir.mkdir(parents=True, exist_ok=True)
(module_dir / "index.tsx").write_text(
    (repo / "overlay" / "selfServiceFrontendPlugin.tsx").read_text(encoding="utf-8"),
    encoding="utf-8",
)

app_text = app_tsx.read_text(encoding="utf-8")

# Ensure this really is the new frontend-system app we saw from the user's source.
if "@backstage/frontend-defaults" not in app_text or "createApp" not in app_text:
    print("App.tsx is not the expected new frontend-system createApp structure")
    sys.exit(1)

frontend_import = "import { selfServicePlugin } from './modules/selfService';"
if frontend_import not in app_text:
    # Insert after the existing import block.
    imports = list(re.finditer(r"(?m)^import .*?;\s*$", app_text))
    if not imports:
        print("Could not find App.tsx import block")
        sys.exit(1)
    pos = imports[-1].end()
    app_text = app_text[:pos] + "\n" + frontend_import + app_text[pos:]

# Add the plugin to createApp({ features: [...] }).
if "selfServicePlugin" not in re.sub(
    r"import\s+\{\s*selfServicePlugin\s*\}.*?;\s*", "", app_text
):
    feature_match = re.search(
        r"(features\s*:\s*\[)(?P<body>[\s\S]*?)(\])",
        app_text,
    )
    if not feature_match:
        print("Could not find `features: [...]` in App.tsx")
        sys.exit(1)

    body = feature_match.group("body")
    stripped = body.rstrip()
    if stripped and not stripped.rstrip().endswith(","):
        new_body = stripped + ", selfServicePlugin"
    elif stripped:
        new_body = stripped + " selfServicePlugin"
    else:
        new_body = "selfServicePlugin"

    app_text = (
        app_text[:feature_match.start("body")]
        + new_body
        + app_text[feature_match.end("body"):]
    )

app_tsx.write_text(app_text, encoding="utf-8")

print("Azure Self-Service source applied successfully.")
print("Frontend system: createApp + PageBlueprint")
print("Frontend page: /self-service")
print("Navigation: automatic from PageBlueprint")
print("Backend API: /api/azure-self-service")
