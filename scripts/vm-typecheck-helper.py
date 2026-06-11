#!/usr/bin/env python3
"""Build virtual node_modules and merged tsconfig for typecheck in VM.

The 9P mount breaks node_modules symlinks and truncates some files.
This script patches both issues so tsc can run against source.
"""
import glob as _glob
import json, os, sys, shutil

NM_SRC = sys.argv[1]  # node_modules/.pnpm
NM_DST = sys.argv[2]  # /tmp/vm-node-modules
PROJECT_DIR = sys.argv[3]

def find_dir(pattern):
    matches = _glob.glob(os.path.join(NM_SRC, pattern))
    return matches[0] if matches else None

# Start clean
if os.path.exists(NM_DST):
    try:
        shutil.rmtree(NM_DST)
    except (PermissionError, OSError) as e:
        import tempfile
        NM_DST = tempfile.mkdtemp(prefix="vm-nm-")
        print(f"  rmtree failed ({e}), using {NM_DST}")
        sys.argv[2] = NM_DST
os.makedirs(os.path.join(NM_DST, "@types"), exist_ok=True)

# Build symlink farm
links = {
    "react": find_dir("react@19.2.6/node_modules/react"),
    "react-dom": find_dir("react-dom@19.2.6*/node_modules/react-dom"),
    "next": find_dir("next@15.5.18*/node_modules/next"),
    "@types/react": find_dir("@types+react@19.2.15/node_modules/@types/react"),
    "@types/react-dom": find_dir("@types+react-dom@19.2.3*/node_modules/@types/react-dom"),
    "@types/node": find_dir("@types+node@20.17.6/node_modules/@types/node"),
    "csstype": find_dir("csstype@3.2.3/node_modules/csstype"),
}

for name, src in links.items():
    dst = os.path.join(NM_DST, name)
    if src and os.path.exists(src):
        os.symlink(src, dst)
        print(f"  linked {name} -> {src}")
    else:
        print(f"  WARNING: could not resolve {name}")

# CSS module declarations
css_decl_path = os.path.join(NM_DST, "css-modules.d.ts")
with open(css_decl_path, "w") as f:
    f.write('declare module "*.module.css" {\n')
    f.write('  const classes: { readonly [key: string]: string };\n')
    f.write('  export default classes;\n')
    f.write('}\n')
    f.write('declare module "*.css" {\n')
    f.write('  const content: string;\n')
    f.write('  export default content;\n')
    f.write('}\n')
print("  wrote css-modules.d.ts")

# Build merged tsconfig
with open(os.path.join(PROJECT_DIR, "tsconfig.base.json")) as f:
    base = json.load(f)

tsconfig_web_path = os.path.join(PROJECT_DIR, "apps", "web", "tsconfig.json")
with open(tsconfig_web_path) as f:
    web = json.load(f)

compiler = {**base.get("compilerOptions", {}), **web.get("compilerOptions", {})}

include = [x for x in web.get("include", []) if ".next" not in x]
include.append(css_decl_path)
exclude = web.get("exclude", ["node_modules"])
if ".next" not in exclude:
    exclude.append(".next")

compiler["baseUrl"] = NM_DST
compiler["paths"] = {
    "react": ["./react"],
    "react-dom": ["./react-dom"],
    "next": ["./next"],
    "next/*": ["./next/*"],
    "*": ["./@types/*", "./*"],
}
compiler["typeRoots"] = [os.path.join(NM_DST, "@types")]
compiler.pop("isolatedModules", None)

merged = {
    "compilerOptions": compiler,
    "include": include,
    "exclude": exclude,
}

TSCONFIG_OUT = sys.argv[4] if len(sys.argv) > 4 else os.path.join(NM_DST, "vm-tsconfig.json")
print(f"NM_DST={NM_DST}")
with open(TSCONFIG_OUT, "w") as f:
    json.dump(merged, f, indent=2)
print(f"  wrote {TSCONFIG_OUT}")
