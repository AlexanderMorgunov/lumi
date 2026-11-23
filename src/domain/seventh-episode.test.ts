import { expect, it } from 'vitest';
import {
  createPuzzle,
  evaluatePhrase,
  readPhrase,
  reducePuzzle,
  type Direction,
} from './puzzle';

const right: Direction[] = [
  'up',
  'up',
  'down',
  'right',
  'right',
  'up',
  'left',
  'left',
  'down',
  'left',
  'up',
];
it('distinguishes form, contextual reference and delivery with all three physical article choices', () => {
  const start = createPuzzle('theApple');
  const routes: {
    route: Direction[];
    words: string[];
    feedback: string;
    form: string;
  }[] = [
    {
      route: ['up', 'up', 'down', 'left', 'up'],
      words: ['an', 'apple'],
      feedback: 'context',
      form: 'valid',
    },
    {
      route: [
        'up',
        'up',
        'down',
        'left',
        'left',
        'left',
        'left',
        'up',
        'right',
        'right',
        'down',
        'right',
        'up',
      ],
      words: ['a', 'apple'],
      feedback: 'article',
      form: 'article',
    },
  ];
  let state = start;
  for (const { route, words, feedback, form } of routes) {
    for (const direction of route)
      state = reducePuzzle(state, { type: 'move', direction });
    expect(readPhrase(state)).toEqual(words);
    expect(evaluatePhrase(state)).toMatchObject({ form, goal: false });
    state = reducePuzzle(state, { type: 'apply' });
    expect(state.feedback).toBe(feedback);
    expect(state.reference).toBe(start.reference);
    for (let i = 0; i < route.length; i++)
      state = reducePuzzle(state, { type: 'undo' });
    expect(state.pieces).toEqual(start.pieces);
  }
  for (const direction of right)
    state = reducePuzzle(state, { type: 'move', direction });
  expect(readPhrase(state)).toEqual(['the', 'apple']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state).toMatchObject({ completed: true, deliveredItem: true });
  expect(state.reference?.objects.map((o) => [o.id, o.location])).toEqual([
    ['keeper-apple', 'bag'],
    ['pantry-apple', 'table'],
    ['workshop-apple', 'table'],
  ]);
  state = reducePuzzle(state, { type: 'undo' });
  expect(state.reference).toEqual(start.reference);
  expect(state.attempts).toHaveLength(3);
  state = reducePuzzle(state, { type: 'hint' });
  state = reducePuzzle(state, { type: 'reset' });
  expect(state.reference).toEqual(start.reference);
  expect(state.hintUsed).toBe(true);
  expect(state.attempts).toHaveLength(3);
});

it('finds a solution with four blocks without using the hint route', () => {
  const queue = [createPuzzle('theApple')];
  const seen = new Set<string>();
  let found = false;
  for (let i = 0; i < queue.length && i < 50000; i++) {
    const current = queue[i]!;
    if (evaluatePhrase(current).goal) {
      found = true;
      break;
    }
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      const next = reducePuzzle(current, { type: 'move', direction });
      const key = JSON.stringify([next.x, next.y, next.pieces]);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ ...next, history: [] });
    }
  }
  expect(found).toBe(true);
});
