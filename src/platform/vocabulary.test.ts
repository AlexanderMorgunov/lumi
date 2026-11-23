import { expect, it, vi } from 'vitest';
import { createVocabularyAccess } from './vocabulary';

it('waits for explicit capture, prevents duplicates and respects pause', async () => {
  let blocked = false;
  let resolve: (value: unknown) => void = () => {};
  const port = vi.fn(
    () =>
      new Promise<unknown>((r) => {
        resolve = r;
      }),
  );
  const access = createVocabularyAccess(() => blocked);
  await access.capture('cat', 'room');
  access.bind('ready', port);
  expect(port).not.toHaveBeenCalled();
  blocked = true;
  await access.capture('cat', 'room');
  expect(port).not.toHaveBeenCalled();
  blocked = false;
  const pending = access.capture('cat', 'room');
  await access.capture('cat', 'room');
  await access.capture('key', 'room');
  expect(port).toHaveBeenCalledExactlyOnceWith({
    term: 'cat',
    translation: 'кот / кошка',
    context: 'room',
  });
  expect(access.getSnapshot().entries.cat?.status).toBe('pending');
  resolve({ status: 'saved' });
  await pending;
  await access.capture('cat', 'room');
  expect(port).toHaveBeenCalledTimes(1);
  expect(access.getSnapshot().entries.cat?.status).toBe('saved');
});

it.each(['existing', 'cancelled'] as const)(
  'reports %s without claiming a new save',
  async (status) => {
    const access = createVocabularyAccess(() => false);
    access.bind('ready', async () => ({ status }));
    await access.capture('key', 'room');
    expect(access.getSnapshot().entries.key?.status).toBe(status);
  },
);

it.each([null, {}, { status: 'ok' }, { status: ['saved'] }])(
  'rejects malformed result %j without retrying',
  async (result) => {
    const access = createVocabularyAccess(() => false);
    const port = vi.fn(async () => result);
    access.bind('ready', port);
    await access.capture('key', 'room');
    expect(access.getSnapshot().entries.key?.status).toBe('error');
    expect(port).toHaveBeenCalledTimes(1);
  },
);

it('ignores a late response after close, and keeps earlier saved words', async () => {
  const access = createVocabularyAccess(() => false);
  access.bind('ready', async () => ({ status: 'saved' }));
  await access.capture('cat', 'room');
  let resolve: (value: unknown) => void = () => {};
  access.bind(
    'ready',
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = access.capture('key', 'room');
  access.bind('closed');
  resolve({ status: 'saved' });
  await pending;
  expect(access.getSnapshot()).toMatchObject({
    availability: 'closed',
    entries: { cat: { status: 'saved' }, key: { status: 'error' } },
  });
});
