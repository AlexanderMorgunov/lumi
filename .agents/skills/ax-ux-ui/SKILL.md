---
name: ax-ux-ui
description: Design new DayEnglish game UI, redesign existing flows or refactor UI components while preserving behavior. Use task evidence, visual references and browser verification; pair with ax-joint-design for substantial design work. Skip technical bootstrap and isolated agreed CSS repairs.
---

# Design task behavior and visual character

Read the target product's rules and actual design-system sources. AI UX Architect
knowledge is not authority to override DayEnglish or another project's tokens,
navigation, data semantics or user authorisation.

## Choose the entry mode

For a new interface, establish the unmet task, known workaround, entry point,
adjacent conventions and completion criteria. Do not invent an existing UI defect.
For redesign, capture the current path, concrete friction, source snapshot and
useful behavior to preserve. No observed friction means an exploratory hypothesis,
not a proven need to replace the screen.

For behavior-preserving UI refactoring, read
[UI refactoring](references/ui-refactoring.md): identify affected consumers and
interaction contracts before moving styles or extracting components. This mode
does not require fresh reference research when no design decision changes.
For composition, type, color, copy or motion changes, read the relevant sections of
[game UI craft](references/game-ui-craft.md). These are project adaptations, not
instructions to install Genex or adopt its visual identity.

## Research and synthesize

Inspect real reference flows or permitted documented observations, not just a
marketing page or attractive screenshot. Connect evidence → difficulty → mechanism
→ proposed change → check. Distinguish observed, inferred and unknown behavior.
Reuse relevant Core knowledge, domain flows and authorised Project context without
silently transferring evidence or licences between them.

When using AIUX knowledge for a design decision, read
[knowledge-to-decision](references/knowledge-to-decision.md). It covers exact
card/claim selection, permitted frame discovery and inspection, decision rationale,
and completion/next-action checks. Apply it to the relevant decisions; an empty
visual list or unavailable MCP remains an explicit gap, not a reason to invent
evidence or block an otherwise authorised task. This is not needed for a routine
agreed CSS repair.

Compare materially different alternatives only where structure is uncertain.
Define entry/action/result/return, recovery, async cancellation/stale responses,
keyboard/touch/focus, large text and localisation where applicable.
When the user requests variants, compare them on a named primary design axis using
the same task, content and surrounding scene. Explain the tradeoff of each;
do not add a variant picker to routine production work.

## Make UI intentional

Choose an explicit visual direction appropriate to the task and product character.
Use the accepted «Фонарь и мох» direction in [ART_DIRECTION](../../../docs/ART_DIRECTION.md).
Before adding decoration or explanatory copy, try simplifying grouping and removing
duplication. Preserve discoverable controls and the actual grammar explanation.
When available, use VisualDesignKnowledge for composition/hierarchy, type/grid/density, color,
contrast, motion/microinteractions and visual anti-patterns. Explain original choices
and tradeoffs; do not equate unusual styling with usability or proven conversion.

For substantial flows, make and inspect an interactive HTML prototype before
production implementation. Reuse existing primitives/tokens, test narrow and large
text, keyboard/focus, loading/error/offline/recovery and reduced motion. Native
semantics are the default. Use WCAG/APG primary material for specific requirements;
check units, exceptions and platform scope rather than trusting a summary table.

Use Vercel React/performance or composition skills only for relevant React work;
read individual rules and apply the installed framework/version constraints.
Do not copy Next/RSC patterns into a Vite SPA or optimise without a bottleneck.

## Verify the actual result

Prototype checks, product browser checks, expert judgement and actual user tasks
are separate evidence. Keep visual criteria explicit alongside UX task criteria;
a technical pass does not establish expressive, appropriate UI. Record unchecked
AT/Android/manual combinations rather than marking them passed.

Deliver the chosen behavior, visual rationale, relevant card/claim versions,
observed walkthrough evidence and unresolved tradeoffs. Code reading alone is not
runtime/usability verification. The [master plan](../../../MASTER_PLAN.md)
defines this game's scope. Preserve room state and focus across dictionary/rule overlays,
separate language validity from contextual feedback, and protect readable play space at 360px.
Do not import AIUXArchitect's formal comparison protocol into ordinary game UI work.
