import { expect, it } from 'vitest';
import { finaleLevels, finaleReflections } from './station-finale';
import {
  createPuzzle,
  evaluatePhrase,
  evaluateWords,
  reducePuzzle,
  type PuzzleState,
} from './puzzle';
import { validateLevel, type LevelDefinition } from './levels';
import { solveStation } from '../../tests/helpers/solve-station';
import { exchangeVariants } from '../../tests/helpers/exchange-variants';
import { exchangeStatus } from './station-exchange';
import { catVoiceClip } from '../game/cat-voice';
import { isWordId } from './wordbook';
import { createSession } from '../game/session';
import { nextEpisodes, reflections } from './episodes';
import { levels } from './levels';

const ids = Object.keys(finaleLevels) as (keyof typeof finaleLevels)[];
const walk = (state: PuzzleState, words: readonly string[]) =>
  solveStation(state, words).reduce(
    (room, direction) => reducePuzzle(room, { type: 'move', direction }),
    state,
  );
const parts = (root: LevelDefinition) => {
  const result: LevelDefinition[] = [];
  for (
    let part: LevelDefinition | undefined = root;
    part;
    part = part.continuation
  )
    result.push(part);
  return result;
};
it.each(ids)(
  '%s: every accepted form and contraction is solvable; facts survive apply/Undo; dialogue has matching voice',
  (id) => {
    for (const level of parts(finaleLevels[id])) {
      expect(validateLevel(level), level.id).toEqual([]);
      const initial = createPuzzle(id, level);
      for (const tile of level.pieces)
        if (tile.kind === 'word')
          expect(isWordId(tile.word), tile.word).toBe(true);
      level.presentation!.introduction.forEach((sourceText, index) =>
        expect(catVoiceClip(initial, 'task', index)).toMatchObject({
          sourceText,
        }),
      );
      const inquiry = level.message!.exchange!.inquiry!;
      for (const canonical of inquiry.accepted) {
        const variants = exchangeVariants(canonical).filter(
          (surface) =>
            surface.every((w) =>
              level.pieces.some((p) => p.kind === 'word' && p.word === w),
            ) && !(surface[0] === 'Yes' && surface.length === 2),
        );
        for (const variant of variants) {
          const formed = walk(initial, variant);
          expect(
            evaluatePhrase(formed),
            `${level.id}: ${variant.join(' ')}`,
          ).toMatchObject({ form: 'valid', goal: true });
          const done = reducePuzzle(formed, { type: 'apply' });
          expect(done.completed).toBe(true);
          if (inquiry.authorLabel)
            expect(done.messages.at(-1)?.authorLabel).toBe(inquiry.authorLabel);
          expect(done.reference).toEqual(initial.reference);
          expect(done.definition.message).toEqual(initial.definition.message);
          expect(exchangeStatus(level.message!.exchange!, true)).toBe(
            inquiry.reply,
          );
          const undone = reducePuzzle(done, { type: 'undo' });
          expect(undone.completed).toBe(false);
          expect(undone.messages).toEqual(initial.messages);
          expect(undone.attempts.at(-1)?.words).toEqual(variant);
          expect(exchangeStatus(level.message!.exchange!, false)).toBe(
            inquiry.before,
          );
        }
      }
      for (const candidate of level.answers.filter(
        (answer) =>
          !inquiry.accepted.some(
            (accepted) => accepted.join(' ') === answer.words.join(' '),
          ),
      )) {
        expect(
          evaluatePhrase(walk(initial, candidate.words)),
          `${level.id}: wrong fact or intent`,
        ).toMatchObject({ form: 'valid', goal: false });
      }
    }
  },
);
it('has 25 new parts; distinguishes negative short answers from positive contractions and full answers', () => {
  expect(ids.map((id) => parts(finaleLevels[id]).length)).toEqual([
    6, 5, 4, 4, 6,
  ]);
  const negative = finaleLevels['chapter-02-16'];
  expect(evaluateWords(negative, ['No', 'We', 'are', 'not']).form).toBe(
    'valid',
  );
  expect(evaluateWords(negative, ['No', "We're", 'not']).form).toBe('valid');
  expect(evaluateWords(negative, ['Yes', "We're"]).form).toBe('agreement');
  expect(evaluateWords(negative, ['No', 'We', 'is', 'not']).goal).toBe(false);
  expect(evaluateWords(negative, ['No', 'We', 'are']).form).toBe('incomplete');
  expect(
    evaluatePhrase(
      walk(createPuzzle('chapter-02-16'), ['No', 'We', 'are', 'not', 'ready']),
    ),
  ).toMatchObject({
    form: 'valid',
    goal: false,
    explanation: expect.stringContaining('полный ответ'),
  });
});
it('supports both location and age answers, keeps letter authors distinct, and never changes facts through Yes', () => {
  const letter = parts(finaleLevels['chapter-02-19'])[1]!;
  expect(letter.message!.exchange!.inquiry!.authorLabel).toBe(
    'Нора · текст письма',
  );
  expect(letter.message!.exchange!.inquiry!.accepted).toContainEqual([
    'I',
    'am',
    'eight',
    'years',
    'old',
  ]);
  const no = parts(finaleLevels['chapter-02-20'])[3]!;
  const state = walk(createPuzzle('chapter-02-20', no), ['Yes', 'I', 'am']);
  const attempt = reducePuzzle(state, { type: 'apply' });
  expect(attempt.completed).toBe(false);
  expect(attempt.reference).toEqual(state.reference);
  expect(no.presentation!.continuationAction).toBe('Дать Тику время на сборы');
  expect(no.continuation!.message!.exchange!.inquiry!.before).toContain(
    'Позже',
  );
  const truthful = reducePuzzle(
    walk(createPuzzle('chapter-02-20', no), ['No', 'I', 'am', 'not']),
    { type: 'apply' },
  );
  const later = reducePuzzle(truthful, { type: 'continue' });
  expect(later.definition).toBe(no.continuation);
  const restored = reducePuzzle(later, { type: 'undo' });
  expect(restored.definition).toBe(no);
  expect(restored.reference).toEqual(truthful.reference);
  const broken = {
    ...letter,
    message: {
      ...letter.message!,
      exchange: {
        ...letter.message!.exchange!,
        inquiry: {
          ...letter.message!.exchange!.inquiry!,
          accepted: [['I', 'am', 'ten']],
        },
      },
    },
  };
  expect(validateLevel(broken)).toContain('Invalid authored inquiry');
});
it('unlocks new vocabulary on encounter and completes station only after all twenty episodes', () => {
  const session = createSession();
  expect(session.enterEpisode('chapter-02-16')).toBe(false);
  session.enterEpisode('chapter-02-16', { developmentPreview: true });
  expect(session.getSnapshot().encounteredWords).toContain('No');
  expect(session.getSnapshot().encounteredWords).not.toContain('Where');
  // Completing the final block through DEV must not mark all preceding lessons complete.
  for (const id of ids) {
    expect(session.enterEpisode(id, { developmentPreview: true })).toBe(true);
    while (true) {
      const room = session.getSnapshot().room;
      for (const direction of solveStation(
        room,
        room.definition.answers[0]!.words,
      ))
        session.dispatch({ type: 'move', direction });
      session.dispatch({ type: 'apply' });
      if (!room.definition.continuation) break;
      session.explain(finaleReflections[id].correct);
      expect(session.getSnapshot().completedEpisodes).not.toContain(id);
      session.continueEpisode();
    }
    session.explain(
      finaleReflections[id].choices.find(
        (choice) => choice.id !== finaleReflections[id].correct,
      )!.id,
    );
    expect(session.getSnapshot().completedEpisodes).not.toContain(id);
    session.explain(finaleReflections[id].correct);
    expect(session.getSnapshot().completedEpisodes).toContain(id);
    expect(session.getSnapshot().completedChapters).not.toContain('station');
  }
  expect(nextEpisodes['chapter-02-20']).toBeNull();
  expect(session.getSnapshot().encounteredWords).toEqual(
    expect.arrayContaining(['Where', 'eight', 'years']),
  );
  for (const id of Object.keys(levels).filter(
    (id): id is Extract<keyof typeof levels, `chapter-02-${string}`> =>
      id.startsWith('chapter-02-') &&
      !ids.includes(id as keyof typeof finaleLevels),
  )) {
    session.enterEpisode(id, { developmentPreview: true });
    while (true) {
      const room = session.getSnapshot().room;
      const answer = room.definition.answers.find((candidate) => {
        const placed = {
          ...room,
          pieces: room.pieces.map((piece) => {
            const index =
              piece.kind === 'word' ? candidate.words.indexOf(piece.word) : -1;
            return {
              ...piece,
              ...(index < 0
                ? { x: 0, y: room.definition.rows - 1 }
                : room.definition.slots[index]!),
            };
          }),
        };
        return evaluatePhrase(placed).goal;
      });
      expect(answer, room.definition.id).toBeDefined();
      for (const direction of solveStation(room, answer!.words))
        session.dispatch({ type: 'move', direction });
      session.dispatch({ type: 'apply' });
      if (!room.definition.continuation) break;
      session.continueEpisode();
    }
    session.explain(reflections[id].correct);
  }
  expect(session.getSnapshot().completedChapters).toContain('station');
});
