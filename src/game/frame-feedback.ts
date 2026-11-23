import { evaluatePhrase, type Room } from '../domain/puzzle';

export function frameFeedback(room: Room): 'empty' | 'assembled' | 'success' {
  if (room.completed) return 'success';
  const evaluation = evaluatePhrase(room);
  // Assembly is a language-form cue, never a spoiler of contextual correctness.
  return evaluation.form === 'valid' && evaluation.inReadingFrame
    ? 'assembled'
    : 'empty';
}
