import { expect, it } from 'vitest';
import { levels, validateLevel } from './levels';
import {
  createPuzzle,
  evaluatePhrase,
  readPhrase,
  reducePuzzle,
  type Direction,
  type PuzzleState,
} from './puzzle';

const correct: Direction[] = [
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
const indefinite: Direction[] = [
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
];
const walk = (state: PuzzleState, route: Direction[]) =>
  route.reduce(
    (s, direction) => reducePuzzle(s, { type: 'move', direction }),
    state,
  );

it('a key is valid but does not identify the requested object; both paths are reachable', () => {
  const start = createPuzzle('theKey');
  let state = walk(start, indefinite);
  expect(readPhrase(state)).toEqual(['a', 'key']);
  expect(evaluatePhrase(state)).toMatchObject({
    form: 'valid',
    goal: false,
    inReadingFrame: true,
  });
  state = reducePuzzle(state, { type: 'apply' });
  expect(state).toMatchObject({
    feedback: 'context',
    deliveredItem: false,
    completed: false,
  });
  expect(state.reference).toBe(start.reference);
  for (let i = 0; i < indefinite.length; i++)
    state = reducePuzzle(state, { type: 'undo' });
  expect(state.pieces).toEqual(start.pieces);
  state = walk(state, correct);
  expect(readPhrase(state)).toEqual(['the', 'key']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state.reference?.objects.map((o) => [o.id, o.location])).toEqual([
    ['cupboard-key', 'table'],
    ['workshop-key', 'bag'],
    ['chest-key', 'table'],
  ]);
  expect(state.attempts.at(-1)).toMatchObject({
    referentId: 'workshop-key',
    form: 'valid',
    goal: true,
  });
  expect(start.reference?.objects.every((o) => o.location === 'table')).toBe(
    true,
  );
  state = reducePuzzle(state, { type: 'undo' });
  expect(state.reference).toEqual(start.reference);
  expect(state.deliveredItem).toBe(false);
  expect(state.attempts).toHaveLength(2);
  state = reducePuzzle(state, { type: 'apply' });
  state = reducePuzzle(state, { type: 'hint' });
  state = reducePuzzle(state, { type: 'reset' });
  expect(state.reference).toEqual(start.reference);
  expect(state.attempts).toHaveLength(3);
  expect(state.hintUsed).toBe(true);
});

it('the requires a shared identifiable referent in the current state, not just a matching string', () => {
  const solved = walk(createPuzzle('theKey'), correct);
  expect(evaluatePhrase(solved)).toMatchObject({ form: 'valid', goal: true });
  for (const reference of [
    null,
    { ...solved.reference!, knownIds: [] },
    { ...solved.reference!, indicatedId: 'cupboard-key' },
    {
      ...solved.reference!,
      objects: solved.reference!.objects.filter((o) => o.id !== 'workshop-key'),
    },
    {
      ...solved.reference!,
      objects: solved.reference!.objects.map((o) => ({
        ...o,
        location: 'bag' as const,
      })),
    },
  ]) {
    const state = { ...solved, reference };
    expect(evaluatePhrase(state)).toMatchObject({ form: 'valid', goal: false });
    expect(reducePuzzle(state, { type: 'apply' })).toMatchObject({
      feedback: 'context',
      completed: false,
    });
  }
  const outside = {
    ...solved,
    pieces: solved.pieces.map((p) =>
      p.id === 'the' || p.id === 'key' ? { ...p, y: 1 } : p,
    ),
  };
  expect(evaluatePhrase(outside)).toMatchObject({
    form: 'valid',
    inReadingFrame: false,
    goal: false,
  });
  const reversed = {
    ...solved,
    pieces: solved.pieces.map((p) =>
      p.id === 'the' ? { ...p, x: 4 } : p.id === 'key' ? { ...p, x: 3 } : p,
    ),
  };
  expect(evaluatePhrase(reversed)).toMatchObject({
    form: 'order',
    goal: false,
  });
});

it('rejects dangling or duplicate world references in authored data', () => {
  const level = levels.theKey;
  expect(validateLevel(level)).toEqual([]);
  expect(
    validateLevel({
      ...level,
      reference: { ...level.reference!, indicatedId: 'missing' },
    }),
  ).toContain('Invalid reference context');
  expect(
    validateLevel({
      ...level,
      reference: {
        ...level.reference!,
        objects: [...level.reference!.objects, level.reference!.objects[0]!],
      },
    }),
  ).toContain('Invalid reference context');
  expect(
    validateLevel({
      ...level,
      answers: [{ words: ['the', 'key'], goal: true, referentId: 'missing' }],
    }),
  ).toContain('Invalid answer referent');
});

it('finds a physical solution by search without the scripted hint', () => {
  const queue = [createPuzzle('theKey')];
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
});
