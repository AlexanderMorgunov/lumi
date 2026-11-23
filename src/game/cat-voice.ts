import manifest from './cat-voice-manifest.json';
import stationManifest from './station-voice-manifest.json';
import { dialogueSpeaker } from '../domain/dialogue';
import { firstDialogue } from '../domain/first-dialogue';
import { firstLesson } from '../domain/first-lesson';
import { dialogueVoiceLine, type Conversation } from '../domain/dialogue';
import type { PuzzleState } from '../domain/puzzle';

export function firstEpisodeLine(conversation: string | null, index: number) {
  if (conversation === 'rule')
    return [
      ...firstDialogue.rule.lines,
      ...firstLesson.map((part) => part.text),
    ][index];
  if (conversation === 'meet') return firstDialogue.meet.lines[index];
  if (conversation === 'success') return firstDialogue.success.lines[index];
  return undefined;
}

export function catVoiceClip(
  room: Pick<PuzzleState, 'episode' | 'definition' | 'explanations'>,
  conversation: Conversation | null,
  index: number,
) {
  const line = dialogueVoiceLine(room, conversation, index);
  if (!line) return undefined;
  if (room.definition.message) {
    const clips: readonly ((typeof manifest.clips)[number] & {
      speaker: string;
      voiceId: string;
    })[] = stationManifest.clips;
    return clips.find(
      (clip) =>
        clip.id === line.id &&
        clip.sourceText === line.text &&
        clip.speaker === dialogueSpeaker(room, conversation, index),
    );
  }
  // A changed subtitle must never silently play an obsolete grammar explanation.
  return manifest.clips.find(
    (clip) => clip.id === line.id && clip.sourceText === line.text,
  );
}
