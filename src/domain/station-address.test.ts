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
import { stationAddressEpisode, stationAddressLevel } from './station-address';
import { createSession } from '../game/session';
import { dialogueSpeaker } from './dialogue';
const directions: Record<string, Direction> = {
  U: 'up',
  D: 'down',
  L: 'left',
  R: 'right',
};
const move = (state: PuzzleState, route: string) =>
  [...route].reduce(
    (room, key) =>
      reducePuzzle(room, { type: 'move', direction: directions[key]! }),
    state,
  );
const phrase = (state: PuzzleState, words: string[]) => ({
  ...state,
  pieces: state.pieces.map((piece, i) => {
    const index = piece.kind === 'word' ? words.indexOf(piece.word) : -1;
    return index >= 0
      ? { ...piece, ...state.definition.slots[index]! }
      : { ...piece, x: i % 8, y: 3 + Math.floor(i / 8) };
  }),
});
it('solves both address maps by real moves, switches recipient and restores roles with Undo', () => {
  let state = move(createPuzzle(stationAddressEpisode), 'UDLU');
  expect(readPhrase(state)).toEqual(['You', 'are', 'Lumi']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state.completed).toBe(true);
  expect(state.messages).toEqual([
    { speaker: 'marta', recipient: 'lumi', text: 'You are Lumi' },
  ]);
  const first = state;
  state = reducePuzzle(state, { type: 'continue' });
  expect(state.definition.message).toMatchObject({
    speaker: 'lumi',
    recipient: 'tik',
  });
  expect(dialogueSpeaker(state, 'task', 0)).toBe('tik');
  const undone = reducePuzzle(state, { type: 'undo' });
  expect(undone.definition).toBe(first.definition);
  expect(undone.messages).toEqual(first.messages);
  state = move(state, 'UDDLUUDLUDLU');
  expect(readPhrase(state)).toEqual(['You', 'are', 'a', 'robot']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state.completed).toBe(true);
  expect(state.messages.at(-1)).toEqual({
    speaker: 'lumi',
    recipient: 'tik',
    text: 'You are a robot',
  });
  expect(state.inventory).toEqual([]);
  expect(state.definition.message?.people.tik.kind).toBe('robot');
  expect(reducePuzzle(state, { type: 'undo' }).messages).toHaveLength(1);
  const reset = reducePuzzle(state, { type: 'reset' });
  expect(reset.definition).toBe(stationAddressLevel);
  expect(reset.messages).toEqual([]);
  expect(reset.attempts).toEqual(state.attempts);
});
it('distinguishes agreement, speaker, recipient and truthful description without treating valid I as ungrammatical', () => {
  const first = createPuzzle(stationAddressEpisode);
  const second = createPuzzle(
    stationAddressEpisode,
    stationAddressLevel.continuation!,
  );
  for (const [room, words, goal] of [
    [first, ['You', 'are', 'Lumi'], true],
    [first, ['You', 'are', 'Marta'], false],
    [first, ['I', 'am', 'Marta'], false],
    [first, ['I', 'am', 'Lumi'], false],
    [second, ['You', 'are', 'a', 'robot'], true],
    [second, ['You', 'are', 'a', 'lantern'], false],
    [second, ['I', 'am', 'a', 'lantern'], false],
    [second, ['I', 'am', 'a', 'robot'], false],
    [second, ['You', 'are', 'the', 'robot'], false],
  ] as const) {
    const candidate = phrase(room, [...words]);
    expect(evaluatePhrase(candidate)).toMatchObject({ form: 'valid', goal });
    if (!goal)
      expect(reducePuzzle(candidate, { type: 'apply' }).messages).toEqual([]);
  }
  for (const [room, ending] of [
    [first, ['Lumi']],
    [second, ['a', 'robot']],
  ] as const) {
    for (const prefix of [
      ['You', 'is'],
      ['You', 'am'],
      ['I', 'are'],
      ['I', 'is'],
    ])
      expect(evaluateWords(room.definition, [...prefix, ...ending]).form).toBe(
        'agreement',
      );
    expect(evaluateWords(room.definition, ['are', 'You', ...ending]).form).toBe(
      'order',
    );
  }
  expect(
    evaluateWords(second.definition, ['You', 'are', 'an', 'robot']).form,
  ).toBe('article');
  expect(
    evaluateWords(second.definition, ['You', 'are', '', 'robot']).form,
  ).toBe('article');
  expect(
    evaluateWords(second.definition, ['You', 'are', 'robot', '']).form,
  ).toBe('article');
  expect(evaluateWords(second.definition, ['You', 'are', '', '']).form).toBe(
    'incomplete',
  );
  const changedRecipient = {
    ...second,
    definition: {
      ...second.definition,
      message: { ...second.definition.message!, recipient: 'lumi' as const },
    },
  };
  expect(
    evaluatePhrase(phrase(changedRecipient, ['You', 'are', 'a', 'lantern']))
      .goal,
  ).toBe(true);
  expect(
    evaluatePhrase(phrase(changedRecipient, ['You', 'are', 'a', 'robot'])).goal,
  ).toBe(false);
});
it('unlocks after the preceding reflection, discovers words on entry and leaves future chapters locked', () => {
  const s = createSession();
  expect(s.enterEpisode(stationAddressEpisode)).toBe(false);
  expect(s.getSnapshot().encounteredWords).not.toContain('You');
  s.enterEpisode('chapter-02-02', { developmentPreview: true });
  for (const key of 'UDLU')
    s.dispatch({ type: 'move', direction: directions[key]! });
  s.dispatch({ type: 'apply' });
  s.continueEpisode();
  for (const key of 'UDDLUUDLUDLU')
    s.dispatch({ type: 'move', direction: directions[key]! });
  s.dispatch({ type: 'apply' });
  s.explain('identity-after-am');
  expect(s.enterEpisode(stationAddressEpisode)).toBe(false);
  s.explain('identity-kind');
  expect(s.enterEpisode(stationAddressEpisode)).toBe(true);
  expect(s.getSnapshot().encounteredWords).toEqual(
    expect.arrayContaining(['You', 'are', 'lantern']),
  );
  for (const key of 'UDLU')
    s.dispatch({ type: 'move', direction: directions[key]! });
  s.dispatch({ type: 'apply' });
  s.continueEpisode();
  for (const key of 'UDDLUUDLUDLU')
    s.dispatch({ type: 'move', direction: directions[key]! });
  s.dispatch({ type: 'apply' });
  s.explain('address-group');
  expect(s.getSnapshot().completedEpisodes).not.toContain(
    stationAddressEpisode,
  );
  s.explain('address-tik');
  expect(s.getSnapshot().completedEpisodes).toContain(stationAddressEpisode);
  expect(s.getSnapshot().completedChapters).not.toContain('station');
  s.setPaused('platform', true);
  expect(s.enterEpisode('chapter-02-01')).toBe(false);
  s.setPaused('platform', false);
  s.enterEpisode('chapter-02-02');
  s.enterEpisode(stationAddressEpisode);
  expect(s.getSnapshot().room.messages).toHaveLength(2);
});
