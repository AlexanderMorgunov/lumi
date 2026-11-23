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
import { stationThirdEpisode, stationThirdLevel } from './station-third-person';
import { createSession } from '../game/session';
import { dialogueSpeaker } from './dialogue';
const directions: Record<string, Direction> = {
  U: 'up',
  D: 'down',
  L: 'left',
  R: 'right',
};
const routes = ['UDLU', 'UDDLUUDLUDLU', 'UUDLUDLUDLU'];
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
it('solves all three maps with real controls and preserves subject through speaker changes and Undo', () => {
  let state = createPuzzle(stationThirdEpisode);
  for (const [i, route] of routes.entries()) {
    state = move(state, route);
    expect(readPhrase(state)).toEqual(
      i === 0 ? ['She', 'is', 'Marta'] : ['He', 'is', 'a', 'robot'],
    );
    state = reducePuzzle(state, { type: 'apply' });
    expect(state.completed).toBe(true);
    expect(state.messages).toHaveLength(i + 1);
    expect(state.messages.at(-1)?.subject).toBe(i === 0 ? 'marta' : 'tik');
    expect(state.inventory).toEqual([]);
    if (i < 2) {
      const previous = state;
      state = reducePuzzle(state, { type: 'continue' });
      const undone = reducePuzzle(state, { type: 'undo' });
      expect(undone.definition).toBe(previous.definition);
      expect(undone.messages).toEqual(previous.messages);
    }
  }
  expect(
    state.messages.map((m) => [m.speaker, m.recipient, m.subject]),
  ).toEqual([
    ['tik', 'lumi', 'marta'],
    ['marta', 'lumi', 'tik'],
    ['lumi', 'marta', 'tik'],
  ]);
  expect(dialogueSpeaker(state, 'task', 0)).toBe('tik');
  expect(reducePuzzle(state, { type: 'undo' }).messages).toHaveLength(2);
  const reset = reducePuzzle(state, { type: 'reset' });
  expect(reset.messages).toEqual([]);
  expect(reset.definition).toBe(stationThirdLevel);
  expect(reset.attempts).toEqual(state.attempts);
});
it('separates grammatical form from third-person reference, listener and facts', () => {
  const first = createPuzzle(stationThirdEpisode);
  const second = createPuzzle(
    stationThirdEpisode,
    stationThirdLevel.continuation!,
  );
  const third = createPuzzle(
    stationThirdEpisode,
    stationThirdLevel.continuation!.continuation!,
  );
  for (const [room, correct, alternatives] of [
    [
      first,
      ['She', 'is', 'Marta'],
      [
        ['He', 'is', 'Marta'],
        ['You', 'are', 'Lumi'],
        ['She', 'is', 'Lumi'],
      ],
    ],
    [
      second,
      ['He', 'is', 'a', 'robot'],
      [
        ['She', 'is', 'a', 'robot'],
        ['You', 'are', 'a', 'lantern'],
        ['He', 'is', 'a', 'lantern'],
      ],
    ],
    [
      third,
      ['He', 'is', 'a', 'robot'],
      [
        ['She', 'is', 'a', 'robot'],
        ['You', 'are', 'a', 'robot'],
        ['He', 'is', 'a', 'lantern'],
      ],
    ],
  ] as const) {
    expect(evaluatePhrase(phrase(room, [...correct]))).toMatchObject({
      form: 'valid',
      goal: true,
    });
    for (const words of alternatives) {
      const candidate = phrase(room, [...words]);
      expect(evaluatePhrase(candidate)).toMatchObject({
        form: 'valid',
        goal: false,
      });
      expect(reducePuzzle(candidate, { type: 'apply' }).messages).toEqual([]);
    }
    for (const prefix of [
      ['He', 'are'],
      ['She', 'am'],
      ['You', 'is'],
    ])
      expect(
        evaluateWords(room.definition, [...prefix, ...correct.slice(2)]).form,
      ).toBe('agreement');
    expect(
      evaluateWords(room.definition, [
        correct[1],
        correct[0],
        ...correct.slice(2),
      ]).form,
    ).toBe('order');
  }
  expect(
    evaluateWords(second.definition, ['He', 'is', 'an', 'robot']).form,
  ).toBe('article');
  expect(evaluateWords(second.definition, ['He', 'is', '', 'robot']).form).toBe(
    'article',
  );
  expect(evaluateWords(second.definition, ['He', 'is', 'robot', '']).form).toBe(
    'article',
  );
  expect(evaluateWords(second.definition, ['He', 'is', '', '']).form).toBe(
    'incomplete',
  );
  const changed = {
    ...second,
    definition: {
      ...second.definition,
      message: { ...second.definition.message!, subject: 'lumi' as const },
    },
  };
  expect(
    evaluatePhrase(phrase(changed, ['He', 'is', 'a', 'lantern'])).goal,
  ).toBe(true);
  expect(evaluatePhrase(phrase(changed, ['He', 'is', 'a', 'robot'])).goal).toBe(
    false,
  );
});
it('opens after episode 03, discovers new pronouns on entry and never completes after part two', () => {
  const s = createSession();
  expect(s.enterEpisode(stationThirdEpisode)).toBe(false);
  expect(s.getSnapshot().encounteredWords).not.toContain('She');
  const run = (route: string) => {
    for (const key of route)
      s.dispatch({ type: 'move', direction: directions[key]! });
    s.dispatch({ type: 'apply' });
  };
  s.enterEpisode('chapter-02-03', { developmentPreview: true });
  run(routes[0]!);
  s.continueEpisode();
  run(routes[1]!);
  s.explain('address-lumi');
  expect(s.enterEpisode(stationThirdEpisode)).toBe(false);
  s.explain('address-tik');
  expect(s.enterEpisode(stationThirdEpisode)).toBe(true);
  expect(s.getSnapshot().encounteredWords).toEqual(
    expect.arrayContaining(['She', 'He', 'You']),
  );
  for (const [i, route] of routes.entries()) {
    run(route);
    if (i < 2) {
      s.explain('third-subject');
      expect(s.getSnapshot().completedEpisodes).not.toContain(
        stationThirdEpisode,
      );
      s.continueEpisode();
    }
  }
  s.explain('third-listener');
  expect(s.getSnapshot().completedEpisodes).not.toContain(stationThirdEpisode);
  s.explain('third-subject');
  expect(s.getSnapshot().completedEpisodes).toContain(stationThirdEpisode);
  expect(s.getSnapshot().completedChapters).not.toContain('station');
  s.setPaused('platform', true);
  expect(s.enterEpisode('chapter-02-03')).toBe(false);
  s.setPaused('platform', false);
  s.enterEpisode('chapter-02-03');
  s.enterEpisode(stationThirdEpisode);
  expect(s.getSnapshot().room.messages).toHaveLength(3);
});
