# Observations - R3 click-through finding: renamed-HEIC bypasses the D6 gate

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-round3`. Source: founder round-3 click-through (non-blocking finding).
Supersedes nothing; this is a new finding folded forward.

## Finding

Item `7048e1a0`: `file` reports **"ISO Media, HEIF Image HEVC"** despite an
`image/jpeg` MIME and a `.jpg` extension. The D6 HEIC gate trusts extension-derived
`file.type` (and an extension regex), so a HEIC/HEVC file renamed to `.jpg` passes the
gate, uploads, and then fails thumbnail generation (the browser canvas cannot decode
HEVC). The honest "export as JPEG" message never fires because the file lies about its
type by name.

## Fix 1 - content sniffing (FOLDED INTO R4-D3, not built this round)

Magic-byte content sniffing in the client pre-check. R4-D3 (deterministic duplicate
detection) already reads the full bytes to compute the sha256 content hash, so sniff the
first 12 bytes **in the same pass** - no extra read. HEIC/HEIF brand markers live at
bytes 4-12: the box type `ftyp` at offset 4 followed by a brand of `heic`/`heix`/
`hevc`/`heif`/`mif1`/`msf1`. Refuse by CONTENT with the same honest D6 message
("export as JPEG"), independent of extension or claimed MIME. The 415 grant-route
backstop stays. This makes the gate trust bytes, not names.

Carry-forward: when Round 4 starts off `main`, R4-D3's client hash pass MUST include this
sniff. Recorded here so it is not lost between sessions.

## Fix 2 - name the unreadable item (DONE this round, `609398e`)

Backfill's "N could not be read" summary was unidentifiable - an unreadable, untagged
item gave no handle to find it. The GET `/api/av-room/thumb` targets now carry
`upload_note` + `created_at`, and the backfill names each failure (short id + its note or
ingest date), e.g. `7048e1a0 (2019-03-04)`. Gates green (type-check / build /
governance 113-0). Lands on PR #14.

## Item disposition

`7048e1a0`: **none.** It is an already-withdrawn throwaway; the placeholder fallback is
the correct behavior for it. No data action.
