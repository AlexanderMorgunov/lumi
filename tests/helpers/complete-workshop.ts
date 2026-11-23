import {
  nextEpisodes,
  reflections,
  type EpisodeId,
} from '../../src/domain/episodes';
import type { Direction } from '../../src/domain/puzzle';
import type { GameSession } from '../../src/game/session';

// Drive the real reducer using the checked chapter-one routes. Test fixture only.
export function completeWorkshop(session: GameSession) {
  const arrows: Record<string, Direction> = {
    U: 'up',
    D: 'down',
    L: 'left',
    R: 'right',
  };
  const routes: Record<number, string> = {
    1: 'UUDLLLLURRD RU'.replaceAll(' ', ''),
    3: 'UUDLU',
    5: 'UUDRRULLDLU',
  };
  const early: Partial<Record<EpisodeId, string>> = {
    cat: 'U',
    key: 'LUDRRRULDLU',
    apple: 'U',
    egg: routes[5],
    choiceKey: routes[5],
    choiceApple: 'UUDLLLURDRU',
    theKey: routes[5],
    theApple: routes[5],
  };
  let id: EpisodeId | null = 'cat';
  while (id) {
    if (!session.enterEpisode(id)) throw Error(`Locked fixture episode ${id}`);
    while (true) {
      const room = session.getSnapshot().room;
      const word = room.definition.answers.find((a) => a.goal)!.words[0]!;
      const x = room.pieces.find(
        (p) => p.kind === 'word' && p.word === word,
      )!.x;
      const route =
        early[id] ??
        (room.definition.optionalLeadingArticle &&
        ['apples', 'eggs'].includes(word)
          ? 'UU'
          : routes[x]!);
      for (const arrow of route)
        session.dispatch({ type: 'move', direction: arrows[arrow]! });
      session.dispatch({ type: 'apply' });
      if (!session.getSnapshot().room.completed)
        throw Error(`Unsolved fixture ${room.definition.id}`);
      if (!room.definition.continuation) break;
      session.continueEpisode();
    }
    if (id !== 'cat') session.explain(reflections[id].correct);
    id = nextEpisodes[id];
  }
}
