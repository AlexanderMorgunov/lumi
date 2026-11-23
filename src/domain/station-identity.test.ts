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
import {
  stationIdentityEpisode,
  stationIdentityLevel,
} from './station-identity';
import { createSession } from '../game/session';
import { frameFeedback } from '../game/frame-feedback';
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
function phrase(state: PuzzleState, words: string[]) {
  return {
    ...state,
    pieces: state.pieces.map((piece, i) => {
      const index = piece.kind === 'word' ? words.indexOf(piece.word) : -1;
      return index >= 0
        ? { ...piece, ...state.definition.slots[index]! }
        : { ...piece, x: i, y: 4 };
    }),
  };
}
it('solves both four-word maps by real moves and records descriptions without transforming actors', () => {
  let state = move(createPuzzle(stationIdentityEpisode), 'UDLU');
  expect(readPhrase(state)).toEqual(['I', 'am', 'a', 'lantern']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state.completed).toBe(true);
  expect(state.messages[0]).toEqual({
    speaker: 'lumi',
    recipient: 'marta',
    text: 'I am a lantern',
  });
  const first = state;
  state = reducePuzzle(state, { type: 'continue' });
  expect(state.definition.message?.speaker).toBe('tik');
  expect(dialogueSpeaker(state, 'task', 0)).toBe('tik');
  const undone = reducePuzzle(state, { type: 'undo' });
  expect(undone.definition).toBe(first.definition);
  expect(undone.pieces).toEqual(first.pieces);
  expect(undone.messages).toEqual(first.messages);
  state = move(state, 'UDDLUUDLUDLU');
  expect(readPhrase(state)).toEqual(['I', 'am', 'a', 'robot']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state.completed).toBe(true);
  expect(state.messages).toHaveLength(2);
  expect(state.deliveredItem).toBe(false);
  expect(state.inventory).toEqual([]);
  expect(state.definition.message?.people.lumi.kind).toBe('lantern');
  expect(reducePuzzle(state, { type: 'undo' }).messages).toHaveLength(1);
  const reset = reducePuzzle(state, { type: 'reset' });
  expect(reset.messages).toEqual([]);
  expect(reset.definition).toBe(stationIdentityLevel);
  expect(reset.attempts).toEqual(state.attempts);
});
it('separates grammatical form, classification and identity; familiarity does not require the', () => {
  const lumi = createPuzzle(stationIdentityEpisode);
  const tik = createPuzzle(
    stationIdentityEpisode,
    stationIdentityLevel.continuation!,
  );
  for (const [room, right, wrong] of [
    [lumi, 'lantern', 'robot'],
    [tik, 'robot', 'lantern'],
  ] as const) {
    expect(evaluatePhrase(phrase(room, ['I', 'am', 'a', right]))).toMatchObject(
      { form: 'valid', goal: true },
    );
    const falseDescription = phrase(room, ['I', 'am', 'a', wrong]);
    expect(evaluatePhrase(falseDescription)).toMatchObject({
      form: 'valid',
      goal: false,
    });
    expect(frameFeedback(falseDescription)).toBe('assembled');
    expect(reducePuzzle(falseDescription, { type: 'apply' }).messages).toEqual(
      [],
    );
    expect(
      evaluatePhrase(phrase(room, ['I', 'am', 'the', right])),
    ).toMatchObject({ form: 'valid', goal: false });
    expect(evaluateWords(room.definition, ['I', 'am', 'an', right]).form).toBe(
      'article',
    );
    expect(evaluateWords(room.definition, ['I', 'is', 'a', right]).form).toBe(
      'agreement',
    );
    expect(evaluateWords(room.definition, ['am', 'I', 'a', right]).form).toBe(
      'order',
    );
    expect(evaluatePhrase(phrase(room, ['I', 'am', '', right])).form).toBe(
      'article',
    );
    expect(evaluatePhrase(phrase(room, ['I', 'am', right, ''])).form).toBe(
      'article',
    );
    expect(evaluateWords(room.definition, ['I', 'am', '', '']).form).toBe(
      'incomplete',
    );
  }
  const altered = {
    ...lumi,
    definition: {
      ...lumi.definition,
      message: { ...lumi.definition.message!, speaker: 'tik' as const },
    },
  };
  expect(evaluatePhrase(phrase(altered, ['I', 'am', 'a', 'robot'])).goal).toBe(
    true,
  );
  expect(
    evaluatePhrase(phrase(altered, ['I', 'am', 'a', 'lantern'])).goal,
  ).toBe(false);
});
it('does not reveal new words on map preview, opens only after completion and does not finish the chapter', () => {
  const s = createSession();
  expect(s.enterEpisode(stationIdentityEpisode)).toBe(false);
  expect(s.getSnapshot().encounteredWords).not.toContain('lantern');
  s.enterEpisode('chapter-02-01', { developmentPreview: true });
  s.dispatch({ type: 'move', direction: 'up' });
  s.dispatch({ type: 'apply' });
  s.continueEpisode();
  for (const key of 'UUDDLUUDLU')
    s.dispatch({ type: 'move', direction: directions[key]! });
  s.dispatch({ type: 'apply' });
  s.explain('speaker-listener');
  expect(s.enterEpisode(stationIdentityEpisode)).toBe(false);
  s.explain('speaker-marta');
  expect(s.enterEpisode(stationIdentityEpisode)).toBe(true);
  expect(s.getSnapshot().encounteredWords).toContain('lantern');
  for (const key of 'UDLU')
    s.dispatch({ type: 'move', direction: directions[key]! });
  s.dispatch({ type: 'apply' });
  s.continueEpisode();
  for (const key of 'UDDLUUDLUDLU')
    s.dispatch({ type: 'move', direction: directions[key]! });
  s.dispatch({ type: 'apply' });
  s.explain('identity-after-am');
  expect(s.getSnapshot().completedEpisodes).not.toContain(
    stationIdentityEpisode,
  );
  s.explain('identity-kind');
  expect(s.getSnapshot().completedEpisodes).toContain(stationIdentityEpisode);
  expect(s.getSnapshot().completedChapters).not.toContain('station');
  s.setPaused('platform', true);
  expect(s.enterEpisode('chapter-02-01')).toBe(false);
  s.setPaused('platform', false);
  s.enterEpisode('chapter-02-01');
  s.enterEpisode(stationIdentityEpisode);
  expect(s.getSnapshot().room.definition.message?.speaker).toBe('tik');
  expect(s.getSnapshot().room.messages).toHaveLength(2);
});
