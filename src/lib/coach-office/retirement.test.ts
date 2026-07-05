// src/lib/coach-office/retirement.test.ts
// G2 obligation T7.5 — retirement completeness for D-1 Option A. After OfficeShell +
// HotspotModal are retired (their content-modal role is now the room-agnostic RoomScene
// + RoomModal), NO source file may still import them. Guards against the two-modal-
// systems ambiguity the decision exists to remove. Walks src/, node env.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("retired components are fully unwired (T7.5)", () => {
  const files = walk(SRC);

  it("the retired files no longer exist", () => {
    expect(existsSync(path.join(SRC, "components/coach-office/office-shell.tsx"))).toBe(false);
    expect(existsSync(path.join(SRC, "components/coach-office/hotspot-modal.tsx"))).toBe(false);
  });

  it("no source file imports OfficeShell or HotspotModal (or their module paths)", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const importsModule =
        /from\s+["'][^"']*coach-office\/(office-shell|hotspot-modal)["']/.test(src);
      const importsSymbol =
        /\bimport\b[^;]*\b(OfficeShell|HotspotModal)\b[^;]*from/.test(src);
      if (importsModule || importsSymbol) offenders.push(path.relative(ROOT, f));
    }
    expect(offenders).toEqual([]);
  });
});
