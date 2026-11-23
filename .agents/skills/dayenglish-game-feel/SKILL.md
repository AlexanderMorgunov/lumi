---
name: dayenglish-game-feel
description: Improve readable feedback and keyboard/touch actions in the turn-based grammar puzzle. Use for movement, applying phrases, Undo, success and animation polish; skip lesson correctness and generic menu styling.
---

# Make an action understandable

Adapted from Yaga game-feel and Pirates input/core-loop guidance. Start with a concrete sequence: intention → named action → domain event → visible consequence → next decision. Reuse the model's events rather than repeating effects every frame.

Keyboard and touch send the same actions; a tap to see a translation must not move a block. Consume only input owned by the active game/overlay. Do not import platformer buffering, coyote time, combat shake or hold-to-repeat by default into a turn-based language puzzle.

Keep words readable during motion; do not signal correct articles through colour or position. Show grammatical validity and context mismatch distinctly. Feedback may combine motion and sound, but a visible result must work muted and with reduced motion. Never delay Undo or level continuation until speech completes.

Stop animation and speech on platform pause/close, Undo and leaving the scene. Decorative effects do not change model state, event counts or active learning time. Account for all pause reasons before resuming. Check keyboard/touch, 360px portrait, landscape, interruption/return and repeated scene entry; document actual results rather than declaring polish from a screenshot.
