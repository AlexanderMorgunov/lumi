# Compose and refine DayEnglish UI

Read only sections relevant to the changed surface. Adapted from the Genex design
workflow and Jakub Krehel's design skills; [provenance and retained licenses](../../../../docs/GENEX_SKILLS_REVIEW.md).
These techniques supplement AIUX/Gummble decisions, not replace evidence or the
accepted art direction. Exact upstream pixel values and animation recipes are not
project requirements.

## Composition and play space

- Establish what must remain visible during play, what is contextual, and what
  belongs in a deliberately opened overlay. The board and readable word blocks
  are the main content; do not turn the game into a dashboard around a small canvas.
- Group related controls with spacing and shared alignment before adding panels,
  borders or labels. Remove repeated information only when the player can still
  find the objective, rule, help and next action.
- Let scenery reach viewport edges; keep controls inside safe areas. Evaluate
  occupied space against the actual board, subtitles, portrait and touch controls
  together. A transparent overlay can still obscure words or intercept input.
- Choose layout changes where real content stops fitting. Inspect desktop,
  360px portrait fallback and short landscape (for example 800×360), including
  both sides of an affected breakpoint. Width alone does not catch height failures.
- Give hidden detail an obvious entry and return path. The lantern map should not
  gain mandatory page scrolling to accommodate permanently expanded descriptions.
  Reading panels may scroll internally when needed; keep closing and recovery reachable.

## Type and teaching text

- Preserve the established type roles. Decorative headings and dialogue may carry
  the world; English words, grammar explanations and pronunciation need clarity.
  Inspect Cyrillic, English, IPA and required weights in loaded and fallback fonts.
- Use real longest content and realistic item counts. Do not truncate the rule,
  an English word or the distinction between alternatives to make a composition fit.
  Resize, enlarge text and check wrapping instead of only shrinking fonts.
- Keep explanation and word text in DOM/readable text layers. Do not bake them
  into art or alter grammatical capitalization/punctuation merely for decoration.
- Keep product terms consistent. Buttons describe their actual action; error copy
  explains a useful next step. Preserve the cat's established voice in dialogue.
  Shorter copy is not automatically better teaching: retain the term, meaning,
  conditions and example when the lesson requires them.

## Color and state

- Reuse existing styles and semantic roles. Introduce a shared token when repeated
  consumers need the same role; avoid a new palette or full token migration for one fix.
- Distinguish selected, focus, pressed, unavailable and confirmed states. A selected
  word must remain readable and look selected, not disabled. Supply a static cue
  besides color for feedback that matters.
- Measure contrast against the actual composited surface, including translucent
  panels over scenery. For moving rain/light, inspect relevant bright and dark frames;
  a single screenshot cannot prove all-frame contrast. Use a stable text backing
  where the scene cannot provide one. Report measured pairs, not guessed ratios.
- When a fix is authorized, correct demonstrated contrast issues within scope and
  remeasure. A review-only request produces findings, not unrequested edits.

## Detail and motion

- Check optical alignment of icons, label baselines and nested surfaces. Enabled
  controls need consistent affordances and visible focus; disabled controls must
  not look ready to activate. Preserve drag and text-selection cursors where useful.
- Name transitioned properties; avoid blanket transitions that animate layout or
  theme changes unintentionally. Do not add a motion dependency for a simple state.
- Make repeated actions responsive and animations interruptible. No staggered
  entrance on every word selection. Do not require a particular easing or press
  scale from upstream when it conflicts with the game's existing feedback.
- Reduced motion and muted audio must leave state changes understandable. Inspect
  interrupted playback/closing as well as a complete animation. Slowed playback can
  diagnose flicker but does not replace checking normal timing.

## Alternatives and difficult states

When alternatives are requested, name their primary axis (such as persistent HUD
versus contextual controls), keep content and initial state comparable, and show
each at actual size with the surrounding scene. Match the requested number and
scope; vary more than color alone. Keep experiments out of the shipped path, retain
frozen comparisons, and integrate the selected direction when authorized.

For changed components, choose reachable states: long request, expanded dictionary,
selected/disabled control, capture pending/saved/cancelled/failed, unavailable audio,
or external pause. Do not fabricate states the component cannot receive. Use real
components and local fixtures for checks; mark simulated services. An additional
stress-test gallery is a deliverable only when requested, not mandatory for every fix.

Verify both visible outcome and action/return path. Keep observed failures separate
from preference and predictions. Stop after relevant checks pass; record remaining
coverage gaps without inventing a usability verdict.
