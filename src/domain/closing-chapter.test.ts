import { expect, it } from 'vitest';
import { closingEpisodes } from './closing-chapter';
import { levels, validateLevel } from './levels';
import {
  createPuzzle,
  evaluatePhrase,
  readPhrase,
  reducePuzzle,
  type Direction,
  type PuzzleState,
} from './puzzle';
import { createSession } from '../game/session';
import { nextEpisodes, reflections, type EpisodeId } from './episodes';

const arrows: Record<string, Direction> = {
  '↑': 'up',
  '↓': 'down',
  '←': 'left',
  '→': 'right',
};
const routes: Record<number, string> = {
  1: '↑ ↑ ↓ ← ← ← ← ↑ → → ↓ → ↑',
  3: '↑ ↑ ↓ ← ↑',
  5: '↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑',
};
function routeFor(state: PuzzleState, article: string) {
  if (
    state.definition.optionalLeadingArticle &&
    ['apples', 'eggs'].includes(article)
  )
    return ['up', 'up'] as Direction[];
  const x = state.pieces.find(
    (p) => p.kind === 'word' && p.word === article,
  )!.x;
  return routes[x]!.split(' ').map((arrow) => arrows[arrow]!);
}
function assemble(state: PuzzleState, article: string) {
  return routeFor(state, article).reduce(
    (s, direction) => reducePuzzle(s, { type: 'move', direction }),
    state,
  );
}
const ids = Object.keys(closingEpisodes) as (keyof typeof closingEpisodes)[];

it.each(ids)(
  '%s: all three choices are reachable in every part; form and context errors leave the world unchanged',
  (id) => {
    let state = createPuzzle(id);
    while (true) {
      expect(validateLevel(state.definition)).toEqual([]);
      const goal = state.definition.answers.find((a) => a.goal)!;
      for (const pattern of [
        ...state.definition.answers,
        ...state.definition.mistakes,
      ]) {
        const assembled = assemble(state, pattern.words[0]!);
        expect(readPhrase(assembled)).toEqual(pattern.words);
        const result = reducePuzzle(assembled, { type: 'apply' });
        const succeeds = 'goal' in pattern && pattern.goal;
        expect(result.completed).toBe(succeeds);
        expect(result.feedback).toBe(
          succeeds ? 'success' : 'reason' in pattern ? 'article' : 'context',
        );
        if (!succeeds) {
          expect(result.reference).toEqual(state.reference);
          expect(result.inventory).toEqual(state.inventory);
        } else {
          expect(result.attempts.at(-1)?.referentId).toBeTruthy();
          const restored = reducePuzzle(result, { type: 'undo' });
          expect(restored.reference).toEqual(state.reference);
          expect(restored.inventory).toEqual(state.inventory);
          expect(restored.attempts).toHaveLength(state.attempts.length + 1);
        }
      }
      const selectedId = state.reference?.indicatedId;
      const completed = reducePuzzle(assemble(state, goal.words[0]!), {
        type: 'apply',
      });
      if (state.definition.carryReference)
        expect(completed.attempts.at(-1)?.referentId).toBe(selectedId);
      expect(
        completed.reference?.objects.filter((o) => o.location !== 'table'),
      ).toHaveLength(1);
      if (!completed.definition.continuation) break;
      state = reducePuzzle(completed, { type: 'continue' });
      expect(reducePuzzle(state, { type: 'undo' }).reference).toEqual(
        completed.reference,
      );
      expect(reducePuzzle(state, { type: 'undo' }).definition).toBe(
        completed.definition,
      );
    }
  },
);

it('carries a visible, known object, rejects missing context, and resets the whole chain without erasing attempts or hints', () => {
  const initial = createPuzzle('keyChain');
  expect(reducePuzzle(initial, { type: 'continue' })).toBe(initial);
  const selected = reducePuzzle(assemble(initial, 'a'), { type: 'apply' });
  expect(selected.deliveredItem).toBe(false);
  expect(selected.reference?.objects[0]?.location).toBe('selected');
  let next = reducePuzzle(selected, { type: 'continue' });
  next = reducePuzzle(next, { type: 'hint' });
  const assembled = assemble(next, 'the');
  expect(
    evaluatePhrase({
      ...assembled,
      reference: { ...assembled.reference!, knownIds: [] },
    }).goal,
  ).toBe(false);
  const delivered = reducePuzzle(assembled, { type: 'apply' });
  expect(delivered.inventory[0]?.id).toBe(selected.reference?.indicatedId);
  const reset = reducePuzzle(delivered, { type: 'reset' });
  expect(reset.definition).toBe(levels.keyChain);
  expect(reset.reference).toEqual(initial.reference);
  expect(reset.inventory).toEqual([]);
  expect(reset.attempts).toHaveLength(2);
  expect(reset.hintUsed).toBe(true);
  expect(reset.stage).toBe(0);
});

it('keeps the robot at the door while the umbrella is collected, and Undo restores that inventory', () => {
  let state = createPuzzle('newWords');
  state = reducePuzzle(assemble(state, 'a'), { type: 'apply' });
  state = reducePuzzle(state, { type: 'continue' });
  state = reducePuzzle(assemble(state, 'the'), { type: 'apply' });
  const robot = state.inventory[0];
  expect(robot).toMatchObject({ noun: 'robot', location: 'door' });
  state = reducePuzzle(state, { type: 'continue' });
  state = reducePuzzle(assemble(state, 'an'), { type: 'apply' });
  expect(state.inventory).toContainEqual(robot);
  expect(state.inventory).toHaveLength(2);
  expect(reducePuzzle(state, { type: 'undo' }).inventory).toEqual([robot]);
});

it('unlocks the entire chapter only after final parts and reflections, respects interruption, and retains completion on replay', () => {
  const session = createSession();
  const early: Partial<Record<EpisodeId, string>> = {
    cat: '↑',
    key: '← ↑ ↓ → → → ↑ ← ↓ ← ↑',
    apple: '↑',
    egg: routes[5],
    choiceKey: routes[5],
    choiceApple: '↑ ↑ ↓ ← ← ← ↑ → ↓ → ↑',
    theKey: routes[5],
    theApple: routes[5],
  };
  let episode: EpisodeId | null = 'cat';
  const encountered = new Set<string>();
  while (episode) {
    expect(session.enterEpisode(episode)).toBe(true);
    while (true) {
      const room = session.getSnapshot().room;
      for (const piece of room.pieces)
        if (piece.kind === 'word') encountered.add(piece.word);
      expect(session.getSnapshot().encounteredWords).toEqual(
        [...encountered].sort(),
      );
      expect(session.continueEpisode()).toBe(false);
      const route =
        early[episode]?.split(' ').map((arrow) => arrows[arrow]!) ??
        routeFor(room, room.definition.answers.find((a) => a.goal)!.words[0]!);
      route.forEach((direction) =>
        session.dispatch({ type: 'move', direction }),
      );
      session.dispatch({ type: 'apply' });
      expect(session.getSnapshot().room.completed).toBe(true);
      if (!room.definition.continuation) break;
      if (episode !== 'cat') session.explain(reflections[episode].correct);
      expect(session.getSnapshot().unlockedEpisodes).not.toContain(
        nextEpisodes[episode],
      );
      session.setPaused('platform', true);
      expect(session.continueEpisode()).toBe(false);
      session.setPaused('platform', false);
      session.setPaused('dialogue', true);
      expect(session.continueEpisode()).toBe(true);
      session.setPaused('dialogue', false);
    }
    if (episode !== 'cat') {
      const reflection = reflections[episode];
      session.explain(
        reflection.choices.find((a) => a.id !== reflection.correct)!.id,
      );
      expect(session.getSnapshot().chapterCompleted).toBe(false);
      if (nextEpisodes[episode])
        expect(session.enterEpisode(nextEpisodes[episode]!)).toBe(false);
      session.explain(reflection.correct);
    }
    episode = nextEpisodes[episode];
  }
  expect(session.getSnapshot().chapterCompleted).toBe(true);
  expect(session.getSnapshot().encounteredWords).toHaveLength(13);
  expect(session.getSnapshot().unlockedEpisodes).toHaveLength(14);
  session.enterEpisode('newWords');
  expect(session.getSnapshot().room.stage).toBe(2);
  expect(
    session.getSnapshot().room.inventory.find((o) => o.noun === 'robot')
      ?.location,
  ).toBe('door');
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot().encounteredWords).toEqual(
    [...encountered].sort(),
  );
  expect(session.getSnapshot().room.stage).toBe(0);
  expect(session.getSnapshot().chapterCompleted).toBe(true);
  session.close();
  expect(session.continueEpisode()).toBe(false);
});
