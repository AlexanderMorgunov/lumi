# Use knowledge to choose and verify an interface

Use this reference when AIUX knowledge informs a substantive UX or visual choice.
The [tool guide](../../../../docs/DESIGN_TOOLS.md) points to the upstream contracts,
bindings, limits and errors and the documented local retrieval route.
Use an available authorised transport. Do not assume
the tools or this repository's skill are installed in an external project.

## Select for a decision

Start from the actual task and constraints. Identify the decisions that need help:
entry, primary action, confirmed completion, continuation, recovery and visual
hierarchy. Check which already follow from the product contract and which remain
uncertain. A high lexical score does not establish task coverage.

Search with the mechanism and task context. Choose a small relevant set of exact
card revisions, using the returned applicability, rights and match reasons. If an
essential decision is missing, refine the query or record a gap; do not accumulate
cards merely to increase the number. Distinct revisions are not independent ideas.

Use the compact decision view first with the task brief and returned card/material/
context/implementation pins. Get the exact card view when a deferred visual example,
condition or evidence limitation matters before choosing a solution. Split large
selections deliberately. Keep selection/bundle IDs separate; never attach a detail
or frame from one pinned selection to another as though its basis were identical.
Refresh changed pins from discovery rather than inventing or stripping them.

## Inspect the permitted visual material

For a visual or flow choice, call `list_visual_references` for the selected cards.
Metadata explains relevance and availability; it is not an inspected screenshot.
Use only listed reference/frame IDs with their complete media pins when calling
`get_visual_reference`. Choose the states needed to inspect the decision.

Budget by the returned dimensions/bytes and guide limits. The maximum image count
does not guarantee that all those images fit the byte budget. Split a sequence
into explicit requests when needed; preserve order and note missing states. Never
resize, truncate or substitute an unavailable frame silently. `completion.complete`
covers the requested view; `all_reference_frames_delivered` separately describes
the whole reference's image set. Text limits are not a vision budget.

Inspect the actual returned images through a client that can display them. Check
the visible state against the caption, card/claim revision, transition conditions
and observed/inferred/unknown edge. If images are not visible, report that limit.
An empty list means this selection has no available visual reference, not that
the design problem has no solution. Use a permitted alternative or an explicitly
labelled original hypothesis instead of presenting a different source as evidence.

Several states of one prototype count as one solution. Compare materially different
approaches when the structure is uncertain and sources permit it; do not claim
diversity from a different accent colour or a larger screenshot count. Own rendered
examples illustrate hypotheses; observations of their mechanics are not evidence
of another product's behavior or measured UX benefit.

## Make the decision traceable

For each consequential choice, record a compact rationale outside the product UI:

| Field        | Content                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| Decision     | User task, chosen behavior/layout and why it fits                        |
| Knowledge    | Exact card/claim refs and conditions; label hypothesis where applicable  |
| Visuals      | Reference/frame IDs actually inspected and what the images establish     |
| Alternative  | Adapted, rejected or deferred approach with a task-specific reason       |
| Limits       | Unverified transfer, missing source states and remaining questions       |
| Verification | Observable result and actual check, or proposed check if not implemented |

Keep delivered, inspected, used-in-decision, rejected and deferred material separate.
Reported use is not artifact-checked implementation or causal contribution. A plan
or memo can propose a choice; it cannot establish that a resulting UI works.
Preserve source-operation and audience limits for notes, derived work and exports.

Past owner feedback is Project evidence under its original conditions. Keep
observed behavior, appearance inspection, subjective preference and the editorial
interpretation separate. A winning prototype does not make every one of its choices
better. Retain ties, uncertainty and negative findings. Reuse a conditional lesson
only after checking the new task; do not promote a preferred icon, reset behavior
or layout into a universal Core rule.

## Verify the next meaningful action

Before implementation, state what the user will see after the primary action and
what the next action does. Distinguish a suggestion, an applied draft, a pending
operation and a confirmed result where the task has those states. Returning,
continuing entry and reviewing/editing can be appropriate under different goals;
an example is not a requirement to expose all choices as equal primary buttons.

For an implemented flow, exercise the normal path and the relevant next action,
including a repeated primary action after success. Verify that failure or an
uncertain outcome preserves the intended input and does not cause an unintended
new write; use the product's actual identity and recovery contract. Check back/
return, focus/keyboard and narrow or large-text behavior where the change affects
them. Distinguish prototype/mock feedback from actual provider or durable-write
evidence. Report missing checks rather than treating syntax or screenshots as UX
validation.

In a known-case diagnostic, record prior exposure and the exact workflow followed;
the result is development evidence. For a future controlled comparison, freeze
the task, process, model, tools, corpus/media/skill inputs and assessment before
execution. Keep a common playbook when isolating knowledge value; a changed
AIUX-only workflow measures a broader product process. Replacement of Gummble and
added value alongside it are separate questions. Do not feed learning-case outputs
or winner labels to a held-out arm or weaken its shared baseline.
