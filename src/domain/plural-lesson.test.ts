import { expect, it } from 'vitest';
import {
  createPuzzle,
  readPhrase,
  reducePuzzle,
  evaluatePhrase,
  evaluateWords,
} from './puzzle';
import { validateLevel } from './levels';
import { frameFeedback } from '../game/frame-feedback';
import { roomWords } from './wordbook';
import { recordedTerm } from './pronunciation';

it('allows an empty article position only when the noun is in its own slot, and never reads a crate as absence', () => {
  const start = createPuzzle('chapterFinale');
  expect(evaluatePhrase(start).goal).toBe(false);
  const assembled = reducePuzzle(
    reducePuzzle(start, { type: 'move', direction: 'up' }),
    { type: 'move', direction: 'up' },
  );
  expect(readPhrase(assembled)).toEqual(['apples']);
  expect(frameFeedback(assembled)).toBe('assembled');
  expect(evaluatePhrase(assembled)).toMatchObject({
    form: 'valid',
    goal: true,
    inReadingFrame: true,
  });
  const inWrongSlot = {
    ...assembled,
    pieces: assembled.pieces.map((p) =>
      p.id === 'apples' ? { ...p, x: 3 } : p,
    ),
  };
  expect(evaluatePhrase(inWrongSlot).goal).toBe(false);
  const obstructed = {
    ...assembled,
    pieces: [
      ...assembled.pieces,
      { id: 'crate', kind: 'crate' as const, x: 3, y: 0 },
    ],
  };
  expect(evaluatePhrase(obstructed).goal).toBe(false);
  const required = {
    ...assembled,
    definition: { ...assembled.definition, optionalLeadingArticle: false },
  };
  expect(evaluateWords(required.definition, readPhrase(required)).form).toBe(
    'incomplete',
  );
  expect(evaluatePhrase(required).goal).toBe(false);
  expect(
    validateLevel({ ...start.definition, slots: [{ x: 3, y: 0 }] }),
  ).toContain('Optional article requires two reading slots');
});

it('preserves the chosen pair, count and known reference through the second request, Undo and restart', () => {
  const start = createPuzzle('chapterFinale');
  const selected = reducePuzzle(
    reducePuzzle(reducePuzzle(start, { type: 'move', direction: 'up' }), {
      type: 'move',
      direction: 'up',
    }),
    { type: 'apply' },
  );
  const chosen = selected.reference!.indicatedId;
  expect(
    selected.reference!.objects.find((o) => o.id === chosen),
  ).toMatchObject({ count: 2, noun: 'apples', location: 'selected' });
  let next = reducePuzzle(selected, { type: 'continue' });
  expect(next.reference!.indicatedId).toBe(chosen);
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
    next = reducePuzzle(next, { type: 'move', direction });
  expect(
    evaluatePhrase({ ...next, reference: { ...next.reference!, knownIds: [] } })
      .goal,
  ).toBe(false);
  const delivered = reducePuzzle(next, { type: 'apply' });
  expect(delivered.inventory).toEqual([
    expect.objectContaining({
      id: chosen,
      count: 2,
      noun: 'apples',
      location: 'bag',
    }),
  ]);
  expect(reducePuzzle(delivered, { type: 'undo' }).reference).toEqual(
    selected.reference,
  );
  expect(reducePuzzle(delivered, { type: 'reset' }).inventory).toEqual([]);
  expect(delivered.attempts).toHaveLength(2);
});

it('exposes both plural forms in vocabulary and uses existing local pronunciation', () => {
  let room = createPuzzle('chapterFinale');
  expect(roomWords(room)).toEqual(['apples']);
  const eggs = room.definition.continuation!.continuation!;
  room = createPuzzle('chapterFinale', eggs);
  expect(roomWords(room)).toEqual(['eggs']);
  expect(recordedTerm('apples')).toBe('apples');
  expect(recordedTerm('eggs')).toBe('eggs');
});
