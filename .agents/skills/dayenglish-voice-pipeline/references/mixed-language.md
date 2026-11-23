# Russian explanations with English examples

## Before synthesis

Read the displayed line in its teaching context. Keep a separate exact spoken request; changing it must change the request hash and asset URL. Keep the approved cast/model. A model recommended by an upstream skill is not permission to replace Will, Matilda or Garry.

Prefer one continuous take for a dialogue line. Do not split Russian prepositions or every English token into separate API calls: such fragments lose context and accumulate provider pauses. Do not add filler such as «в записи» or «со словом» automatically. If a phrase needs rewriting, review the whole sentence using learning-copy and level-review first.

Distinguish these cases explicitly:

| Context                      | Intended pronunciation      | Trap                                                |
| ---------------------------- | --------------------------- | --------------------------------------------------- |
| pronoun I                    | /aɪ/                        | Roman numeral one, Russian «и»                      |
| letter i omitted from is     | letter name /aɪ/            | not the vowel /ɪ/ in is                             |
| letter a omitted from am/are | letter name /eɪ/            | not the vowel /æ/ in am                             |
| article a named in isolation | citation form /eɪ/          | contextless A may be misread                        |
| article a within a robot     | natural weak /ə/ is correct | do not force every article to a letter-name reading |
| Russian апостроф             | апостро́ф, апостро́фом        | stress on the last syllable of the stem             |

For I versus one, `textNormalization: "off"` prevents the API normalization pass; it does not guarantee the acoustic result. Omit enforced language for a mixed take. `languageCode: "ru"` or `"en"` is for genuinely monolingual input, not a way to mark alternating spans.

The owner approved the continuous Matilda take `chapter-02-09-task-02-whole-02` on 22.11: Russian narration, English box/boxes, English letter names X `/ɛks/`, E `/iː/`, S `/ɛs/`, no language enforcement or cuts. For spelling rules, Y `/waɪ/`, R `/ɑːr/` and sequences of letter names serve the same role. Do not confuse a written ending named by letters with its pronunciation inside a word. The accepted pilot is evidence for this take, not a guarantee for every voice or line.

The current official FAQ says v3 supports native IPA, while the main pronunciation guide now demonstrates v4. Treat v3 phonetic input as a documented but audition-dependent technique. Keep exact substitutions and mark output unreviewed until heard. Do not generalize this to SSML phoneme/break tags: v3 does not support SSML breaks. No arbitrary IPA strings, Cyrillic transliteration or aliases for full English phrases. The initial repair used isolated I/i and a; the accepted boxes pilot and chapter follow-up add English names of letters in spelling rules. Full English examples remain English. Stress marks affect only spoken input.

## Repair and acceptance

Audit all lines requested, including task, success and wrong/correct feedback. Record source hash, active file hash, tiny fragments, automatic filler, ambiguous letters, original joins and actual current assembly. Distinguish original joins already repaired from active defects. Waveform silence is evidence for a pause, not a pronunciation verdict.

For existing fragmented audio, trim only verified near-silent edges through `scripts/lib/speech-joins.mjs`: 80 ms head guard, 100 ms tail guard, samples no louder than 32/32768. Keep all voiced samples byte-identical. Never cut phonemes using character timestamps, force zero gaps, crossfade consonants, or remove expressive pauses inside a sentence. A short/noisy edge or already clipped sound needs a new take, not more trimming.

Prepare a bounded repair plan and cost before paid calls. One take per selected line; no automatic paid retries. Keep receipt/cache safeguards. Save originals and a listening comparison. Rebuild mouth cues from final compressed audio, change URLs, verify untouched clips and test interruptions/mute on desktop/mobile. Distinguish generated, integrated and heard. Never report all pronunciation fixed based on API success, ASR or a silence scan.

For the whole-chapter follow-up use `scripts/chapter-bilingual-voice.mjs` and `docs/voice/chapter-02-bilingual-plan.json`; integration/verification is `scripts/station-speech-repair.mjs install|verify chapter`. The preceding `station-speech-repair-plan.json` is earlier provenance. Old installers must not overwrite newer takes. Do not reuse a dated plan as a template for a new batch without reading its scope.

The API [introduction](https://elevenlabs.io/docs/api-reference/introduction) documents `character-cost` and `request-id` response headers. Save them in receipts. Reserve the next request's full model estimate before calling, then account for its reported charge; if the cost header is absent, keep the full reservation. A subscription counter may lag. Do not rely on a guessed discount or expand the owner's scope because a take was cheap. Lack of history-read permission does not prove speech generation is unavailable.

## Sources and adaptation, 22.11.2026

- [Official ElevenLabs text-to-speech skill](https://github.com/elevenlabs/skills/blob/main/text-to-speech/SKILL.md), MIT. Reviewed model selection, language enforcement and exact-request practice. No upstream code or skill text copied; these project instructions are an independent adaptation. Not installed globally; onboarding and a v4 default were not adopted.
- [Speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert): normalization, language enforcement, seeds. Continuity parameters exist in the general API but must not be assumed to work identically for every model.
- [Pronunciation FAQ](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-force-a-certain-pronunciation-of-a-word-or-name): v3 native IPA and spelling techniques.
- [Best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices): model-dependent pronunciation and pauses. A reusable skill helps avoid known mistakes; it does not validate the resulting sound.
