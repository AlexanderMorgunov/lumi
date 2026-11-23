import { expect, it } from 'vitest';
import {
  createPuzzle,
  evaluatePhrase,
  readPhrase,
  reducePuzzle,
  type Direction,
  type PuzzleState,
} from './puzzle';
import { stationEpisode, stationLevel } from './station-chapter';
import { frameFeedback } from '../game/frame-feedback';
import { createSession } from '../game/session';
import { completeWorkshop } from '../../tests/helpers/complete-workshop';
import { dialogueSpeaker } from './dialogue';
import { validateLevel } from './levels';

it('keeps the actual dialogue speaker distinct from the author of the assembled message', () => {
  const lumi = createPuzzle(stationEpisode);
  const marta = createPuzzle(stationEpisode, stationLevel.continuation!);
  expect(lumi.definition.message?.speaker).toBe('lumi');
  expect(dialogueSpeaker(lumi, 'task', 0)).toBe('tik');
  expect(dialogueSpeaker(lumi, 'success', 0)).toBe('lumi');
  expect(dialogueSpeaker(lumi, 'success', 1)).toBe('marta');
  expect(dialogueSpeaker(marta, 'task', 0)).toBe('marta');
  expect(dialogueSpeaker(marta, 'task', 2)).toBe('marta');
  expect(dialogueSpeaker(marta, 'success', 0)).toBe('marta');
  expect(dialogueSpeaker(marta, 'success', 1)).toBe('tik');
  expect(validateLevel(stationLevel)).toEqual([]);
  expect(
    validateLevel({
      ...stationLevel,
      presentation: {
        ...stationLevel.presentation!,
        introduction: ['A shortened script'],
      },
    }),
  ).toContain('Every dialogue line needs a speaker');
});

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
    pieces: state.pieces.map((p) => {
      const index = p.kind === 'word' ? words.indexOf(p.word) : -1;
      return index >= 0
        ? { ...p, ...state.definition.slots[index]! }
        : { ...p, y: 4 };
    }),
  };
}
it('both authored boards are solvable through movement; messages record names without delivering items', () => {
  let state = move(createPuzzle(stationEpisode), 'U');
  expect(readPhrase(state)).toEqual(['I', 'am', 'Lumi']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state.completed).toBe(true);
  expect(state.deliveredItem).toBe(false);
  expect(state.inventory).toEqual([]);
  expect(state.messages).toEqual([
    { speaker: 'lumi', recipient: 'marta', text: 'I am Lumi' },
  ]);
  state = reducePuzzle(state, { type: 'continue' });
  expect(state.definition.message?.speaker).toBe('marta');
  state = move(state, 'UUDDLUUDLU');
  expect(readPhrase(state)).toEqual(['I', 'am', 'Marta']);
  state = reducePuzzle(state, { type: 'apply' });
  expect(state.completed).toBe(true);
  expect(state.messages).toHaveLength(2);
  expect(state.deliveredItem).toBe(false);
  expect(state.inventory).toEqual([]);
  expect(state.definition.message?.people.marta.name).toBe('Marta');
  expect(reducePuzzle(state, { type: 'apply' })).toBe(state);
  expect(reducePuzzle(state, { type: 'undo' }).messages).toHaveLength(1);
});
it('separates agreement, order, missing words and a well-formed but false name; no success spoiler', () => {
  const initial = createPuzzle(stationEpisode, stationLevel.continuation!);
  const wrongName = phrase(initial, ['I', 'am', 'Lumi']);
  expect(evaluatePhrase(wrongName)).toMatchObject({
    form: 'valid',
    goal: false,
  });
  expect(frameFeedback(wrongName)).toBe('assembled');
  const result = reducePuzzle(wrongName, { type: 'apply' });
  expect(result.feedback).toBe('context');
  expect(result.messages).toEqual([]);
  expect(result.definition.message).toBe(initial.definition.message);
  expect(evaluatePhrase(phrase(initial, ['I', 'is', 'Marta']))).toMatchObject({
    form: 'agreement',
    goal: false,
  });
  expect(evaluatePhrase(phrase(initial, ['Marta', 'I', 'am']))).toMatchObject({
    form: 'order',
    goal: false,
  });
  expect(evaluatePhrase(initial)).toMatchObject({
    form: 'incomplete',
    goal: false,
  });
  const otherListener = {
    ...wrongName,
    definition: {
      ...wrongName.definition,
      message: {
        ...wrongName.definition.message!,
        recipient: 'marta' as const,
      },
    },
  };
  expect(evaluatePhrase(otherListener).goal).toBe(false);
  const differentSpeaker = {
    ...wrongName,
    definition: {
      ...wrongName.definition,
      message: { ...wrongName.definition.message!, speaker: 'lumi' as const },
    },
  };
  expect(evaluatePhrase(differentSpeaker).goal).toBe(true);
  const physicallyWrong = move(initial, 'RRULDLUUDDLUUDLU');
  expect(readPhrase(physicallyWrong)).toEqual(['I', 'am', 'Lumi']);
  expect(reducePuzzle(physicallyWrong, { type: 'apply' }).feedback).toBe(
    'context',
  );
  const wrongAgreement = move(initial, 'UUDDLLURDLLLURRDRUUDLU');
  expect(readPhrase(wrongAgreement)).toEqual(['I', 'is', 'Marta']);
  expect(reducePuzzle(wrongAgreement, { type: 'apply' }).feedback).toBe(
    'agreement',
  );
});
it('undo across the role change restores author, words and recorded messages; reset preserves attempts', () => {
  const first = reducePuzzle(move(createPuzzle(stationEpisode), 'U'), {
    type: 'apply',
  });
  const second = reducePuzzle(first, { type: 'continue' });
  const restored = reducePuzzle(second, { type: 'undo' });
  expect(restored.definition.message?.speaker).toBe('lumi');
  expect(restored.messages).toEqual(first.messages);
  expect(restored.pieces).toEqual(first.pieces);
  const reset = reducePuzzle(second, { type: 'reset' });
  expect(reset.definition).toBe(stationLevel);
  expect(reset.messages).toEqual([]);
  expect(reset.attempts).toEqual(first.attempts);
});
it('unlocks only the first station episode after the workshop, discovers on entry and preserves paused/revisited roles', () => {
  const session = createSession();
  expect(session.enterEpisode(stationEpisode)).toBe(false);
  completeWorkshop(session);
  expect(session.getSnapshot().completedChapters).toEqual(['workshop']);
  expect(session.getSnapshot().encounteredWords).not.toContain('I');
  expect(session.hasVisitedEpisode(stationEpisode)).toBe(false);
  session.setPaused('platform', true);
  expect(session.enterEpisode(stationEpisode)).toBe(false);
  session.setPaused('platform', false);
  expect(session.enterEpisode(stationEpisode)).toBe(true);
  expect(session.getSnapshot().encounteredWords).toContain('I');
  session.dispatch({ type: 'move', direction: 'up' });
  session.dispatch({ type: 'apply' });
  session.continueEpisode();
  session.setPaused('overlay', true);
  const before = session.getSnapshot().room;
  session.dispatch({ type: 'move', direction: 'up' });
  expect(session.getSnapshot().room).toBe(before);
  session.enterEpisode('cat');
  session.enterEpisode(stationEpisode);
  expect(session.getSnapshot().room.definition.message?.speaker).toBe('marta');
  expect(session.getSnapshot().room.messages).toHaveLength(1);
  session.setPaused('overlay', false);
  for (const key of 'UUDDLUUDLU')
    session.dispatch({ type: 'move', direction: directions[key]! });
  session.dispatch({ type: 'apply' });
  session.explain('speaker-lumi');
  expect(session.getSnapshot().completedEpisodes).not.toContain(stationEpisode);
  session.explain('speaker-marta');
  expect(session.getSnapshot().completedEpisodes).toContain(stationEpisode);
  expect(session.getSnapshot().completedChapters).toEqual(['workshop']);
  expect(session.getSnapshot().unlockedEpisodes).toHaveLength(15);
  expect(session.getSnapshot().unlockedEpisodes).toContain('chapter-02-02');
});
