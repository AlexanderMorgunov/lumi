---
name: dayenglish-voice-pipeline
description: Cast and generate DayEnglish character dialogue and cat vocal effects through speech APIs, then prepare reviewed audio assets and independent voice controls. Use for voice auditions, dialogue dubbing and changed-line regeneration; not ordinary text editing or microphone transcription.
---

# DayEnglish character voices

Produce a small, listenable casting sample before recording a chapter. For the workshop cat, use the [casting brief](references/casting.md). Provider selection and current project findings are in [the research](../../../docs/CAT_VOICE_RESEARCH.md). These are candidates, not an approved voice or a listening test.

## Scope and generation

- Research or preparing this skill does not authorize paid generation. A request to generate a specified pilot/batch authorizes that scope; do not request confirmation again for every clip. Before a larger batch, make its lines, takes, provider and estimated usage reviewable. Stop after the requested scope, on an API error or on uncertain billing; do not retry automatically or silently change providers.
- Prefer offline asset production: API calls from an authoring script, reviewed files served with the game. Never put a provider key in React, a VITE variable, a manifest or a public asset. Use `ELEVENLABS_API_KEY` in the authoring process environment; do not print it or ask for it in chat.
- For ElevenLabs, read [API usage](references/elevenlabs.md). The included Node helper supports voice previews, speech with an existing voice ID and sound effects. It defaults to a network-free dry run. It does not save a preview as a persistent provider voice or integrate assets into the game.
- Keep stable line IDs and both display text and spoken text. Expand visual notation such as a/an and → for speech. Do not replace displayed English with Russian respelling or change a rule's conditions. Phonetic syntax in spoken input requires model-specific documentation and a listening check; it is not ordinary prose. Review spoken adaptations beside the displayed source.
- For Russian narration with English examples, first read [mixed-language speech](references/mixed-language.md). Prefer a continuous sentence/line; never automatically split at every language change. Separate letters, pronouns, articles and word sounds when specifying pronunciation. Multilingual support does not prove clean switching. Preserve the current on-demand English word player.
- Record provider, model, voice ID, exact request, source-text hash, take and provenance. Keep unreviewed output under `artifacts/voice/`. The helper caches exact jobs; changing text or settings produces a new job. A new take needs a new ID or seed. A seed is not a guarantee of identical speech.

## Casting and review

Compare the same short script at comparable loudness. Check Russian stress, Люми/Марта, a key/an apple/the apples, plural -s, absence of added words, voice consistency and whether the tone becomes tiring over several lines. Do not infer auditory quality from a successful HTTP response, ASR transcript or waveform. If listening is unavailable, deliver samples for listening and label them unreviewed.

Use separate short purr/chirp/meow assets at authored moments. They must not cover a grammar example, fire on every error or randomly change during replay. Do not promise that a text tag such as `[purr]` generates a convincing animal sound. For the cat, start with a friendly greeting and a quiet satisfied response after a completed request.

## Game integration, when requested

- Add a dedicated cat-voice setting and repeat button. Muting the cat immediately stops his speech and vocal effects, while manual English pronunciation remains available. World effects remain independent. Subtitles stay visible; Next never waits for audio to end.
- Only one foreground voice at a time. A clicked English word interrupts the cat. Next, exit, Undo/restart, user/host pause, hidden tab and SDK closed cancel pending playback. Returning does not resurrect an obsolete line. Handle delayed loads and rejected autoplay without blocking play.
- Match audio to the current line ID and source hash; missing or stale audio falls back to readable text. Preload narrowly. A synthesis service is not required during gameplay; offline playback still requires cached/downloaded assets.
- Settings persistence follows the existing DayEnglish SDK save design. Do not add a separate localStorage save system as part of audio work.
- Validate mute, repeat, interruption, pause/resume, missing files and mobile playback using the existing tests and browser workflow. Check the actual clip by listening before calling the voice production-ready.

Report generated versus reviewed versus integrated files separately. Update the existing MASTER_PLAN with actual results. Follow the user's current choice over this skill's default casting/provider recommendation.
