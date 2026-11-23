import { describe, expect, it, vi } from 'vitest';
import type { GameContext } from '@dayenglish/game-sdk';
import { createSession } from '../game/session';
import { attachDayEnglish, validateHostOrigin } from './dayenglish';
import type { PlatformConnection } from './dayenglish';
import { createVocabularyAccess } from './vocabulary';

const options = {
  hostOrigin: 'http://localhost:5173',
  gameId: 'integration-demo',
  releaseId: '1.0.0',
};
const context: GameContext = {
  gameId: options.gameId,
  releaseId: options.releaseId,
  locale: 'ru',
  reducedMotion: true,
  capabilities: ['save'],
};

function fixture() {
  let settle: (value: GameContext) => void = () => {};
  let fail: (reason: Error) => void = () => {};
  let event: Parameters<PlatformConnection['onEvent']>[0] = () => {};
  const ready = new Promise<GameContext>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  const off = vi.fn();
  const connection: PlatformConnection = {
    ready,
    request: () =>
      Promise.reject(new Error('Requests are outside this fixture')),
    onEvent: (listener) => {
      event = listener;
      return off;
    },
    close: vi.fn(),
  };
  return {
    connection,
    off,
    settle,
    fail,
    emit: (type: 'paused' | 'resumed' | 'closed') => event({ type }),
    view: (expanded: boolean) => event({ type: 'view.changed', expanded }),
  };
}

describe('SDK lifecycle boundary', () => {
  it('updates window controls without resuming a host-paused game and hides controls on close', async () => {
    const f = fixture();
    const session = createSession();
    const onWindow = vi.fn();
    const detach = attachDayEnglish(
      session,
      options,
      vi.fn(),
      () => f.connection,
      undefined,
      onWindow,
    );
    f.settle({
      ...context,
      capabilities: ['view.window.v1'],
      view: { expanded: false },
    });
    await Promise.resolve();
    expect(onWindow).toHaveBeenLastCalledWith(
      expect.objectContaining({ expanded: false }),
    );
    f.emit('paused');
    f.view(true);
    expect(onWindow).toHaveBeenLastCalledWith(
      expect.objectContaining({ expanded: true }),
    );
    expect(session.getSnapshot().externallyPaused).toBe(true);
    f.emit('closed');
    expect(onWindow).toHaveBeenLastCalledWith(null);
    detach();
  });
  it('enables capture only for the exact capability and matching launch context', async () => {
    for (const variant of [
      { ...context, capabilities: ['vocabulary.capture.v1'] },
      { ...context, capabilities: ['vocabulary.capture'] },
      {
        ...context,
        gameId: 'another-game',
        capabilities: ['vocabulary.capture.v1'],
      },
    ]) {
      const f = fixture();
      const session = createSession();
      const vocabulary = createVocabularyAccess(
        () => session.getSnapshot().externallyPaused,
      );
      const detach = attachDayEnglish(
        session,
        options,
        vi.fn(),
        () => f.connection,
        vocabulary,
      );
      expect(vocabulary.getSnapshot().availability).toBe('connecting');
      f.settle(variant);
      await Promise.resolve();
      await Promise.resolve();
      const valid = variant.gameId === options.gameId;
      expect(vocabulary.getSnapshot().availability).toBe(
        valid && variant.capabilities.includes('vocabulary.capture.v1')
          ? 'ready'
          : 'unavailable',
      );
      expect(session.getSnapshot().view.reducedMotion).toBe(valid);
      expect(session.getSnapshot().externallyPaused).toBe(!valid);
      f.emit('closed');
      expect(vocabulary.getSnapshot().availability).toBe('closed');
      detach();
    }
  });
  it('reports a synchronous SDK rejection without crashing the React tree', async () => {
    const session = createSession();
    const status = vi.fn();
    const detach = attachDayEnglish(session, options, status, () => {
      throw new Error('invalid_host');
    });
    await Promise.resolve();
    expect(session.getSnapshot().paused).toBe(true);
    expect(status).toHaveBeenCalledWith(
      expect.stringContaining('внутри DayEnglish'),
    );
    detach();
  });
  it('waits for ready and preserves user pause on host resume', async () => {
    const f = fixture();
    const session = createSession();
    const status = vi.fn();
    const detach = attachDayEnglish(
      session,
      options,
      status,
      () => f.connection,
    );
    expect(session.getSnapshot().paused).toBe(true);
    f.emit('resumed');
    expect(session.getSnapshot().paused).toBe(true);
    f.settle(context);
    await Promise.resolve();
    expect(session.getSnapshot().paused).toBe(false);
    session.setPaused('user', true);
    f.emit('paused');
    f.emit('resumed');
    expect(session.getSnapshot().paused).toBe(true);
    f.emit('closed');
    f.emit('resumed');
    expect(session.getSnapshot().closed).toBe(true);
    detach();
    expect(f.off).toHaveBeenCalledOnce();
    expect(f.connection.close).toHaveBeenCalledOnce();
  });
  it('ignores late ready after disposal', async () => {
    const f = fixture();
    const session = createSession();
    const status = vi.fn();
    const detach = attachDayEnglish(
      session,
      options,
      status,
      () => f.connection,
    );
    detach();
    session.setPaused('platform', true);
    f.settle(context);
    await Promise.resolve();
    expect(status).not.toHaveBeenCalled();
    expect(session.getSnapshot().paused).toBe(true);
  });
  it('keeps the room paused and reports handshake failure', async () => {
    const f = fixture();
    const session = createSession();
    const status = vi.fn();
    const detach = attachDayEnglish(
      session,
      options,
      status,
      () => f.connection,
    );
    f.fail(new Error('timeout'));
    await Promise.resolve();
    await Promise.resolve();
    expect(status).toHaveBeenCalledWith(expect.stringContaining('Не удалось'));
    expect(session.getSnapshot().paused).toBe(true);
    detach();
  });
});

it('accepts exact origins and rejects insecure or path-bearing origins', () => {
  expect(validateHostOrigin(options.hostOrigin)).toBe(options.hostOrigin);
  expect(validateHostOrigin('https://dayenglish.ru')).toBe(
    'https://dayenglish.ru',
  );
  for (const origin of [
    'https://dayenglish.ru/game',
    'https://dayenglish.ru/',
    'http://example.com',
    'https://user:pass@example.com',
    'null',
  ]) {
    expect(() => validateHostOrigin(origin)).toThrow();
  }
});
