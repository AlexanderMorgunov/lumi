import { createPuzzle, reducePuzzle } from '../domain/puzzle';
import type { PuzzleAction, PuzzleState } from '../domain/puzzle';
import type { EpisodeId, MeaningChoice } from '../domain/episodes';
import { nextEpisodes, reflections } from '../domain/episodes';
import { roomTerms, type WordId } from '../domain/wordbook';

export type PauseReason =
  | 'user'
  | 'hidden'
  | 'platform'
  | 'assets'
  | 'overlay'
  | 'presentation'
  | 'listening'
  | 'dialogue';
export type SessionSnapshot = {
  room: PuzzleState;
  paused: boolean;
  closed: boolean;
  externallyPaused: boolean;
  sceneSuspended: boolean;
  unlockedEpisodes: readonly EpisodeId[];
  completedEpisodes: readonly EpisodeId[];
  // Compatibility flag for the workshop; new consumers use completedChapters.
  chapterCompleted: boolean;
  completedChapters: readonly ('workshop' | 'station')[];
  encounteredWords: readonly WordId[];
  view: {
    grid: boolean;
    foreground: boolean;
    beacon: boolean;
    animations: boolean;
    reducedMotion: boolean;
  };
};

export function createSession() {
  const initialRoom = createPuzzle();
  let snapshot: SessionSnapshot = {
    room: initialRoom,
    paused: false,
    closed: false,
    externallyPaused: false,
    sceneSuspended: false,
    unlockedEpisodes: ['cat'],
    completedEpisodes: [],
    chapterCompleted: false,
    completedChapters: [],
    encounteredWords: roomTerms(initialRoom).sort(),
    view: {
      grid: true,
      foreground: true,
      beacon: false,
      animations: true,
      reducedMotion: false,
    },
  };
  const reasons = new Set<PauseReason>();
  const listeners = new Set<() => void>();
  const rooms = new Map<EpisodeId, PuzzleState>();
  function publish(next: SessionSnapshot) {
    const additions = roomTerms(next.room).filter(
      (word) => !snapshot.encounteredWords.includes(word),
    );
    snapshot = {
      ...next,
      // Discovery belongs to the journey, not to an undoable room snapshot.
      encounteredWords: additions.length
        ? [...snapshot.encounteredWords, ...additions].sort()
        : snapshot.encounteredWords,
      externallyPaused:
        next.closed || reasons.has('platform') || reasons.has('hidden'),
      // Dialogue pauses puzzle input; its character presentation may continue.
      sceneSuspended:
        next.closed || [...reasons].some((reason) => reason !== 'dialogue'),
    };
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action: PuzzleAction) {
      if (snapshot.paused || snapshot.closed) return;
      const room = reducePuzzle(snapshot.room, action);
      if (room !== snapshot.room)
        publish({
          ...snapshot,
          room,
          completedEpisodes:
            room.episode === 'cat' &&
            room.completed &&
            !snapshot.completedEpisodes.includes('cat')
              ? [...snapshot.completedEpisodes, 'cat']
              : snapshot.completedEpisodes,
          unlockedEpisodes:
            room.episode === 'cat' &&
            room.completed &&
            !snapshot.unlockedEpisodes.includes('key')
              ? [...snapshot.unlockedEpisodes, 'key']
              : snapshot.unlockedEpisodes,
        });
    },
    hasVisitedEpisode: (episode: EpisodeId) =>
      snapshot.room.episode === episode || rooms.has(episode),
    enterEpisode(
      episode: EpisodeId,
      { developmentPreview = false }: { developmentPreview?: boolean } = {},
    ): boolean {
      if (
        snapshot.closed ||
        snapshot.externallyPaused ||
        reasons.has('assets') ||
        (!snapshot.unlockedEpisodes.includes(episode) &&
          !(import.meta.env.DEV && developmentPreview))
      )
        return false;
      rooms.set(snapshot.room.episode, snapshot.room);
      const room = rooms.get(episode) ?? createPuzzle(episode);
      publish({
        ...snapshot,
        room: { ...room, revision: snapshot.room.revision + 1 },
      });
      return true;
    },
    explain(choice: MeaningChoice) {
      if (
        snapshot.closed ||
        snapshot.externallyPaused ||
        snapshot.room.episode === 'cat' ||
        !snapshot.room.completed ||
        snapshot.room.definition.continuation
      )
        return;
      const reflection = reflections[snapshot.room.episode];
      if (!reflection.choices.some((answer) => answer.id === choice)) return;
      // Chapter boundaries are separate from within-chapter lesson order.
      const next =
        snapshot.room.episode === 'chapterFinale'
          ? 'chapter-02-01'
          : nextEpisodes[snapshot.room.episode];
      const completedEpisodes =
        choice === reflection.correct &&
        !snapshot.completedEpisodes.includes(snapshot.room.episode)
          ? [...snapshot.completedEpisodes, snapshot.room.episode]
          : snapshot.completedEpisodes;
      const stationComplete = Object.keys(nextEpisodes)
        .filter((id) => id.startsWith('chapter-02-'))
        .every((id) => completedEpisodes.includes(id as EpisodeId));
      publish({
        ...snapshot,
        completedEpisodes,
        completedChapters:
          snapshot.room.episode === 'chapterFinale' &&
          choice === reflection.correct &&
          !snapshot.completedChapters.includes('workshop')
            ? [...snapshot.completedChapters, 'workshop']
            : stationComplete && !snapshot.completedChapters.includes('station')
              ? [...snapshot.completedChapters, 'station']
              : snapshot.completedChapters,
        chapterCompleted:
          snapshot.chapterCompleted ||
          (snapshot.room.episode === 'chapterFinale' &&
            choice === reflection.correct),
        unlockedEpisodes:
          next &&
          choice === reflection.correct &&
          !snapshot.unlockedEpisodes.includes(next)
            ? [...snapshot.unlockedEpisodes, next]
            : snapshot.unlockedEpisodes,
        room: {
          ...snapshot.room,
          explanations: [...snapshot.room.explanations, choice],
        },
      });
    },
    continueEpisode(): boolean {
      if (
        snapshot.closed ||
        snapshot.externallyPaused ||
        reasons.has('assets') ||
        !snapshot.room.completed ||
        !snapshot.room.definition.continuation
      )
        return false;
      const room = reducePuzzle(snapshot.room, { type: 'continue' });
      publish({ ...snapshot, room });
      return true;
    },
    setPaused(reason: PauseReason, paused: boolean) {
      if (snapshot.closed) return;
      if (paused) reasons.add(reason);
      else reasons.delete(reason);
      if (
        snapshot.paused !== reasons.size > 0 ||
        snapshot.externallyPaused !==
          (reasons.has('platform') || reasons.has('hidden')) ||
        snapshot.sceneSuspended !==
          [...reasons].some((reason) => reason !== 'dialogue')
      )
        publish({ ...snapshot, paused: reasons.size > 0 });
    },
    setView(view: Partial<SessionSnapshot['view']>) {
      if (snapshot.closed) return;
      publish({ ...snapshot, view: { ...snapshot.view, ...view } });
    },
    close() {
      publish({ ...snapshot, paused: true, closed: true });
    },
  };
}

export type GameSession = ReturnType<typeof createSession>;
