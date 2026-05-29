#!/usr/bin/env python3
"""apply_force_dynamic_to_league_pages_v1.py

Adds `export const dynamic = 'force-dynamic';` to each Server Component
page under src/app/league/[id]/ in the squadvault-frontend repo.

Rationale: these pages are Server Components reading live Supabase state.
Next.js 14 route segment caching can serve stale data until a hard refresh,
which breaks the commissioner workflow of "sync -> check page" (observed
during M4 Block 3 where a synced A3 artifact did not appear on the records
page until Cmd+Shift+R). force-dynamic skips the route segment cache.

Idempotent: re-running this script after a successful first run produces
zero changes. Files that already contain `export const dynamic` are skipped.

Anchor strategy: each target file's pre-state is asserted by:
  (a) the file existing at the expected path
  (b) the file containing at least one top-level `import ... from '...';` line
  (c) the file NOT already containing `export const dynamic`

Run from the squadvault-frontend repo root:
    python3 apply_force_dynamic_to_league_pages_v1.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

TARGETS = [
    "src/app/league/[id]/page.tsx",
    "src/app/league/[id]/approve/[artifactId]/page.tsx",
    "src/app/league/[id]/archive/page.tsx",
    "src/app/league/[id]/archive/recaps/page.tsx",
    "src/app/league/[id]/archive/recaps/[artifactId]/page.tsx",
    "src/app/league/[id]/archive/records/page.tsx",
    "src/app/league/[id]/archive/records/[artifactId]/page.tsx",
    "src/app/league/[id]/office/page.tsx",
]

DIRECTIVE_BLOCK = """// Server Component reading live Supabase state. Skip Next.js route segment
// caching so synced artifacts surface without a hard reload. See
// _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md in the
// engine repo for the full rationale.
export const dynamic = "force-dynamic";

"""

# Top-level import statement.
# Examples it matches:
#   import { foo } from "bar";
#   import foo from 'bar';
#   import type { Foo } from "bar";
IMPORT_RE = re.compile(
    r"^(import(?:\s+type)?\s.+?\s+from\s+['\"][^'\"]+['\"];?\s*)$",
    re.MULTILINE,
)

# Anchor sentinel: the directive's first line is unique enough to detect.
ALREADY_PRESENT_SENTINEL = "export const dynamic"


def needs_directive(content: str) -> bool:
    return ALREADY_PRESENT_SENTINEL not in content


def insert_after_imports(content: str, file_label: str) -> str:
    matches = list(IMPORT_RE.finditer(content))
    if not matches:
        raise RuntimeError(
            f"{file_label}: no top-level import statements found; "
            f"refusing to insert directive (anchor check failed)"
        )
    last_import = matches[-1]
    # Move past the last import's trailing newline and any blank lines that
    # follow. Insertion lands at the start of the first non-blank line after
    # the import block; DIRECTIVE_BLOCK provides its own trailing blank line
    # so the new directive is separated from the next code by exactly one
    # blank line.
    insertion_point = last_import.end()
    while insertion_point < len(content) and content[insertion_point] == "\n":
        insertion_point += 1
    return content[:insertion_point] + DIRECTIVE_BLOCK + content[insertion_point:]


def main(repo_root: Path) -> int:
    if not (repo_root / "package.json").exists():
        print(
            f"ERROR: {repo_root} does not look like a Node repo "
            "(no package.json found). Run this script from the "
            "squadvault-frontend repo root.",
            file=sys.stderr,
        )
        return 2

    changed = 0
    skipped = 0
    failed = 0

    for rel in TARGETS:
        path = repo_root / rel
        if not path.exists():
            print(f"FAIL: {rel} not found at expected path")
            failed += 1
            continue

        content = path.read_text(encoding="utf-8")

        if not needs_directive(content):
            print(f"SKIP: {rel} already contains 'export const dynamic'")
            skipped += 1
            continue

        try:
            new_content = insert_after_imports(content, file_label=rel)
            path.write_text(new_content, encoding="utf-8")
            print(f"OK:   {rel}")
            changed += 1
        except Exception as exc:
            print(f"FAIL: {rel} - {type(exc).__name__}: {exc}")
            failed += 1

    print()
    print(f"Summary: {changed} changed, {skipped} skipped, {failed} failed")
    if failed:
        print("Re-run after resolving failures; the script is idempotent.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main(Path.cwd()))
