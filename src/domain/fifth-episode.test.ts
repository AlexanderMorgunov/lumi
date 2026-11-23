import { expect, it } from 'vitest';
import {
  createPuzzle,
  evaluatePhrase,
  readPhrase,
  reducePuzzle,
  type Direction,
} from './puzzle';

const rightRoute: Direction[] = [
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
const leftRoute: Direction[] = [
  'up',
  'up',
  'down',
  'left',
  'left',
  'left',
  'up',
  'right',
  'down',
  'right',
  'up',
];
const cases = [
  {
    episode: 'choiceKey',
    words: ['a', 'key'],
    route: rightRoute,
    wrong: [
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
  },
  {
    episode: 'choiceApple',
    words: ['an', 'apple'],
    route: leftRoute,
    wrong: [
      'up',
      'up',
      'down',
      'right',
      'right',
      'right',
      'up',
      'left',
      'left',
      'left',
      'down',
      'left',
      'up',
    ],
  },
] as const;

it.each(cases)(
  '$episode: both alternatives are physically reachable, mistakes do not deliver, Undo restores',
  ({ episode, words, route, wrong }) => {
    const start = createPuzzle(episode);
    let state = start;
    for (const direction of wrong)
      state = reducePuzzle(state, { type: 'move', direction });
    expect(readPhrase(state)).toEqual([
      words[0] === 'a' ? 'an' : 'a',
      words[1],
    ]);
    state = reducePuzzle(state, { type: 'apply' });
    expect(state).toMatchObject({
      completed: false,
      deliveredItem: false,
      feedback: 'article',
    });
    for (let i = 0; i < wrong.length; i++)
      state = reducePuzzle(state, { type: 'undo' });
    expect(state.pieces).toEqual(start.pieces);
    expect(state.moves).toBe(0);
    for (const direction of route)
      state = reducePuzzle(state, { type: 'move', direction });
    expect(readPhrase(state)).toEqual(words);
    state = reducePuzzle(state, { type: 'apply' });
    expect(state).toMatchObject({ completed: true, deliveredItem: true });
    state = reducePuzzle(state, { type: 'undo' });
    expect(state).toMatchObject({ completed: false, deliveredItem: false });
    expect(state.attempts).toHaveLength(2);
    state = reducePuzzle(state, { type: 'hint' });
    state = reducePuzzle(state, { type: 'reset' });
    expect(state.pieces).toEqual(start.pieces);
    expect(state.hintUsed).toBe(true);
    expect(state.attempts).toHaveLength(2);
  },
);

it.each(cases)(
  '$episode: search finds a solution without using the hint route',
  ({ episode }) => {
    const queue = [createPuzzle(episode)];
    const seen = new Set<string>();
    let found = false;
    for (let i = 0; i < queue.length && i < 30000; i++) {
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
  },
);
