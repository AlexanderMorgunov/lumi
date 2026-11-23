import { expect, it } from 'vitest';
import { createSession } from './session';
import { frameFeedback } from './frame-feedback';
import { createPuzzle, reducePuzzle, type Direction } from '../domain/puzzle';
import {
  chapterOneStops,
  journeyChapters,
  stopStatus,
} from '../domain/journey';

it('distinguishes a formed phrase from fulfilled request without mutating the puzzle', () => {
  const start = createPuzzle();
  expect(frameFeedback(start)).toBe('empty');
  const formed = reducePuzzle(start, { type: 'move', direction: 'up' });
  const before = JSON.stringify(formed);
  expect(frameFeedback(formed)).toBe('assembled');
  expect(JSON.stringify(formed)).toBe(before);
  expect(frameFeedback(reducePuzzle(formed, { type: 'apply' }))).toBe(
    'success',
  );
  const route: Direction[] = [
    'up',
    'up',
    'down',
    'left',
    'left',
    'left',
    'left',
    'up',
    'right',
    'right',
    'down',
    'right',
    'up',
  ];
  const wrongContext = route.reduce(
    (room, direction) => reducePuzzle(room, { type: 'move', direction }),
    createPuzzle('theKey'),
  );
  expect(frameFeedback(wrongContext)).toBe('assembled');
  expect(reducePuzzle(wrongContext, { type: 'apply' }).completed).toBe(false);
});

it('keeps completed lanterns lit after undo/reset; episode five needs both requests', () => {
  const session = createSession();
  session.dispatch({ type: 'move', direction: 'up' });
  session.dispatch({ type: 'apply' });
  session.dispatch({ type: 'undo' });
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot().completedEpisodes).toContain('cat');
  expect(chapterOneStops).toHaveLength(12);
  expect(stopStatus(chapterOneStops[4]!, ['choiceKey'], ['choiceKey'])).toBe(
    'available',
  );
  expect(
    stopStatus(
      chapterOneStops[4]!,
      ['choiceKey', 'choiceApple'],
      ['choiceKey', 'choiceApple'],
    ),
  ).toBe('completed');
  expect(journeyChapters.filter((chapter) => chapter.available)).toHaveLength(
    1,
  );
});

it('allows presentation during dialogue but suspends it on each independent pause', () => {
  const session = createSession();
  session.setPaused('dialogue', true);
  expect(session.getSnapshot()).toMatchObject({
    paused: true,
    sceneSuspended: false,
  });
  session.dispatch({ type: 'move', direction: 'up' });
  expect(session.getSnapshot().room.moves).toBe(0);
  session.setPaused('overlay', true);
  expect(session.getSnapshot().sceneSuspended).toBe(true);
  session.setPaused('platform', true);
  session.setPaused('platform', false);
  expect(session.getSnapshot().sceneSuspended).toBe(true);
  session.setPaused('overlay', false);
  expect(session.getSnapshot()).toMatchObject({
    paused: true,
    sceneSuspended: false,
  });
  session.close();
  session.setPaused('dialogue', false);
  expect(session.getSnapshot().sceneSuspended).toBe(true);
});
