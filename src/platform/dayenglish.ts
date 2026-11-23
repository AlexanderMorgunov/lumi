import { connectDayEnglish } from '@dayenglish/game-sdk';
import type { GameSession } from '../game/session';
import type { VocabularyAccess } from './vocabulary';

export type PlatformConnection = ReturnType<typeof connectDayEnglish>;
export type PlatformOptions = Parameters<typeof connectDayEnglish>[0];
export type GameWindowControl = {
  expanded: boolean;
  setExpanded: (expanded: boolean) => Promise<void>;
};

export function validateHostOrigin(value: string) {
  const url = new URL(value);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    url.origin !== value ||
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
  ) {
    throw new Error(
      'Нужен точный HTTPS origin хоста; HTTP разрешён только для localhost.',
    );
  }
  return value;
}

// Own one connection per mounted game, never one per scene or render frame.
export function attachDayEnglish(
  session: GameSession,
  options: PlatformOptions,
  onStatus: (status: string) => void,
  connect: typeof connectDayEnglish = connectDayEnglish,
  vocabulary?: VocabularyAccess,
  onWindow?: (control: GameWindowControl | null) => void,
) {
  validateHostOrigin(options.hostOrigin);
  session.setPaused('platform', true);
  vocabulary?.bind('connecting');
  let active = true;
  let connection: PlatformConnection;
  try {
    connection = connect(options);
  } catch {
    queueMicrotask(() => {
      if (active) vocabulary?.bind('unavailable');
      if (active)
        onStatus(
          'Запустите игру внутри DayEnglish. SDK недоступен в отдельной вкладке.',
        );
    });
    return () => {
      active = false;
      vocabulary?.bind('unavailable');
      session.setPaused('platform', false);
    };
  }
  let hostPaused = false;
  let ready = false;
  let windowAvailable = false;
  const publishWindow = (expanded: boolean) =>
    onWindow?.({
      expanded,
      async setExpanded(next) {
        if (!active || !windowAvailable || hostPaused)
          throw new Error('unavailable');
        const result = await connection.request(
          'view.set',
          { expanded: next },
          { timeoutMs: 5000 },
        );
        if (active && typeof result?.expanded === 'boolean')
          publishWindow(result.expanded);
      },
    });
  const unsubscribe = connection.onEvent((event) => {
    if (!active) return;
    const { type } = event;
    if (event.type === 'view.changed') {
      if (windowAvailable && typeof event.expanded === 'boolean')
        publishWindow(event.expanded);
      return;
    }
    if (type === 'closed') {
      active = false;
      onWindow?.(null);
      vocabulary?.bind('closed');
      session.close();
      onStatus('DayEnglish закрыл сессию. Откройте игру заново из платформы.');
    } else {
      hostPaused = type === 'paused';
      session.setPaused('platform', !ready || hostPaused);
    }
  });
  void connection.ready
    .then((context) => {
      if (!active) return;
      if (
        !context ||
        context.gameId !== options.gameId ||
        context.releaseId !== options.releaseId ||
        typeof context.locale !== 'string' ||
        typeof context.reducedMotion !== 'boolean' ||
        !Array.isArray(context.capabilities) ||
        !context.capabilities.every(
          (capability) => typeof capability === 'string',
        )
      )
        throw new Error('Invalid host context');
      ready = true;
      windowAvailable = context.capabilities.includes('view.window.v1');
      if (windowAvailable) publishWindow(context.view?.expanded === true);
      session.setView({ reducedMotion: context.reducedMotion === true });
      vocabulary?.bind(
        context.capabilities.includes('vocabulary.capture.v1')
          ? 'ready'
          : 'unavailable',
        context.capabilities.includes('vocabulary.capture.v1')
          ? (payload) => {
              if (!active || hostPaused || session.getSnapshot().closed)
                return Promise.reject(new Error('closed_or_paused'));
              return connection.request('vocabulary.capture', payload);
            }
          : null,
      );
      session.setPaused('platform', hostPaused);
      onStatus(
        `DayEnglish подключён · SDK: ${context.capabilities.join(', ')}`,
      );
    })
    .catch(() => {
      if (active) vocabulary?.bind('unavailable');
      if (active)
        onStatus(
          'Не удалось подключиться к DayEnglish. Проверьте запуск из хоста и перезагрузите игру.',
        );
    });
  return () => {
    active = false;
    onWindow?.(null);
    vocabulary?.bind('unavailable');
    unsubscribe();
    connection.close();
    session.setPaused('platform', false);
  };
}
