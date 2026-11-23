# Refactor UI without changing the game contract

Use for extraction of components/styles, consolidation of repeated controls, or
reworking layout implementation. If the requested behavior also changes, name that
change separately and use the design workflow for it. This reference adapts Genex's
shared-system and rendered-verification approach to React/Phaser and DayEnglish SDK.

## Establish the boundary

Inspect the real screen and neighboring consumers of the shared CSS/component.
Record the affected entry, action, result and return with a screenshot or existing
test evidence. A new interface needs no invented before-state. A code-only cleanup
needs no speculative redesign or new external reference search.

Before extracting, locate who owns selection, dialogue position, room state,
pause reasons, audio and SDK requests. Preserve stable identity/keys and effect
cleanup; moving a component must not accidentally remount the scene, restart a
voice line or duplicate vocabulary capture. Read relevant React skill rules when
editing React; no Next.js patterns or new state library for this Vite SPA.

## Make the smallest complete change

- Keep domain actions in `src/domain`, scene/input adaptation in `src/game`, UI in
  `src/app`, SDK integration in `src/platform`. UI reuse is not a reason to move
  teaching correctness or platform writes into a button component.
- Consolidate a demonstrated shared contract, not merely similar markup. Dialogue,
  learning panels and menus can have different focus, pause and close semantics.
- Inspect all consumers before changing a global selector. Prefer a clear component
  boundary or role token to another increasingly specific media-query override.
  Verify short landscape explicitly when changing grid child placement.
- Preserve keyboard and touch action parity, safe areas, focus restoration and input
  blocking. Closing a panel must not consume a movement key or unpause another reason.
- Keep SDK pending/confirmed/cancelled/error distinct and offline/standalone honest.
  No localStorage substitute for account saves, no fabricated capabilities, no live
  capture or paid generation just to verify presentation.

## Verify what could regress

Use owned local browser/test sessions and existing fixtures, preserving the player's
active session. Compare before/after with the same room, content and viewport; do
not compare a loaded panel with a placeholder or a different episode.

Choose checks by the changed boundary, following [DEVELOPMENT](../../../../docs/DEVELOPMENT.md):

| Change                   | Meaningful evidence                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Spacing/type or wrapping | Render real content at affected sizes; inspect clipping and reachability                 |
| Shared control/style     | Exercise affected consumers and disabled/selected/focus states                           |
| Overlay composition      | Open, interact, close, resume keyboard/touch; preserve board and focus                   |
| Audio/SDK ownership      | Existing fixture scenarios for interruption, cancellation and repeat request             |
| Component extraction     | Same actions/results before and after; lifecycle and cleanup checks when ownership moves |

Do not write tests that only assert the new class names or restate the implementation.
Use semantic locators or stable hooks, assert behavior, and open generated screenshots:
a passing click test alone does not prove a readable composition. Browser emulation
does not prove physical phone behavior; fixture success does not prove account persistence.

Report changed behavior (or its preservation), checked consumers and relevant gaps.
Group defects by cause so one global selector does not become ten unrelated fixes.
Keep optional visual improvements separate from blocking regressions.
