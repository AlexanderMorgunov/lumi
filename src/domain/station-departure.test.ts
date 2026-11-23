import { expect, it } from 'vitest';
import { departureLevels, departureReflections } from './station-departure';
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
import { exchangeVariants } from '../../tests/helpers/exchange-variants';
import { exchangeStatus, exchangeText } from './station-exchange';
import { catVoiceClip } from '../game/cat-voice';
import { createSession } from '../game/session';
import { nextEpisodes } from './episodes';
import { isWordId } from './wordbook';

const ids = Object.keys(departureLevels) as (keyof typeof departureLevels)[];
const walk = (state: PuzzleState, words: readonly string[]) =>
  solveStation(state, words).reduce(
    (s, direction) => reducePuzzle(s, { type: 'move', direction }),
    state,
  );
function parts(root: LevelDefinition) {
  const result: LevelDefinition[] = [];
  for (
    let level: LevelDefinition | undefined = root;
    level;
    level = level.continuation
  )
    result.push(level);
  return result;
}
it.each(ids)(
  '%s: all parts and permitted contractions are solvable with real moves, have matching voice and Undo restores facts',
  (id) => {
    let state = createPuzzle(id);
    let count = 0;
    while (true) {
      count++;
      expect(validateLevel(state.definition)).toEqual([]);
      for (const p of state.pieces)
        if (p.kind === 'word') expect(isWordId(p.word), p.word).toBe(true);
      state.definition.presentation!.introduction.forEach((text, i) =>
        expect(catVoiceClip(state, 'task', i)).toMatchObject({
          sourceText: text,
        }),
      );
      const full = state.definition.answers[0]!.words;
      const variants =
        state.definition.message?.exchange?.act === 'short-answer'
          ? [[...full]]
          : exchangeVariants(full);
      for (const words of variants.filter((words) =>
        words.every((word) =>
          state.pieces.some((p) => p.kind === 'word' && p.word === word),
        ),
      )) {
        const formed = walk(state, words);
        expect(readPhrase(formed)).toEqual(words);
        expect(
          evaluatePhrase(formed),
          `${state.definition.id}: ${words.join(' ')}`,
        ).toMatchObject({ form: 'valid', goal: true });
        const done = reducePuzzle(formed, { type: 'apply' });
        expect(done.completed).toBe(true);
        expect(done.messages.at(-1)?.text).toBe(
          state.definition.message?.exchange
            ? exchangeText(words)
            : words.join(' '),
        );
        expect(done.reference).toEqual(state.reference);
        expect(done.definition.message?.exchange).toEqual(
          state.definition.message?.exchange,
        );
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
    expect(count).toBe(
      {
        'chapter-02-11': 4,
        'chapter-02-12': 7,
        'chapter-02-13': 4,
        'chapter-02-14': 4,
        'chapter-02-15': 3,
      }[id],
    );
  },
);

it('accepts grammar without accepting the wrong group, fact, speech act or answer format', () => {
  for (const id of ids)
    for (const level of parts(departureLevels[id])) {
      const state = createPuzzle(id, level);
      for (const alternative of level.answers.slice(1)) {
        const formed = walk(state, alternative.words);
        expect(
          evaluatePhrase(formed),
          `${level.id}: ${alternative.words.join(' ')}`,
        ).toMatchObject({ form: 'valid', goal: false });
        const result = reducePuzzle(formed, { type: 'apply' });
        expect(result.messages).toEqual([]);
        expect(result.reference).toEqual(state.reference);
      }
    }
});

it('questions succeed with both yes and no; facts are hidden until an answer and restored on Undo', () => {
  for (const level of parts(departureLevels['chapter-02-14'])) {
    const initial = createPuzzle('chapter-02-14', level);
    const context = level.message!.exchange!;
    expect(exchangeStatus(context, false)).toContain('ответ ещё не получен');
    expect(exchangeStatus(context, false)).not.toContain(context.evidence);
    const done = reducePuzzle(walk(initial, level.answers[0]!.words), {
      type: 'apply',
    });
    expect(done.completed).toBe(true);
    expect(done.messages.at(-1)?.question).toBe(true);
    expect(done.messages.at(-1)?.reply).toContain(
      context.ready ? 'Да,' : 'Нет,',
    );
    expect(done.messages.at(-1)?.reply).toContain(context.evidence);
    const undone = reducePuzzle(done, { type: 'undo' });
    expect(exchangeStatus(context, undone.completed)).not.toContain(
      context.evidence,
    );
    expect(undone.messages).toEqual([]);
  }
});

it('rejects contracted positive short answers but recognises full replies as grammatical format alternatives', () => {
  for (const level of parts(departureLevels['chapter-02-15'])) {
    const initial = createPuzzle('chapter-02-15', level);
    const full = level.answers[0]!.words;
    const short = exchangeVariants(full)[1]!;
    expect(evaluateWords(level, short)).toMatchObject({
      form: 'agreement',
      goal: false,
    });
    expect(evaluatePhrase(walk(initial, short)).goal).toBe(false);
    const long = [...short, 'ready'];
    expect(evaluatePhrase(walk(initial, long))).toMatchObject({
      form: 'valid',
      goal: false,
      explanation: expect.stringContaining('правильный полный ответ'),
    });
  }
});

it('requires correct agreement and contiguous placement, without accepting a crate in a shortened frame', () => {
  expect(
    evaluateWords(departureLevels['chapter-02-11'], ['We', 'are']).form,
  ).toBe('incomplete');
  expect(
    evaluateWords(departureLevels['chapter-02-15'], ['Yes', 'I']).form,
  ).toBe('incomplete');
  const level = departureLevels['chapter-02-13'];
  const initial = createPuzzle('chapter-02-13');
  for (const words of [
    ['I', 'are', 'not', 'ready'],
    ['I', 'not', 'am', 'ready'],
    ['I', 'am', '', 'ready'],
  ])
    expect(evaluateWords(level, words).goal).toBe(false);
  const formed = walk(initial, ["I'm", 'not', 'ready']);
  const blocked = {
    ...formed,
    pieces: [
      ...formed.pieces,
      { id: 'block', kind: 'crate' as const, ...level.slots.at(-1)! },
    ],
  };
  expect(evaluatePhrase(blocked).goal).toBe(false);
  const shifted = {
    ...formed,
    pieces: formed.pieces.map((p) =>
      p.kind === 'word' && p.word === 'ready'
        ? { ...p, ...level.slots.at(-1)! }
        : p,
    ),
  };
  expect(evaluatePhrase(shifted).goal).toBe(false);
  expect(
    validateLevel({
      ...level,
      message: {
        ...level.message!,
        exchange: { ...level.message!.exchange!, selfGroup: ['lumi'] },
      },
    }),
  ).toContain('Invalid exchange roles or facts');
});

it('unlocks 11–15 only after every part and meaning check; vocabulary and completion never jump to the future', () => {
  const session = createSession();
  expect(session.enterEpisode('chapter-02-11')).toBe(false);
  expect(nextEpisodes['chapter-02-10']).toBe('chapter-02-11');
  session.enterEpisode('chapter-02-11', { developmentPreview: true });
  expect(session.getSnapshot().encounteredWords).toContain('We');
  expect(session.getSnapshot().encounteredWords).not.toContain('Yes');
  for (const id of ids) {
    if (id !== 'chapter-02-11') expect(session.enterEpisode(id)).toBe(true);
    while (true) {
      const room = session.getSnapshot().room;
      for (const direction of solveStation(
        room,
        room.definition.answers[0]!.words,
      ))
        session.dispatch({ type: 'move', direction });
      session.dispatch({ type: 'apply' });
      if (!room.definition.continuation) break;
      session.explain(departureReflections[id].correct);
      expect(session.getSnapshot().completedEpisodes).not.toContain(id);
      session.continueEpisode();
    }
    const reflection = departureReflections[id];
    session.explain(
      reflection.choices.find((c) => c.id !== reflection.correct)!.id,
    );
    expect(session.getSnapshot().completedEpisodes).not.toContain(id);
    session.explain(reflection.correct);
    expect(session.getSnapshot().completedEpisodes).toContain(id);
    expect(session.getSnapshot().completedChapters).not.toContain('station');
  }
  expect(nextEpisodes['chapter-02-15']).toBe('chapter-02-16');
  expect(session.getSnapshot().encounteredWords).toEqual(
    expect.arrayContaining(['Yes', 'not', "aren't", 'They']),
  );
});
