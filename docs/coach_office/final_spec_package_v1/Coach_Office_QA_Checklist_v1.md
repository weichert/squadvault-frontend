# Coach Office QA Checklist v1

## No-hard-coding audit
- No PFL-specific logic in components.
- No Steve/KP/Robb names in code.
- No league-specific voice in code.
- No specific trophy names in code.
- No media paths hard-coded.
- All room content comes from config, schema, or data.

## Permission tests
- Public content visible to all league members.
- Owner-only content visible only to owner.
- Relationship-only content visible only to approved visitor/owner pair.
- Specific-coach content visible only to named coaches.
- Do-not-surface content never appears.
- Private notes never appear on hero board.

## Resolver tests
- Identical inputs produce identical outputs.
- Empty inputs produce graceful empty states.
- Visitor A and Visitor B can receive different room content.
- Trophy resolver never invents awards.
- Ring resolver never invents rings.
- Board resolver never invents facts.
- Cutout resolver only uses approved cutouts.

## Visual tests
- Hero image remains beautiful with empty states.
- Hotspots do not overlap incorrectly.
- Text overlays fit board.
- Photo masks fit frames.
- Trophies fit shelves.
- Rings fit tray.
- Cutouts do not clutter room.
- Mobile view remains usable.

## Trust tests
- No unsupported factual claims.
- No private media leaks.
- No offensive visible-board content outside league settings.
- Commissioner can hide/override board messages.
- Screenshot-safe mode works.
