import { expect, it } from 'vitest';
import {
  createPuzzle,
  evaluatePhrase,
  evaluateWords,
  readPhrase,
  reducePuzzle,
  type Direction,
  type PuzzleState,
} from './puzzle';
import { stationObjectsEpisode, stationObjectsLevel } from './station-objects';
import { validateLevel } from './levels';
import { createSession } from '../game/session';
const directions: Record<string, Direction> = { U: 'up', D: 'down', L: 'left' };
const routes = ['UDLU', 'UDDLUUDLUDLU'];
const move = (state: PuzzleState, route: string) =>
  [...route].reduce(
    (r, key) => reducePuzzle(r, { type: 'move', direction: directions[key]! }),
    state,
  );
const phrase = (state: PuzzleState, words: string[]) => ({
  ...state,
  pieces: state.pieces.map((p, i) => {
    const index = p.kind === 'word' ? words.indexOf(p.word) : -1;
    return index >= 0
      ? { ...p, ...state.definition.slots[index]! }
      : { ...p, x: i % 8, y: 3 + Math.floor(i / 8) };
  }),
});
it('describes two visible objects with real moves without transporting them, and restores reference on Undo', () => {
  let state = createPuzzle(stationObjectsEpisode);
  for (const [i, route] of routes.entries()) {
    const reference = state.reference;
    state = move(state, route);
    expect(readPhrase(state)).toEqual([
      'It',
      'is',
      'an',
      i === 0 ? 'umbrella' : 'egg',
    ]);
    state = reducePuzzle(state, { type: 'apply' });
    expect(state.completed).toBe(true);
    expect(state.messages).toHaveLength(i + 1);
    expect(state.messages.at(-1)).toMatchObject({
      speaker: i === 0 ? 'tik' : 'marta',
      object: {
        id: i === 0 ? 'station-lost-umbrella' : 'station-egg-picture',
        noun: i === 0 ? 'umbrella' : 'egg',
      },
    });
    expect(state.messages.at(-1)?.subject).toBeUndefined();
    expect(state.reference).toEqual(reference);
    expect(state.inventory).toEqual([]);
    expect(state.deliveredItem).toBe(false);
    if (i === 0) {
      const previous = state;
      state = reducePuzzle(state, { type: 'continue' });
      expect(state.reference?.indicatedId).toBe('station-egg-picture');
      const undone = reducePuzzle(state, { type: 'undo' });
      expect(undone.reference).toEqual(previous.reference);
      expect(undone.messages).toEqual(previous.messages);
    }
  }
  expect(reducePuzzle(state, { type: 'undo' }).messages).toHaveLength(1);
  const reset = reducePuzzle(state, { type: 'reset' });
  expect(reset.reference?.indicatedId).toBe('station-lost-umbrella');
  expect(reset.messages).toEqual([]);
  expect(reset.attempts).toEqual(state.attempts);
});
it('checks form, ordinary-object reference and description independently, failing closed without a pointer', () => {
  const first = createPuzzle(stationObjectsEpisode);
  for (const definition of [
    stationObjectsLevel,
    stationObjectsLevel.continuation!,
  ]) {
    const state = createPuzzle(stationObjectsEpisode, definition);
    const noun = definition.presentation!.noun;
    for (const words of [
      ['He', 'is', 'an', noun],
      ['She', 'is', 'an', noun],
      ['It', 'is', 'an', noun === 'egg' ? 'umbrella' : 'egg'],
      ['It', 'is', 'the', noun],
    ]) {
      const candidate = phrase(state, words);
      expect(evaluatePhrase(candidate)).toMatchObject({
        form: 'valid',
        goal: false,
      });
      expect(reducePuzzle(candidate, { type: 'apply' }).messages).toEqual([]);
    }
    expect(evaluateWords(definition, ['It', 'is', 'a', noun]).form).toBe(
      'article',
    );
    expect(evaluateWords(definition, ['It', 'are', 'an', noun]).form).toBe(
      'agreement',
    );
    expect(evaluateWords(definition, ['It', 'is', '', noun]).form).toBe(
      'article',
    );
    expect(evaluateWords(definition, ['It', 'is', noun, '']).form).toBe(
      'article',
    );
    expect(evaluateWords(definition, ['It', 'is', '', '']).form).toBe(
      'incomplete',
    );
    expect(evaluateWords(definition, ['is', 'It', 'an', noun]).form).toBe(
      'order',
    );
  }
  const changed = {
    ...first,
    reference: { ...first.reference!, indicatedId: 'station-egg-picture' },
  };
  expect(evaluatePhrase(phrase(changed, ['It', 'is', 'an', 'egg'])).goal).toBe(
    true,
  );
  expect(
    evaluatePhrase(phrase(changed, ['It', 'is', 'an', 'umbrella'])).goal,
  ).toBe(false);
  expect(
    evaluatePhrase(
      phrase({ ...first, reference: null }, ['It', 'is', 'an', 'umbrella']),
    ).goal,
  ).toBe(false);
  expect(
    validateLevel({ ...stationObjectsLevel, reference: undefined }),
  ).toContain(
    'Object description requires a pointed supported object, not a participant',
  );
  expect(
    validateLevel({
      ...stationObjectsLevel,
      message: { ...stationObjectsLevel.message!, subject: 'tik' },
    }),
  ).toContain(
    'Object description requires a pointed supported object, not a participant',
  );
});
it('unlocks after all three prior parts and reflection, discovers It on entry and requires its own reflection', () => {
  const s = createSession();
  const run = (route: string) => {
    for (const key of route)
      s.dispatch({ type: 'move', direction: directions[key]! });
    s.dispatch({ type: 'apply' });
  };
  expect(s.enterEpisode(stationObjectsEpisode)).toBe(false);
  expect(s.getSnapshot().encounteredWords).not.toContain('It');
  s.enterEpisode('chapter-02-04', { developmentPreview: true });
  for (const [i, route] of [...routes, 'UUDLUDLUDLU'].entries()) {
    run(route);
    if (i < 2) s.continueEpisode();
  }
  s.explain('third-listener');
  expect(s.enterEpisode(stationObjectsEpisode)).toBe(false);
  s.explain('third-subject');
  expect(s.enterEpisode(stationObjectsEpisode)).toBe(true);
  expect(s.getSnapshot().encounteredWords).toContain('It');
  run(routes[0]!);
  s.explain('object-ordinary');
  expect(s.getSnapshot().completedEpisodes).not.toContain(
    stationObjectsEpisode,
  );
  s.continueEpisode();
  run(routes[1]!);
  s.explain('object-russian');
  expect(s.getSnapshot().completedEpisodes).not.toContain(
    stationObjectsEpisode,
  );
  s.explain('object-ordinary');
  expect(s.getSnapshot().completedEpisodes).toContain(stationObjectsEpisode);
  expect(s.getSnapshot().completedChapters).not.toContain('station');
});
