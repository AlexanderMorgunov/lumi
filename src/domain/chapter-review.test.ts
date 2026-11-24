import { expect, it } from 'vitest';
import { levels, type LevelDefinition } from './levels';
import { reflections } from './episodes';
import {
  createPuzzle,
  evaluatePhrase,
  evaluateWords,
  readPhrase,
} from './puzzle';
import { exchangeVariants } from '../../tests/helpers/exchange-variants';
import { reflectionOrder } from './reflection-order';
import {
  childFrame,
  stationIllustrations,
} from '../game/station-illustrations';

const parts = Object.entries(levels)
  .filter(([id]) => id.startsWith('chapter-02'))
  .flatMap(([episode, root]) => {
    const result: { episode: keyof typeof levels; level: LevelDefinition }[] =
      [];
    for (
      let level: LevelDefinition | undefined = root;
      level;
      level = level.continuation
    )
      result.push({ episode: episode as keyof typeof levels, level });
    return result;
  });

it('gives every illustrated record in all 76 chapter parts artwork, with two different children', () => {
  expect(parts).toHaveLength(76);
  for (const { level } of parts)
    for (const object of level.reference?.objects ?? []) {
      if (object.display !== 'record') continue;
      const pictures = stationIllustrations(object);
      expect(pictures.length, level.id).toBeGreaterThan(0);
      if (object.count === 2) expect(pictures).toHaveLength(2);
      if (object.noun === 'children')
        expect(pictures.map((p) => p.texture)).toEqual(['nora', 'younger']);
    }
  const age = parts.filter((p) => p.episode === 'chapter-02-19');
  expect(age.map((p) => p.level.reference!.objects[0]!.illustration)).toEqual([
    'nora',
    'nora',
    'younger',
    'younger',
  ]);
  expect(age[0]!.level.presentation!.introduction.join(' ')).toContain(
    'ещё не',
  );
});

it('keeps the unknown baggage picture identical for either answer; reveals closed/open only after the answer', () => {
  const object = { id: 'departure-baggage', noun: 'bag', label: 'багаж' };
  expect(stationIllustrations(object, { ready: true, unknown: true })).toEqual(
    stationIllustrations(object, { ready: false, unknown: true }),
  );
  expect(
    stationIllustrations(object, { ready: true, unknown: false }),
  ).not.toEqual(stationIllustrations(object, { ready: false, unknown: false }));
  expect(childFrame('nora', 1850, true)).toBe(1);
  expect(childFrame('younger', 1850, true)).not.toBe(1);
  for (const name of ['nora', 'younger'] as const)
    for (const time of [1850, 4500, 5100])
      expect(childFrame(name, time, false)).toBe(0);
});

it('accepts every available exchange answer at either edge and rejects internal gaps or occupied edges', () => {
  let checked = 0;
  for (const { episode, level } of parts.filter(
    (p) => p.level.message?.exchange,
  )) {
    for (const canonical of level.message!.exchange!.inquiry?.accepted ?? [
      level.answers[0]!.words,
    ])
      for (const words of exchangeVariants(canonical)) {
        if (
          evaluateWords(level, words).goal !== true ||
          !words.every((w) =>
            level.pieces.some((p) => p.kind === 'word' && p.word === w),
          )
        )
          continue;
        for (const offset of new Set([0, level.slots.length - words.length])) {
          const state = {
            ...createPuzzle(episode),
            definition: level,
            pieces: words.map((word, i) => ({
              id: `word-${i}`,
              kind: 'word' as const,
              word,
              ...level.slots[i + offset]!,
            })),
          };
          expect(readPhrase(state)).toEqual(words);
          expect(evaluatePhrase(state), level.id).toMatchObject({
            form: 'valid',
            goal: true,
          });
          checked++;
          if (offset > 0) {
            const blocked = {
              ...state,
              pieces: [
                ...state.pieces,
                { id: 'box', kind: 'crate' as const, ...level.slots[0]! },
              ],
            };
            expect(evaluatePhrase(blocked).goal).toBe(false);
            if (words.length > 1) {
              const gap = {
                ...state,
                pieces: state.pieces.map((p, i) =>
                  i === 0 ? { ...p, ...level.slots[0]! } : p,
                ),
              };
              expect(evaluatePhrase(gap).goal).toBe(false);
            }
          }
        }
      }
  }
  expect(checked).toBeGreaterThan(100);
});

it('explains the missing article in the final introduction without demanding articles for names or plurals', () => {
  const friend = parts.find(
    (p) => p.level.id === 'chapter-02-20-friend',
  )!.level;
  expect(evaluateWords(friend, ["He's", 'robot'])).toMatchObject({
    form: 'article',
    goal: false,
    explanation: expect.stringContaining('нужен a'),
  });
  expect(evaluateWords(friend, ["He's", 'a', 'robot'])).toMatchObject({
    form: 'valid',
    goal: true,
  });
  for (const { level } of parts.filter((p) => p.level.message?.exchange))
    for (const answer of level.answers.filter((a) => a.goal))
      expect(evaluateWords(level, [...answer.words]).form).toBe('valid');
});

it('balances reflection positions while retaining IDs, wording and stable retry order', () => {
  const counts = [0, 0, 0];
  for (const [id, reflection] of Object.entries(reflections).filter(([id]) =>
    id.startsWith('chapter-02'),
  )) {
    const ordered = reflectionOrder<{ id: string }>(
      id,
      reflection.choices,
      reflection.correct,
    );
    expect(new Set(ordered)).toEqual(new Set(reflection.choices));
    expect(
      reflectionOrder<{ id: string }>(
        id,
        reflection.choices,
        reflection.correct,
      ),
    ).toEqual(ordered);
    counts[ordered.findIndex((c) => c.id === reflection.correct)]!++;
  }
  expect(counts).toEqual([7, 8, 5]);
});
