import { describe, expect, it } from 'vitest';
import {
  createPuzzle,
  evaluatePhrase,
  feedbackText,
  readPhrase,
  reducePuzzle,
  type PuzzleState,
  type Direction,
} from './puzzle';

describe('Marta’s first request', () => {
  it('pushes the word physically, then delivers an existing card on apply', () => {
    const start = createPuzzle();
    const before = JSON.stringify(start);
    const moved = reducePuzzle(start, { type: 'move', direction: 'up' });
    expect(readPhrase(moved)).toEqual(['a', 'cat']);
    expect(moved).toMatchObject({
      x: 2,
      y: 1,
      moves: 1,
      completed: false,
      feedback: 'push',
    });
    expect(moved.attempts).toEqual([]);
    const finished = reducePuzzle(moved, { type: 'apply' });
    expect(finished).toMatchObject({ completed: true, deliveredItem: true });
    expect(finished.attempts).toEqual([
      {
        words: ['a', 'cat'],
        levelId: 'chapter-01-01',
        form: 'valid',
        inReadingFrame: true,
        goal: true,
      },
    ]);
    expect(JSON.stringify(start)).toBe(before);
  });
  it('distinguishes incomplete, reversed and valid-but-outside phrases', () => {
    expect(evaluatePhrase(createPuzzle()).form).toBe('incomplete');
    const reversed: PuzzleState = {
      ...createPuzzle(),
      pieces: [
        { id: 'cat', kind: 'word', word: 'cat', x: 1, y: 0 },
        { id: 'a', kind: 'word', word: 'a', x: 2, y: 0 },
      ],
    };
    expect(evaluatePhrase(reversed)).toMatchObject({
      form: 'order',
      goal: false,
    });
    const outside: PuzzleState = {
      ...reversed,
      pieces: [
        { id: 'a', kind: 'word', word: 'a', x: 0, y: 1 },
        { id: 'cat', kind: 'word', word: 'cat', x: 1, y: 1 },
      ],
    };
    expect(evaluatePhrase(outside)).toEqual({
      form: 'valid',
      inReadingFrame: false,
      goal: false,
    });
    expect(reducePuzzle(outside, { type: 'apply' }).feedback).toBe('outside');
  });
  it('pushes a crate and restores both positions with one undo', () => {
    const start = { ...createPuzzle(), x: 0, y: 2 };
    const moved = reducePuzzle(start, { type: 'move', direction: 'up' });
    expect(moved.pieces.find((p) => p.id === 'crate')).toMatchObject({
      x: 0,
      y: 0,
    });
    const restored = reducePuzzle(moved, { type: 'undo' });
    expect(restored.pieces).toEqual(start.pieces);
    expect(restored).toMatchObject({ x: 0, y: 2, moves: 0 });
  });
  it('pushes a chain atomically, and blocks the entire chain at an edge', () => {
    const start: PuzzleState = {
      ...createPuzzle(),
      x: 0,
      y: 2,
      pieces: [
        { id: 'a', kind: 'word', word: 'a', x: 1, y: 2 },
        { id: 'cat', kind: 'word', word: 'cat', x: 2, y: 2 },
        { id: 'crate', kind: 'crate', x: 3, y: 2 },
      ],
    };
    const moved = reducePuzzle(start, { type: 'move', direction: 'right' });
    expect(moved.pieces.map((p) => p.x)).toEqual([2, 3, 4]);
    const blocked = reducePuzzle(moved, { type: 'move', direction: 'right' });
    expect(blocked).toMatchObject({
      x: 1,
      y: 2,
      moves: 1,
      feedback: 'blocked',
    });
    expect(blocked.pieces).toBe(moved.pieces);
    expect(reducePuzzle(blocked, { type: 'undo' }).pieces).toEqual(
      start.pieces,
    );
  });
  it('does not walk into walls or count blocked moves', () => {
    const start = { ...createPuzzle(), x: 3, y: 0 };
    const blocked = reducePuzzle(start, { type: 'move', direction: 'right' });
    expect(blocked).toMatchObject({
      x: 3,
      y: 0,
      moves: 0,
      feedback: 'blocked',
      facing: 'right',
    });
    expect(blocked.history).toHaveLength(0);
  });
  it('undoes the result and move without erasing attempts or hints; reset preserves them too', () => {
    let state = reducePuzzle(createPuzzle(), { type: 'apply' });
    state = reducePuzzle(state, { type: 'hint' });
    state = reducePuzzle(state, { type: 'move', direction: 'up' });
    state = reducePuzzle(state, { type: 'apply' });
    expect(reducePuzzle(state, { type: 'move', direction: 'down' })).toBe(
      state,
    );
    state = reducePuzzle(state, { type: 'undo' });
    expect(state).toMatchObject({
      completed: false,
      deliveredItem: false,
      moves: 1,
    });
    state = reducePuzzle(state, { type: 'undo' });
    expect(readPhrase(state)).toEqual(['a', '']);
    expect(state.attempts).toHaveLength(2);
    state = reducePuzzle(state, { type: 'reset' });
    expect(state).toMatchObject({ moves: 0, hintUsed: true, history: [] });
    expect(state.attempts).toHaveLength(2);
  });
  it('is solvable by breadth-first search without using a stored answer path', () => {
    const queue = [{ state: createPuzzle(), path: [] as Direction[] }];
    const seen = new Set<string>();
    let solution: Direction[] | undefined;
    for (let i = 0; i < queue.length && i < 1000; i++) {
      const current = queue[i];
      if (!current) break;
      if (evaluatePhrase(current.state).goal) {
        solution = current.path;
        break;
      }
      for (const direction of ['up', 'down', 'left', 'right'] as const) {
        const next = reducePuzzle(current.state, { type: 'move', direction });
        const key = JSON.stringify([next.x, next.y, next.pieces]);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ state: next, path: [...current.path, direction] });
      }
    }
    expect(solution).toEqual(['up']);
  });
});

describe('an apple: guided vowel-sound introduction', () => {
  it('accepts an apple, delivers one fruit, and restores it without erasing attempts', () => {
    const start = createPuzzle('apple');
    expect(readPhrase(start)).toEqual(['an', '']);
    let state = reducePuzzle(start, { type: 'move', direction: 'up' });
    expect(readPhrase(state)).toEqual(['an', 'apple']);
    state = reducePuzzle(state, { type: 'apply' });
    expect(state).toMatchObject({
      completed: true,
      deliveredItem: true,
      moves: 1,
    });
    state = reducePuzzle(state, { type: 'undo' });
    expect(state).toMatchObject({ completed: false, deliveredItem: false });
    state = reducePuzzle(state, { type: 'hint' });
    expect(feedbackText(state)).toContain('гласного звука');
    state = reducePuzzle(state, { type: 'reset' });
    expect(state.pieces).toEqual(start.pieces);
    expect(state.hintUsed).toBe(true);
    expect(state.attempts).toHaveLength(1);
  });
  it('rejects a apple and apple an; separates valid wording from frame placement', () => {
    const start = createPuzzle('apple');
    const solved = reducePuzzle(start, { type: 'move', direction: 'up' });
    const wrongArticle: PuzzleState = {
      ...solved,
      pieces: solved.pieces.map((piece) =>
        piece.id === 'an'
          ? { ...piece, id: 'a', kind: 'word', word: 'a' }
          : piece,
      ),
    };
    expect(evaluatePhrase(wrongArticle).goal).toBe(false);
    const reversed: PuzzleState = {
      ...solved,
      pieces: solved.pieces.map((piece) =>
        piece.id === 'an'
          ? { ...piece, x: 2 }
          : piece.id === 'apple'
            ? { ...piece, x: 1 }
            : piece,
      ),
    };
    expect(evaluatePhrase(reversed)).toMatchObject({
      form: 'order',
      goal: false,
    });
    const outside: PuzzleState = {
      ...solved,
      pieces: solved.pieces.map((piece) =>
        piece.kind === 'word' ? { ...piece, y: 1 } : piece,
      ),
    };
    expect(evaluatePhrase(outside)).toEqual({
      form: 'valid',
      inReadingFrame: false,
      goal: false,
    });
    expect(feedbackText(reducePuzzle(outside, { type: 'apply' }))).toContain(
      'Верное сочетание',
    );
  });
});

describe('an egg: independent transfer', () => {
  it('finds a new route by search, moves both words and reverses the world result', () => {
    const start = createPuzzle('egg');
    expect(readPhrase(start)).toEqual(['', '']);
    const queue = [start];
    const seen = new Set<string>();
    let solved: PuzzleState | undefined;
    for (let i = 0; i < queue.length && i < 20000; i++) {
      const current = queue[i]!;
      if (evaluatePhrase(current).goal) {
        solved = current;
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
    expect(solved).toBeDefined();
    expect(solved!.moves).toBe(11);
    expect(readPhrase(solved!)).toEqual(['an', 'egg']);
    let state = reducePuzzle(solved!, { type: 'apply' });
    expect(state).toMatchObject({ completed: true, deliveredItem: true });
    state = reducePuzzle(state, { type: 'undo' });
    expect(state).toMatchObject({ completed: false, deliveredItem: false });
    state = reducePuzzle(state, { type: 'hint' });
    expect(feedbackText(state)).toContain('an egg');
    state = reducePuzzle(state, { type: 'reset' });
    expect(state.pieces).toEqual(start.pieces);
    expect(state.attempts).toHaveLength(1);
    expect(state.hintUsed).toBe(true);
    for (const direction of [
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
    ] as const)
      state = reducePuzzle(state, { type: 'move', direction });
    expect(evaluatePhrase(state).goal).toBe(true);
  });
  it('rejects a egg without moving the world and distinguishes order from article choice', () => {
    const start = createPuzzle('egg');
    const framed: PuzzleState = {
      ...start,
      pieces: start.pieces.map((p) =>
        p.id === 'an'
          ? { ...p, x: 3, y: 0 }
          : p.id === 'egg'
            ? { ...p, x: 4, y: 0 }
            : p,
      ),
    };
    expect(evaluatePhrase(framed).goal).toBe(true);
    const wrong: PuzzleState = {
      ...start,
      pieces: start.pieces.map((p) =>
        p.id === 'a'
          ? { ...p, x: 3, y: 0 }
          : p.id === 'egg'
            ? { ...p, x: 4, y: 0 }
            : p,
      ),
    };
    const rejected = reducePuzzle(wrong, { type: 'apply' });
    expect(rejected).toMatchObject({
      completed: false,
      deliveredItem: false,
      feedback: 'article',
    });
    expect(rejected.pieces).toBe(wrong.pieces);
    expect(feedbackText(rejected)).toContain('Порядок слов верный');
    expect(rejected.attempts[0]?.words).toEqual(['a', 'egg']);
    const reversed = {
      ...framed,
      pieces: framed.pieces.map((p) =>
        p.id === 'an' ? { ...p, x: 4 } : p.id === 'egg' ? { ...p, x: 3 } : p,
      ),
    };
    expect(evaluatePhrase(reversed).form).toBe('order');
    const outside = {
      ...framed,
      pieces: framed.pieces.map((p) =>
        p.id === 'an' || p.id === 'egg' ? { ...p, y: 2 } : p,
      ),
    };
    expect(evaluatePhrase(outside)).toEqual({
      form: 'valid',
      inReadingFrame: false,
      goal: false,
    });
  });
});

describe('a key: independent transfer', () => {
  const route: Direction[] = [
    'left',
    'up',
    'down',
    'right',
    'right',
    'right',
    'up',
    'left',
    'down',
    'left',
    'up',
  ];
  it('requires moving both words and delivers one existing key, with reversible result', () => {
    const start = createPuzzle('key');
    expect(readPhrase(start)).toEqual(['', '']);
    let state = route.reduce(
      (s, direction) => reducePuzzle(s, { type: 'move', direction }),
      start,
    );
    expect(state.moves).toBe(route.length);
    expect(readPhrase(state)).toEqual(['a', 'key']);
    expect(state.deliveredItem).toBe(false);
    state = reducePuzzle(state, { type: 'apply' });
    expect(state).toMatchObject({
      episode: 'key',
      completed: true,
      deliveredItem: true,
    });
    const undone = reducePuzzle(state, { type: 'undo' });
    expect(undone).toMatchObject({ completed: false, deliveredItem: false });
    expect(readPhrase(undone)).toEqual(['a', 'key']);
    expect(undone.attempts).toHaveLength(1);
    const reset = reducePuzzle(reducePuzzle(undone, { type: 'hint' }), {
      type: 'reset',
    });
    expect(reset).toMatchObject({ episode: 'key', hintUsed: true, moves: 0 });
    expect(reset.pieces).toEqual(start.pieces);
    expect(reset.attempts).toHaveLength(1);
  });
  it('finds a solution by search, without consuming the demonstration route', () => {
    const queue = [createPuzzle('key')];
    const seen = new Set<string>();
    let solved: PuzzleState | undefined;
    for (let i = 0; i < queue.length && i < 20000; i++) {
      const current = queue[i]!;
      if (evaluatePhrase(current).goal) {
        solved = current;
        break;
      }
      for (const direction of ['up', 'down', 'left', 'right'] as const) {
        const next = reducePuzzle(current, { type: 'move', direction });
        const key = JSON.stringify([next.x, next.y, next.pieces]);
        if (seen.has(key)) continue;
        seen.add(key);
        // Search needs world state only, not a growing undo journal.
        queue.push({ ...next, history: [] });
      }
    }
    expect(solved).toBeDefined();
    expect(solved!.moves).toBeGreaterThan(1);
    expect(reducePuzzle(solved!, { type: 'apply' }).completed).toBe(true);
  });
  it('separates reversed key/a from a correct phrase outside the frame', () => {
    const state: PuzzleState = {
      ...createPuzzle('key'),
      pieces: [
        { id: 'key', kind: 'word', word: 'key', x: 1, y: 0 },
        { id: 'a', kind: 'word', word: 'a', x: 2, y: 0 },
      ],
    };
    expect(evaluatePhrase(state).form).toBe('order');
    const outside: PuzzleState = {
      ...state,
      pieces: [
        { id: 'a', kind: 'word', word: 'a', x: 1, y: 1 },
        { id: 'key', kind: 'word', word: 'key', x: 2, y: 1 },
      ],
    };
    expect(evaluatePhrase(outside)).toEqual({
      form: 'valid',
      inReadingFrame: false,
      goal: false,
    });
    expect(reducePuzzle(outside, { type: 'apply' }).feedback).toBe('outside');
  });
});
