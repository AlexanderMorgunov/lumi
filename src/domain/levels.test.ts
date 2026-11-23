import { expect, it } from 'vitest';
import { levels, validateLevel, type LevelDefinition } from './levels';
import {
  createPuzzle,
  evaluatePhrase,
  evaluateWords,
  isWall,
  readPhrase,
  reducePuzzle,
} from './puzzle';

it('validates authored maps and rejects unusable or contradictory definitions', () => {
  for (const definition of Object.values(levels))
    expect(validateLevel(definition)).toEqual([]);
  expect(validateLevel({ ...levels.egg, columns: 0 })).toContain(
    'Invalid board dimensions',
  );
  expect(validateLevel({ ...levels.egg, slots: [{ x: 99, y: 0 }] })).toContain(
    'Invalid reading slots',
  );
  expect(
    validateLevel({
      ...levels.egg,
      pieces: [...levels.egg.pieces, levels.egg.pieces[0]!],
    }),
  ).toContain('Duplicate/empty piece ID');
  expect(
    validateLevel({
      ...levels.egg,
      answers: [...levels.egg.answers, { words: ['a', 'egg'], goal: true }],
    }),
  ).toContain('Conflicting answer patterns');
  expect(
    validateLevel({
      ...levels.egg,
      answers: [{ words: ['the', 'egg'], goal: true }],
    }),
  ).toContain('Goal words unavailable');
});

// Engineering fixtures, not published lessons or a general English grammar.
const sentence: LevelDefinition = {
  id: 'test-sentence',
  revision: 1,
  columns: 9,
  rows: 5,
  walls: [{ x: 8, y: 4 }],
  slots: [
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 5, y: 0 },
  ],
  start: { x: 8, y: 3 },
  pieces: [
    { id: 'subject', kind: 'word', word: 'I', x: 2, y: 0 },
    { id: 'verb', kind: 'word', word: 'am', x: 3, y: 0 },
    { id: 'article-one', kind: 'word', word: 'a', x: 4, y: 0 },
    { id: 'noun', kind: 'word', word: 'robot', x: 5, y: 0 },
    { id: 'article-two', kind: 'word', word: 'a', x: 6, y: 2 },
  ],
  answers: [{ words: ['I', 'am', 'a', 'robot'], goal: true }],
  mistakes: [],
};
it('supports four-word answers and duplicate words with independent identities', () => {
  expect(validateLevel(sentence)).toEqual([]);
  const state = createPuzzle('egg', sentence);
  expect(readPhrase(state)).toEqual(['I', 'am', 'a', 'robot']);
  expect(evaluatePhrase(state).goal).toBe(true);
  const before = { ...state, x: 5, y: 2 };
  const pushed = reducePuzzle(before, { type: 'move', direction: 'right' });
  expect(pushed.pieces.find((p) => p.id === 'article-two')?.x).toBe(7);
  expect(pushed.pieces.find((p) => p.id === 'article-one')?.x).toBe(4);
  expect(reducePuzzle(pushed, { type: 'undo' }).pieces).toEqual(before.pieces);
  expect(reducePuzzle(pushed, { type: 'reset' }).definition).toBe(sentence);
  expect(isWall({ x: 7, y: 3 }, sentence)).toBe(false);
  expect(isWall({ x: 8, y: 4 }, sentence)).toBe(true);
  expect(isWall({ x: 9, y: 0 }, sentence)).toBe(true);
});
it('separates a grammatical the phrase from a goal and prioritizes the filled frame', () => {
  const definition: LevelDefinition = {
    ...levels.egg,
    answers: [
      ...levels.egg.answers,
      {
        words: ['the', 'egg'],
        goal: false,
        feedback: 'Нужен любой экземпляр, а не уже определённый.',
      },
    ],
  };
  expect(evaluateWords(definition, ['the', 'egg'])).toMatchObject({
    form: 'valid',
    goal: false,
  });
  const state = createPuzzle('egg', definition);
  const conflict = {
    ...state,
    pieces: [
      { id: 'wrong-a', kind: 'word' as const, word: 'a', x: 3, y: 0 },
      { id: 'egg-one', kind: 'word' as const, word: 'egg', x: 4, y: 0 },
      { id: 'an', kind: 'word' as const, word: 'an', x: 2, y: 2 },
      { id: 'egg-two', kind: 'word' as const, word: 'egg', x: 3, y: 2 },
    ],
  };
  expect(evaluatePhrase(conflict)).toMatchObject({
    form: 'article',
    inReadingFrame: true,
    goal: false,
  });
  const contextual = {
    ...state,
    pieces: [
      { id: 'the', kind: 'word' as const, word: 'the', x: 3, y: 0 },
      { id: 'egg', kind: 'word' as const, word: 'egg', x: 4, y: 0 },
    ],
  };
  expect(reducePuzzle(contextual, { type: 'apply' })).toMatchObject({
    feedback: 'context',
    completed: false,
  });
});
