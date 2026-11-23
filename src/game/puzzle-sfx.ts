import {
  evaluatePhrase,
  readPhrase,
  type PuzzleAction,
  type PuzzleState,
} from '../domain/puzzle';
import type { GameEffect } from './game-effects';

export function puzzleEffect(
  before: PuzzleState,
  next: PuzzleState,
  action: PuzzleAction,
): GameEffect | undefined {
  if (before === next) return;
  if (action.type === 'move') {
    if (next.feedback === 'blocked') return 'blocked';
    const phrase = evaluatePhrase(next);
    if (
      phrase.form === 'valid' &&
      phrase.inReadingFrame &&
      readPhrase(before).join(' ') !== readPhrase(next).join(' ')
    )
      return 'assembled';
    if (next.feedback === 'push') return 'push';
    if (next.x !== before.x || next.y !== before.y)
      return next.history.length % 2 ? 'step0' : 'step1';
  }
  if (action.type === 'apply')
    return !before.completed && next.completed ? 'success' : 'blocked';
  if (action.type === 'undo' && next.history.length < before.history.length)
    return 'undo';
  if (action.type === 'reset') return 'undo';
}
