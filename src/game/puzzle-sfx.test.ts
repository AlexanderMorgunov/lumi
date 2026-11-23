import { expect, it } from 'vitest';
import {
  createPuzzle,
  reducePuzzle,
  type PuzzleAction,
} from '../domain/puzzle';
import { puzzleEffect } from './puzzle-sfx';

it('distinguishes assembly, completion and Undo using real puzzle transitions', () => {
  let state = createPuzzle();
  const sounds = [];
  for (const action of [
    { type: 'move', direction: 'right' },
    { type: 'move', direction: 'left' },
    { type: 'move', direction: 'up' },
    { type: 'apply' },
    { type: 'undo' },
  ] satisfies PuzzleAction[]) {
    const next = reducePuzzle(state, action);
    sounds.push(puzzleEffect(state, next, action));
    state = next;
  }
  expect(sounds).toEqual(['step0', 'step1', 'assembled', 'success', 'undo']);
});

it('uses a soft blocked cue for an obstacle or incomplete request, with no cue for a no-op', () => {
  const state = createPuzzle();
  expect(puzzleEffect(state, state, { type: 'undo' })).toBeUndefined();
  expect(
    puzzleEffect(state, reducePuzzle(state, { type: 'apply' }), {
      type: 'apply',
    }),
  ).toBe('blocked');
  const edge = { ...state, x: 0, y: 0 };
  const move = { type: 'move', direction: 'left' } as const;
  expect(puzzleEffect(edge, reducePuzzle(edge, move), move)).toBe('blocked');
});
