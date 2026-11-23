import { expect, it } from 'vitest';
import { stationNextLevels, stationNextReflections } from './station-next';
import {
  createPuzzle,
  evaluatePhrase,
  evaluateWords,
  readPhrase,
  reducePuzzle,
  type PuzzleState,
} from './puzzle';
import { validateLevel, type LevelDefinition } from './levels';
import { solveStation } from '../../tests/helpers/solve-station';
import { createSession } from '../game/session';
import { catVoiceClip } from '../game/cat-voice';
import { nextEpisodes } from './episodes';
import { isWordId } from './wordbook';

const ids = Object.keys(
  stationNextLevels,
) as (keyof typeof stationNextLevels)[];
const short: Readonly<Record<string, string>> = {
  I: "I'm",
  You: "You're",
  He: "He's",
  She: "She's",
  It: "It's",
};
const walk = (state: PuzzleState, words: readonly string[], slotOffset = 0) =>
  solveStation(state, words, slotOffset).reduce(
    (s, direction) => reducePuzzle(s, { type: 'move', direction }),
    state,
  );

it.each(ids)(
  '%s: every part and full/short alternative is reachable, voiced, undoable and preserves its reference',
  (id) => {
    let state = createPuzzle(id);
    let parts = 0;
    while (true) {
      parts++;
      expect(validateLevel(state.definition)).toEqual([]);
      expect(readPhrase(state).every((word) => word === '')).toBe(true);
      for (const piece of state.pieces)
        if (piece.kind === 'word')
          expect(isWordId(piece.word), piece.word).toBe(true);
      for (const [
        index,
        text,
      ] of state.definition.presentation!.introduction.entries())
        expect(catVoiceClip(state, 'task', index)).toMatchObject({
          sourceText: text,
        });
      const full = state.definition.answers[0]!.words;
      const options = [
        full,
        ...(state.definition.allowContractions
          ? [[short[full[0]!]!, ...full.slice(2)]]
          : []),
      ];
      for (const words of options) {
        if (words.length < full.length) {
          const rightAligned = walk(state, words, 1);
          expect(readPhrase(rightAligned)).toEqual(words);
          expect(evaluatePhrase(rightAligned)).toMatchObject({
            form: 'valid',
            goal: true,
          });
        }
        const formed = walk(state, words);
        expect(readPhrase(formed)).toEqual(words);
        expect(evaluatePhrase(formed)).toMatchObject({
          form: 'valid',
          goal: true,
        });
        const done = reducePuzzle(formed, { type: 'apply' });
        expect(done.completed).toBe(true);
        expect(done.messages.at(-1)?.text).toBe(words.join(' '));
        expect(done.reference).toEqual(state.reference);
        expect(done.inventory).toEqual([]);
        expect(done.deliveredItem).toBe(false);
        const undone = reducePuzzle(done, { type: 'undo' });
        expect(undone.messages).toEqual(state.messages);
        expect(undone.completed).toBe(false);
        expect(undone.attempts.at(-1)?.words).toEqual(words);
      }
      state = reducePuzzle(walk(state, full), { type: 'apply' });
      if (!state.definition.continuation) break;
      const previous = state;
      state = reducePuzzle(state, { type: 'continue' });
      expect(reducePuzzle(state, { type: 'undo' }).definition).toBe(
        previous.definition,
      );
    }
    expect(parts).toBe(
      {
        'chapter-02-06': 5,
        'chapter-02-07': 3,
        'chapter-02-08': 4,
        'chapter-02-09': 3,
        'chapter-02-10': 3,
      }[id],
    );
  },
);

it('separates well-formed but wrong labels and roles from grammar errors in every new part', () => {
  for (const id of ids) {
    let definition: LevelDefinition | undefined = stationNextLevels[id];
    while (definition) {
      const state = createPuzzle(id, definition);
      for (const alternative of definition.answers.slice(1)) {
        const formed = walk(state, alternative.words);
        expect(
          evaluatePhrase(formed),
          `${definition.id}: ${alternative.words.join(' ')}`,
        ).toMatchObject({ form: 'valid', goal: false });
        const result = reducePuzzle(formed, { type: 'apply' });
        expect(result.completed).toBe(false);
        expect(result.messages).toEqual([]);
        expect(result.reference).toEqual(state.reference);
      }
      for (const mistake of definition.mistakes)
        expect(evaluateWords(definition, [...mistake.words]).form).toBe(
          mistake.reason,
        );
      if (definition.message?.intent === 'label-group') {
        const formed = walk(state, definition.answers[0]!.words);
        expect(evaluatePhrase({ ...formed, reference: null }).goal).toBe(false);
      }
      definition = definition.continuation;
    }
  }
});

it('accepts a contiguous contraction at either edge, rejects holes and objects, and preserves older lessons', () => {
  const initial = createPuzzle('chapter-02-06');
  const formed = walk(initial, ["I'm", 'Lumi']);
  const shifted = walk(initial, ["I'm", 'Lumi'], 1);
  expect(readPhrase(shifted)).toEqual(["I'm", 'Lumi']);
  expect(evaluatePhrase(shifted)).toMatchObject({ form: 'valid', goal: true });
  const complete = reducePuzzle(shifted, { type: 'apply' });
  expect(complete.completed).toBe(true);
  expect(complete.messages.at(-1)?.text).toBe("I'm Lumi");
  expect(reducePuzzle(complete, { type: 'undo' }).pieces).toEqual(
    shifted.pieces,
  );
  expect(
    evaluatePhrase({
      ...shifted,
      pieces: [
        ...shifted.pieces,
        { id: 'edge-crate', kind: 'crate', ...initial.definition.slots[0]! },
      ],
    }).goal,
  ).toBe(false);
  const blocked = {
    ...formed,
    pieces: [
      ...formed.pieces,
      {
        id: 'crate',
        kind: 'crate' as const,
        ...initial.definition.slots.at(-1)!,
      },
    ],
  };
  expect(evaluatePhrase(blocked).goal).toBe(false);
  const hole = {
    ...formed,
    pieces: formed.pieces.map((p) =>
      p.kind === 'word' && p.word === 'Lumi'
        ? { ...p, ...initial.definition.slots.at(-1)! }
        : p,
    ),
  };
  expect(evaluatePhrase(hole).goal).toBe(false);
  const repeatedBe = walk(initial, ["I'm", 'am', 'Lumi']);
  expect(evaluatePhrase(repeatedBe)).toMatchObject({
    form: 'mismatch',
    goal: false,
    explanation: expect.stringContaining('второй раз'),
  });
  expect(
    evaluateWords(createPuzzle('chapter-02-01').definition, ["I'm", 'Lumi'])
      .goal,
  ).toBe(false);
});

it('unlocks 6–10 in order only after all parts and explanation; vocabulary appears when encountered, not in advance', () => {
  const session = createSession();
  expect(session.getSnapshot().encounteredWords).not.toContain("I'm");
  expect(session.enterEpisode('chapter-02-06')).toBe(false);
  expect(nextEpisodes['chapter-02-05']).toBe('chapter-02-06');
  session.enterEpisode('chapter-02-06', { developmentPreview: true });
  expect(session.getSnapshot().encounteredWords).toContain("I'm");
  expect(session.getSnapshot().encounteredWords).not.toContain('children');
  for (const id of ids) {
    if (id !== 'chapter-02-06') expect(session.enterEpisode(id)).toBe(true);
    while (true) {
      const room = session.getSnapshot().room;
      for (const direction of solveStation(
        room,
        room.definition.answers[0]!.words,
      ))
        session.dispatch({ type: 'move', direction });
      session.dispatch({ type: 'apply' });
      if (!room.definition.continuation) break;
      session.explain(stationNextReflections[id].correct);
      expect(session.getSnapshot().completedEpisodes).not.toContain(id);
      session.continueEpisode();
    }
    const reflection = stationNextReflections[id];
    session.explain(
      reflection.choices.find((c) => c.id !== reflection.correct)!.id,
    );
    expect(session.getSnapshot().completedEpisodes).not.toContain(id);
    session.explain(reflection.correct);
    expect(session.getSnapshot().completedEpisodes).toContain(id);
    expect(session.getSnapshot().completedChapters).not.toContain('station');
  }
  expect(session.getSnapshot().encounteredWords).toEqual(
    expect.arrayContaining(['children', 'people', 'boxes', 'stories', "I'm"]),
  );
  expect(nextEpisodes['chapter-02-10']).toBe('chapter-02-11');
});
