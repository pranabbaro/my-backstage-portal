#!/usr/bin/env python3
from pathlib import Path
import json
import re
import shutil
import sys

repo = Path.cwd()
bs = repo / "backstage"

app_tsx = bs / "packages" / "app" / "src" / "App.tsx"
sidebar_tsx = bs / "packages" / "app" / "src" / "modules" / "nav" / "Sidebar.tsx"
app_pkg = bs / "packages" / "app" / "package.json"
backend_index = bs / "packages" / "backend" / "src" / "index.ts"
backend_pkg = bs / "packages" / "backend" / "package.json"

required = [
    app_tsx,
    sidebar_tsx,
    app_pkg,
    backend_index,
    backend_pkg,
]

missing = [str(path) for path in required if not path.exists()]

if missing:
    print("Missing expected Backstage files:")
    print("\n".join(missing))
    sys.exit(1)

# ---------------------------------------------------------------
# Frontend page
# ---------------------------------------------------------------
page_dir = (
    bs
    / "packages"
    / "app"
    / "src"
    / "components"
    / "selfService"
)
page_dir.mkdir(parents=True, exist_ok=True)

(page_dir / "SelfServicePage.tsx").write_text(
    (
        repo
        / "overlay"
        / "frontend"
        / "SelfServicePage.tsx"
    ).read_text(encoding="utf-8"),
    encoding="utf-8",
)

module_dir = (
    bs
    / "packages"
    / "app"
    / "src"
    / "modules"
    / "selfService"
)
module_dir.mkdir(parents=True, exist_ok=True)

(module_dir / "index.tsx").write_text(
    (
        repo
        / "overlay"
        / "frontend"
        / "selfServiceFrontendPlugin.tsx"
    ).read_text(encoding="utf-8"),
    encoding="utf-8",
)

# ---------------------------------------------------------------
# Register frontend plugin in the NEW Backstage frontend system
# ---------------------------------------------------------------
app_text = app_tsx.read_text(encoding="utf-8")

if (
    "@backstage/frontend-defaults" not in app_text
    or "createApp" not in app_text
):
    print(
        "App.tsx is not the expected "
        "createApp() frontend-system structure"
    )
    sys.exit(1)

frontend_import = (
    "import { selfServicePlugin } "
    "from './modules/selfService';"
)

if frontend_import not in app_text:
    imports = list(
        re.finditer(
            r"(?m)^import .*?;\s*$",
            app_text,
        )
    )

    if not imports:
        print("Could not find App.tsx import block")
        sys.exit(1)

    pos = imports[-1].end()
    app_text = (
        app_text[:pos]
        + "\n"
        + frontend_import
        + app_text[pos:]
    )

without_import = re.sub(
    r"import\s+\{\s*selfServicePlugin\s*\}"
    r".*?;\s*",
    "",
    app_text,
)

if "selfServicePlugin" not in without_import:
    feature_match = re.search(
        r"(features\s*:\s*\[)"
        r"(?P<body>[\s\S]*?)"
        r"(\])",
        app_text,
    )

    if not feature_match:
        print(
            "Could not find features: [...] in App.tsx"
        )
        sys.exit(1)

    body = feature_match.group("body")
    stripped = body.rstrip()

    if stripped and not stripped.endswith(","):
        new_body = stripped + ", selfServicePlugin"
    elif stripped:
        new_body = stripped + " selfServicePlugin"
    else:
        new_body = "selfServicePlugin"

    app_text = (
        app_text[: feature_match.start("body")]
        + new_body
        + app_text[feature_match.end("body") :]
    )

app_tsx.write_text(
    app_text,
    encoding="utf-8",
)

# ---------------------------------------------------------------
# Put Self Service explicitly in the existing Sidebar
# ---------------------------------------------------------------
sidebar_text = sidebar_tsx.read_text(encoding="utf-8")

sidebar_item = "{nav.take('page:azure-self-service')}"

if sidebar_item not in sidebar_text:
    catalog_line = "{nav.take('page:catalog')}"
    scaffolder_line = "{nav.take('page:scaffolder')}"

    if scaffolder_line in sidebar_text:
        sidebar_text = sidebar_text.replace(
            scaffolder_line,
            scaffolder_line
            + "\n        "
            + sidebar_item,
            1,
        )
    elif catalog_line in sidebar_text:
        sidebar_text = sidebar_text.replace(
            catalog_line,
            catalog_line
            + "\n        "
            + sidebar_item,
            1,
        )
    else:
        print(
            "Could not find a safe Sidebar "
            "insertion point"
        )
        sys.exit(1)

sidebar_tsx.write_text(
    sidebar_text,
    encoding="utf-8",
)

# ---------------------------------------------------------------
# Modular backend
# ---------------------------------------------------------------
backend_src = (
    bs
    / "packages"
    / "backend"
    / "src"
)

backend_overlay = (
    repo
    / "overlay"
    / "backend"
)

target_folder = backend_src / "selfService"

if target_folder.exists():
    shutil.rmtree(target_folder)

shutil.copytree(
    backend_overlay / "selfService",
    target_folder,
)

shutil.copy2(
    backend_overlay / "selfServicePlugin.ts",
    backend_src / "selfServicePlugin.ts",
)

backend_text = backend_index.read_text(
    encoding="utf-8"
)

# Remove older experimental registrations if they still exist.
backend_text = backend_text.replace(
    "backend.add("
    "import('@internal/plugin-cloud-provisioning-backend')"
    ");",
    "",
)
backend_text = backend_text.replace(
    "backend.add("
    "import('@internal/plugin-cloud-self-service-backend')"
    ");",
    "",
)

plugin_import = (
    "import selfServicePlugin "
    "from './selfServicePlugin';"
)

if plugin_import not in backend_text:
    marker = "const backend = createBackend();"
    pos = backend_text.find(marker)

    if pos == -1:
        print(
            "Could not find const backend = "
            "createBackend();"
        )
        sys.exit(1)

    backend_text = (
        backend_text[:pos]
        + plugin_import
        + "\n\n"
        + backend_text[pos:]
    )

if "backend.add(selfServicePlugin);" not in backend_text:
    backend_text = backend_text.replace(
        "const backend = createBackend();",
        "const backend = createBackend();\n"
        "backend.add(selfServicePlugin);",
        1,
    )

backend_index.write_text(
    backend_text,
    encoding="utf-8",
)

backend_data = json.loads(
    backend_pkg.read_text(encoding="utf-8")
)

backend_data.setdefault("dependencies", {})
backend_data["dependencies"].setdefault(
    "express",
    "^4.21.2",
)

backend_data.setdefault("devDependencies", {})
backend_data["devDependencies"].setdefault(
    "@types/express",
    "^4.17.23",
)

backend_pkg.write_text(
    json.dumps(
        backend_data,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

print("")
print("Self-Service V6 preparation complete.")
print("")
print("Frontend:")
print("  /self-service")
print("  Self-Service Market")
print("  Sidebar registration")
print("")
print("Backend:")
print("  /api/azure-self-service/config")
print("  /api/azure-self-service/deploy/vm")
print("  /api/azure-self-service/deploy/storage")
print("  /api/azure-self-service/deploy/app-service")
print("")
print("Backend architecture:")
print("  selfService/router.ts")
print("  selfService/azureClient.ts")
print("  selfService/config.ts")
print("  selfService/validation.ts")
print("  selfService/services/*")
