# Claude Code Master Implementation Prompt - Coach Office v1

You are implementing the SquadVault Coach Office Product Surface v1.

## Non-negotiable rules
- Do not hard-code any specific league, coach, team, joke, trophy, photo, video, cardboard cutout, or board message.
- All content must come from data records, configuration, manifests, schemas, or approved assets.
- Keep logic deterministic.
- Do not invent facts.
- Do not expose private content.
- Do not build analytics, predictions, rankings, or engagement-maximization loops.
- Prefer small explicit resolvers over broad abstractions.
- Build reusable platform capability, not a custom PFL-only experience.

## Build target
Implement a reusable Coach Office surface that supports:
1. Hero room image with manifest-driven hotspots.
2. Owner-based personalization.
3. Trophy Display Resolver.
4. Ring Box Resolver.
5. Board Messaging System.
6. Relationship-Aware Office Surface v1.
7. Personal Media frame/gallery support.
8. Easter Egg System.
9. Funny Cardboard Cutout System.
10. Visibility and permission enforcement.

## Implementation order
1. Static room shell.
2. Hotspot manifest.
3. Placeholder modals.
4. Coach office profile loading.
5. Trophy/ring owner personalization.
6. Board visible message.
7. Relationship-aware resolver.
8. Photo frame resolver.
9. Easter egg resolver.
10. Cardboard cutout resolver.
11. QA tests.

## Acceptance tests
- Different coach IDs render different offices using data only.
- Same office owner with different visitors can render different board/photos/Easter eggs.
- No private content is visible to unauthorized visitors.
- Trophy/ring records are not invented.
- Cutouts are configurable and permission-bound.
- No PFL-specific, Steve-specific, KP-specific, or hard-coded league logic exists.
