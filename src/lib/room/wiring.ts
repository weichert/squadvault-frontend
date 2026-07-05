// src/lib/room/wiring.ts
// Pure, node-testable seams over the room-agnostic Wiring union. Extracted from the
// (client) RoomScene so the wiring branch - including the W.2->CO `detail` extension -
// can be unit-tested without a DOM. RoomScene imports these; the tests import these;
// neither pulls in React.
import type { RoomHotspot, Wiring } from "./types";

// The wiring kind of a hotspot: route | pending | detail | inert.
export function hotspotKind(hotspot: RoomHotspot): Wiring["type"] {
  return hotspot.wiring.type;
}

// The content-map key a `detail` hotspot draws its modal body from, or null for any
// other wiring. (RoomScene looks up its `content` prop by this key.)
export function detailContentKey(hotspot: RoomHotspot): string | null {
  return hotspot.wiring.type === "detail" ? hotspot.wiring.contentKey : null;
}

// Every content key the room must supply, one per `detail` hotspot, in manifest order.
// A room whose `content` map covers exactly these keys has no orphan key and no
// unwired detail hotspot.
export function requiredContentKeys(hotspots: RoomHotspot[]): string[] {
  return hotspots
    .map(detailContentKey)
    .filter((k): k is string => k !== null);
}
