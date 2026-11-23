---
name: dayenglish-studio
description: Develop this DayEnglish game in small playable stages using the existing GDD and master plan. Use for project setup, a new mechanic, a vertical slice or continuing game production; skip isolated fixes and single-asset tasks.
---

# DayEnglish production workflow

Adapted from studioigor/studioigor-skill (MIT); attribution and pinned source in [SKILLS](../../../docs/SKILLS.md). Read [project rules](../../../AGENTS.md) and [MASTER_PLAN](../../../MASTER_PLAN.md) first. Existing user decisions replace a fresh idea interview.

Work on the requested stage: foundation → UX/art direction → three mechanic scenarios → integration → chapter content → polish/release. These are milestones, not mandatory approval gates. Ordinary authorised work continues without another permission question. Style is explicitly deferred until requested; do not let an upstream workflow launch look-dev during setup.

For a substantial step, state the player-visible result and verification. Check current primary documentation when an API/version is uncertain. Keep useful sources and decisions in docs; avoid duplicate project-state databases or a second master plan.

Prototype a single consequential interaction in a small scene before producing twelve levels. For this game test a cat, a/an choice and a key → the key. Keep grammatical form, contextual interpretation and world effect separate. Short movement or playback is not evidence of learning or fun.

Run the scene, inspect it, try the complete action/result/return loop, then offer concrete things to try when player feedback is needed. Record actual feedback separately from agent judgement. Tests should protect grammar/context, Undo, saves and lifecycle rather than mirror implementation text.

For new or revised lesson dialogue, tasks and explanations, use [dayenglish-learning-copy](../dayenglish-learning-copy/SKILL.md) together with [dayenglish-level-review](../dayenglish-level-review/SKILL.md). Keep character speech natural, introduce terms clearly and preserve accepted constructions. Respect protected voiced lines; text editing does not authorise speech generation.

Keep [MASTER_PLAN](../../../MASTER_PLAN.md) current with completed work, next step and remaining uncertainty. Do not add the original Claude-only CLI, cron/autopilot, compulsory agents/worktrees, global registry, per-step commits or installation of unrelated engines. Use available Codex tools. Publication remains a separate requested action.
