import { expect, it, vi } from 'vitest';
import { createSession } from './session';
import type { Direction } from '../domain/puzzle';
import type { EpisodeId, MeaningChoice } from '../domain/episodes';
import { episodes } from '../domain/episodes';

it('previews implemented episodes without granting completion or unlocking the normal route', () => {
  const session = createSession();
  session.dispatch({ type: 'move', direction: 'left' });
  const initial = session.getSnapshot().room;
  for (const id of Object.keys(episodes) as EpisodeId[]) {
    expect(session.enterEpisode(id, { developmentPreview: true })).toBe(true);
    expect(session.getSnapshot().room.episode).toBe(id);
  }
  expect(session.getSnapshot().unlockedEpisodes).toEqual(['cat']);
  expect(session.getSnapshot().completedEpisodes).toEqual([]);
  expect(session.getSnapshot().completedChapters).toEqual([]);
  expect(session.enterEpisode('cat')).toBe(true);
  expect(session.getSnapshot().room.x).toBe(initial.x);
  expect(session.getSnapshot().room.history).toEqual(initial.history);
  expect(session.enterEpisode('chapter-02-01')).toBe(false);
});

it('development entry still respects platform, hidden, assets and closed states', () => {
  const session = createSession();
  for (const reason of ['platform', 'hidden', 'assets'] as const) {
    session.setPaused(reason, true);
    expect(
      session.enterEpisode('chapter-02-01', { developmentPreview: true }),
    ).toBe(false);
    session.setPaused(reason, false);
  }
  session.close();
  expect(
    session.enterEpisode('chapter-02-01', { developmentPreview: true }),
  ).toBe(false);
});

it('refuses the development override outside a development build', () => {
  vi.stubEnv('DEV', false);
  try {
    const session = createSession();
    expect(
      session.enterEpisode('chapter-02-01', { developmentPreview: true }),
    ).toBe(false);
    expect(session.getSnapshot().room.episode).toBe('cat');
  } finally {
    vi.unstubAllEnvs();
  }
});

it('discovers words only on entry and keeps them across undo, reset and revisits', () => {
  const session = createSession();
  expect(session.getSnapshot().encounteredWords).toEqual(['a', 'cat']);
  expect(session.enterEpisode('apple')).toBe(false);
  session.dispatch({ type: 'move', direction: 'up' });
  session.dispatch({ type: 'apply' });
  expect(session.getSnapshot().unlockedEpisodes).toContain('key');
  expect(session.getSnapshot().encounteredWords).toEqual(['a', 'cat']);
  session.setPaused('platform', true);
  expect(session.enterEpisode('key')).toBe(false);
  expect(session.getSnapshot().encounteredWords).toEqual(['a', 'cat']);
  session.setPaused('platform', false);
  expect(session.enterEpisode('key')).toBe(true);
  expect(session.getSnapshot().encounteredWords).toEqual(['a', 'cat', 'key']);
  session.dispatch({ type: 'move', direction: 'up' });
  session.dispatch({ type: 'undo' });
  session.dispatch({ type: 'reset' });
  session.enterEpisode('cat');
  session.dispatch({ type: 'undo' });
  session.enterEpisode('key');
  expect(session.getSnapshot().encounteredWords).toEqual(['a', 'cat', 'key']);
  expect(createSession().getSnapshot().encounteredWords).toEqual(['a', 'cat']);
});

it('unlocks both parts of episode five only after the preceding result and explanation, preserving each room', () => {
  const session = createSession();
  expect(session.enterEpisode('choiceKey')).toBe(false);
  expect(session.enterEpisode('choiceApple')).toBe(false);
  expect(session.enterEpisode('theKey')).toBe(false);
  expect(session.enterEpisode('theApple')).toBe(false);
  const right: Direction[] = [
    'up',
    'up',
    'down',
    'right',
    'right',
    'up',
    'left',
    'left',
    'down',
    'left',
    'up',
  ];
  const steps: {
    id: EpisodeId;
    route: Direction[];
    correct?: MeaningChoice;
  }[] = [
    { id: 'cat', route: ['up'] },
    {
      id: 'key',
      route: [
        'left',
        'up',
        'down',
        'right',
        'right',
        'right',
        'up',
        'left',
        'down',
        'left',
        'up',
      ],
      correct: 'any',
    },
    { id: 'apple', route: ['up'], correct: 'vowel' },
    { id: 'egg', route: right, correct: 'egg-any' },
    { id: 'choiceKey', route: right, correct: 'choice-consonant' },
    {
      id: 'choiceApple',
      route: [
        'up',
        'up',
        'down',
        'left',
        'left',
        'left',
        'up',
        'right',
        'down',
        'right',
        'up',
      ],
      correct: 'choice-vowel',
    },
    { id: 'theKey', route: right, correct: 'the-shared' },
    { id: 'theApple', route: right, correct: 'apple-shared' },
  ];
  for (const step of steps) {
    expect(session.enterEpisode(step.id)).toBe(true);
    for (const direction of step.route)
      session.dispatch({ type: 'move', direction });
    if (step.id === 'choiceKey') {
      session.explain('choice-consonant');
      expect(session.enterEpisode('choiceApple')).toBe(false);
    }
    session.dispatch({ type: 'apply' });
    expect(session.getSnapshot().room.completed).toBe(true);
    if (step.id === 'choiceKey') {
      session.explain('choice-position');
      expect(session.enterEpisode('choiceApple')).toBe(false);
      session.setPaused('platform', true);
      session.explain('choice-consonant');
      expect(session.getSnapshot().unlockedEpisodes).not.toContain(
        'choiceApple',
      );
      session.setPaused('platform', false);
    }
    if (step.id === 'choiceApple') {
      session.explain('choice-previous');
      expect(session.enterEpisode('theKey')).toBe(false);
    }
    if (step.id === 'theKey') {
      session.explain('the-sound');
      expect(session.enterEpisode('theApple')).toBe(false);
    }
    if (step.correct) session.explain(step.correct);
  }
  expect(session.getSnapshot().unlockedEpisodes).toEqual([
    ...steps.map((s) => s.id),
    'keyChain',
  ]);
  session.enterEpisode('choiceKey');
  session.dispatch({ type: 'undo' });
  expect(session.getSnapshot().room.deliveredItem).toBe(false);
  expect(session.getSnapshot().room.explanations).toEqual([
    'choice-position',
    'choice-consonant',
  ]);
  session.enterEpisode('choiceApple');
  expect(session.getSnapshot().room.deliveredItem).toBe(true);
  expect(session.getSnapshot().room.explanations).toEqual([
    'choice-previous',
    'choice-vowel',
  ]);
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot().room.attempts).toHaveLength(1);
  expect(session.getSnapshot().room.explanations).toEqual([
    'choice-previous',
    'choice-vowel',
  ]);
  session.enterEpisode('theKey');
  expect(session.getSnapshot().room.reference?.objects[1]?.location).toBe(
    'bag',
  );
  session.setPaused('platform', true);
  session.dispatch({ type: 'undo' });
  expect(session.getSnapshot().room.reference?.objects[1]?.location).toBe(
    'bag',
  );
  session.setPaused('platform', false);
  session.dispatch({ type: 'undo' });
  expect(session.getSnapshot().room.reference?.objects[1]?.location).toBe(
    'table',
  );
  expect(session.getSnapshot().room.explanations).toEqual([
    'the-sound',
    'the-shared',
  ]);
  session.enterEpisode('theApple');
  expect(session.getSnapshot().room.reference?.objects[0]?.location).toBe(
    'bag',
  );
  expect(session.getSnapshot().room.explanations).toEqual(['apple-shared']);
});

it('keeps independent pause reasons and never resumes a closed session', () => {
  const session = createSession();
  session.setPaused('user', true);
  session.setPaused('platform', true);
  session.setPaused('platform', false);
  session.dispatch({ type: 'move', direction: 'right' });
  expect(session.getSnapshot().room.moves).toBe(0);
  session.setPaused('user', false);
  session.dispatch({ type: 'move', direction: 'right' });
  expect(session.getSnapshot().room.moves).toBe(1);
  session.close();
  session.setPaused('platform', false);
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot()).toMatchObject({
    closed: true,
    paused: true,
    room: { moves: 1 },
  });
});

it('keeps separate episode histories and progress, including through undo and host interruption', () => {
  const session = createSession();
  expect(session.enterEpisode('key')).toBe(false);
  session.dispatch({ type: 'move', direction: 'up' });
  session.dispatch({ type: 'apply' });
  expect(session.getSnapshot().unlockedEpisodes.includes('key')).toBe(true);
  session.setPaused('dialogue', true);
  expect(session.enterEpisode('key')).toBe(true);
  expect(session.getSnapshot().room).toMatchObject({
    episode: 'key',
    moves: 0,
    history: [],
    attempts: [],
  });
  session.setPaused('dialogue', false);
  session.dispatch({ type: 'hint' });
  session.dispatch({ type: 'move', direction: 'left' });
  session.enterEpisode('cat');
  expect(session.getSnapshot().room.completed).toBe(true);
  session.dispatch({ type: 'undo' });
  expect(session.getSnapshot().room).toMatchObject({
    episode: 'cat',
    completed: false,
    moves: 1,
  });
  session.enterEpisode('key');
  expect(session.getSnapshot().room).toMatchObject({
    episode: 'key',
    hintUsed: true,
    moves: 1,
  });
  session.setPaused('platform', true);
  const interrupted = session.getSnapshot();
  expect(session.enterEpisode('cat')).toBe(false);
  session.explain('any');
  expect(session.getSnapshot()).toBe(interrupted);
  session.setPaused('platform', false);
  session.dispatch({ type: 'undo' });
  expect(session.getSnapshot().room).toMatchObject({
    episode: 'key',
    moves: 0,
    hintUsed: true,
  });
});

it('keeps meaning answers distinct from puzzle completion and retains them on reset', () => {
  const session = createSession();
  session.dispatch({ type: 'move', direction: 'up' });
  session.dispatch({ type: 'apply' });
  session.enterEpisode('key');
  session.explain('any');
  expect(session.getSnapshot().room.explanations).toEqual([]);
  for (const direction of [
    'left',
    'up',
    'down',
    'right',
    'right',
    'right',
    'up',
    'left',
    'down',
    'left',
    'up',
  ] as const)
    session.dispatch({ type: 'move', direction });
  session.dispatch({ type: 'apply' });
  session.setPaused('dialogue', true);
  expect(session.enterEpisode('apple')).toBe(false);
  session.explain('vowel');
  expect(session.getSnapshot().room.explanations).toEqual([]);
  session.explain('several');
  expect(session.enterEpisode('apple')).toBe(false);
  session.explain('any');
  expect(session.getSnapshot().room.completed).toBe(true);
  session.setPaused('dialogue', false);
  session.dispatch({ type: 'undo' });
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot().room.explanations).toEqual(['several', 'any']);
  expect(session.getSnapshot().room.attempts).toHaveLength(1);
  expect(session.getSnapshot().unlockedEpisodes.includes('apple')).toBe(true);
  session.setPaused('platform', true);
  expect(session.enterEpisode('apple')).toBe(false);
  session.setPaused('platform', false);
  expect(session.enterEpisode('apple')).toBe(true);
  expect(session.getSnapshot().room.explanations).toEqual([]);
  session.dispatch({ type: 'move', direction: 'up' });
  session.dispatch({ type: 'apply' });
  session.explain('any');
  expect(session.getSnapshot().room.explanations).toEqual([]);
  session.explain('many');
  expect(session.enterEpisode('egg')).toBe(false);
  session.setPaused('hidden', true);
  session.explain('vowel');
  expect(session.getSnapshot().room.explanations).toEqual(['many']);
  session.setPaused('hidden', false);
  session.explain('vowel');
  expect(session.getSnapshot().unlockedEpisodes.includes('egg')).toBe(true);
  session.enterEpisode('key');
  expect(session.getSnapshot().room.explanations).toEqual(['several', 'any']);
  session.enterEpisode('apple');
  expect(session.getSnapshot().room.explanations).toEqual(['many', 'vowel']);
  session.dispatch({ type: 'undo' });
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot().room).toMatchObject({
    episode: 'apple',
    moves: 0,
    deliveredItem: false,
    explanations: ['many', 'vowel'],
  });
  session.setPaused('platform', true);
  expect(session.enterEpisode('egg')).toBe(false);
  session.setPaused('platform', false);
  expect(session.enterEpisode('egg')).toBe(true);
  session.explain('egg-any');
  expect(session.getSnapshot().room.explanations).toEqual([]);
  for (const direction of [
    'up',
    'up',
    'down',
    'right',
    'right',
    'up',
    'left',
    'left',
    'down',
    'left',
    'up',
  ] as const)
    session.dispatch({ type: 'move', direction });
  session.dispatch({ type: 'apply' });
  session.explain('vowel');
  expect(session.getSnapshot().room.explanations).toEqual([]);
  session.explain('egg-many');
  session.explain('egg-any');
  session.enterEpisode('apple');
  expect(session.getSnapshot().room.explanations).toEqual(['many', 'vowel']);
  session.enterEpisode('egg');
  session.dispatch({ type: 'undo' });
  session.dispatch({ type: 'reset' });
  expect(session.getSnapshot().room).toMatchObject({
    episode: 'egg',
    moves: 0,
    deliveredItem: false,
    explanations: ['egg-many', 'egg-any'],
  });
  session.close();
  const closed = session.getSnapshot();
  session.explain('egg-specific');
  expect(session.enterEpisode('apple')).toBe(false);
  expect(session.getSnapshot()).toBe(closed);
});

it('releases observers on unmount', () => {
  const session = createSession();
  const listener = vi.fn();
  const off = session.subscribe(listener);
  session.dispatch({ type: 'move', direction: 'up' });
  off();
  session.dispatch({ type: 'reset' });
  expect(listener).toHaveBeenCalledTimes(1);
});

it('publishes host interruptions during a paused presentation without resuming play', () => {
  const session = createSession();
  session.setPaused('presentation', true);
  const listener = vi.fn();
  session.subscribe(listener);
  session.setPaused('platform', true);
  expect(session.getSnapshot()).toMatchObject({
    paused: true,
    externallyPaused: true,
  });
  expect(listener).toHaveBeenCalledTimes(1);
  session.setPaused('platform', false);
  expect(session.getSnapshot()).toMatchObject({
    paused: true,
    externallyPaused: false,
  });
  session.setPaused('hidden', true);
  session.setPaused('presentation', false);
  session.dispatch({ type: 'move', direction: 'right' });
  expect(session.getSnapshot().room.moves).toBe(0);
  session.setPaused('hidden', false);
  session.dispatch({ type: 'move', direction: 'right' });
  expect(session.getSnapshot().room.moves).toBe(1);
});
