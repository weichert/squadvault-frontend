#!/usr/bin/env bash
set -euo pipefail

# apply_login_suspense_buildfix_v1.sh
# Topic: make `next build` pass.
#   1. Wrap /auth/login (a client component using useSearchParams) in a
#      <Suspense> boundary. Without it, Next 14 fails prerender at build time.
#   2. Remove the empty duplicate next.config.mjs (real config is next.config.js).
# Idempotent + anchor-asserting. Does NOT stage, commit, or push.
# Run from the frontend repo root: bash apply_login_suspense_buildfix_v1.sh

python3 - <<'PYEOF'
import pathlib

repo = pathlib.Path(".")
pkg = repo / "package.json"
login = repo / "src/app/auth/login/page.tsx"
mjs = repo / "next.config.mjs"

# --- anchor: confirm we are at the frontend repo root ---
if not pkg.exists() or '"next dev"' not in pkg.read_text():
    raise SystemExit("ABORT: not the frontend repo root (package.json with \"next dev\" not found)")
if not login.exists():
    raise SystemExit("ABORT: src/app/auth/login/page.tsx missing - unexpected repo shape")

s = login.read_text()

# --- login Suspense wrap (idempotent) ---
if "function LoginForm()" in s or "import { Suspense" in s:
    print("login: already wrapped in Suspense - skipping (idempotent)")
else:
    a1 = "import { useState } from 'react';"
    a2 = "export default function LoginPage() {"
    if a1 not in s:
        raise SystemExit("ABORT: react import anchor not found in login page")
    if s.count(a2) != 1:
        raise SystemExit("ABORT: LoginPage anchor missing or not unique")
    s = s.replace(a1, "import { Suspense, useState } from 'react';")
    s = s.replace(a2, "function LoginForm() {")
    s = s.rstrip() + (
        "\n\nexport default function LoginPage() {\n"
        "  return (\n"
        "    <Suspense fallback={null}>\n"
        "      <LoginForm />\n"
        "    </Suspense>\n"
        "  );\n"
        "}\n"
    )
    login.write_text(s)
    print("login: wrapped useSearchParams component in <Suspense> boundary")

# --- remove empty duplicate next config (idempotent) ---
if mjs.exists():
    body = mjs.read_text()
    if "const nextConfig = {}" in body or len(body.strip()) < 120:
        mjs.unlink()
        print("next.config.mjs: removed (empty duplicate config)")
    else:
        print("next.config.mjs: present but NOT the empty stub - left untouched, review manually")
else:
    print("next.config.mjs: already absent - skipping (idempotent)")

print("DONE - no files staged, committed, or pushed")
PYEOF
