import { episodes } from '../domain/episodes';
import type { PuzzleState } from '../domain/puzzle';
import { stationArt, stationIllustrations } from './station-illustrations';

const texturePaths = new Map<string, string>([
  ['forest', 'art/lantern-and-moss/forest-v1.webp'],
  ['room', 'art/lantern-and-moss/room-v1.webp'],
  ['foreground', 'art/lantern-and-moss/foreground-v1.webp'],
  ['brass-key', 'art/lantern-and-moss/key-v1.webp'],
  ['lumi', 'art/lumi/lumi-v1.webp'],
  ['cat-picture', 'art/lumi/cat-v1.webp'],
  ['lumi-emotes', 'art/lumi/lumi-emotes-v1.webp'],
  ['cat-emotes', 'art/lumi/cat-emotes-v1.webp'],
  ['station', 'art/station/station-v1.webp'],
  ['marta-emotes', 'art/station/marta-emotes-v1.webp'],
  ['tik-emotes', 'art/station/tik-emotes-v1.webp'],
  ['book', 'art/props/book-v1.webp'],
  ['orange', 'art/props/orange-v1.webp'],
  ['robot', 'art/props/robot-v1.webp'],
  ['umbrella', 'art/props/umbrella-v1.webp'],
  ['travel-bag', 'art/props/travel-bag-v1.webp'],
  ['apple', 'art/props/apple-v1.webp'],
  ['apple-green', 'art/props/apple-green-v1.webp'],
  ['egg', 'art/props/egg-v1.webp'],
  ...stationArt.map(
    (name) => [name, `art/station/review-v1/${name}.webp`] as const,
  ),
]);

const propTextures = new Map([
  ['key', 'brass-key'],
  ['apples', 'apple'],
  ['eggs', 'egg'],
  ['robots', 'robot'],
  ['books', 'book'],
  ['keys', 'brass-key'],
]);

export const propTexture = (noun: string) => propTextures.get(noun) ?? noun;

export function roomTextures(room: PuzzleState): Set<string> {
  const keys = new Set(['forest', 'lumi', 'lumi-emotes']);
  const { episode, definition } = room;
  if (definition.message) {
    keys.add('station').add('marta-emotes').add('tik-emotes');
  } else {
    keys.add('room').add('foreground').add('cat-emotes');
    keys.add(episode === 'cat' ? 'cat-picture' : 'travel-bag');
    const noun = episodes[episode].noun;
    if (noun === 'key' || noun === 'apple' || episode === 'egg')
      keys.add('brass-key');
    if (noun === 'apple' || episode === 'egg') keys.add('apple');
    if (episode === 'egg') keys.add('egg');
    if (room.reference?.objects.some((object) => object.color === 'green'))
      keys.add('apple-green');
    if (
      room.inventory.some(
        (object) => object.noun === 'robot' && object.location === 'door',
      )
    )
      keys.add('robot');
  }
  if (definition.presentation) {
    for (const object of room.reference?.objects ?? []) {
      if (object.display !== 'record') {
        keys.add(propTexture(object.noun));
        continue;
      }
      for (const { texture } of stationIllustrations(object)) keys.add(texture);
      // Both states of the baggage drawing can appear in this room.
      if (object.id === 'departure-baggage') {
        for (const { texture } of stationIllustrations(object, {
          ready: false,
          unknown: false,
        }))
          keys.add(texture);
      }
    }
  }
  return keys;
}

const attemptTimeout = 15_000;
const retryDelays = [750, 1500];

class SceneRequestError extends Error {
  constructor(readonly retryable: boolean) {
    super('Scene image request failed');
  }
}

async function requestImage(
  url: string,
  signal: AbortSignal,
  retry: boolean,
): Promise<Blob> {
  signal.throwIfAborted();
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, attemptTimeout);
  try {
    const response = await fetch(url, {
      signal: request.signal,
      cache: retry ? 'reload' : 'default',
    });
    if (!response.ok) {
      const status = response.status;
      throw new SceneRequestError(
        status === 408 || status === 429 || status >= 500,
      );
    }
    return await response.blob();
  } catch (error) {
    signal.throwIfAborted();
    if (request.signal.aborted || error instanceof TypeError)
      throw new SceneRequestError(true);
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

function waitToRetry(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function loadSceneImage(
  key: string,
  signal: AbortSignal,
  retry: boolean,
) {
  const path = texturePaths.get(key);
  if (!path) throw new Error(`Unknown scene texture: ${key}`);
  const url = `${import.meta.env.BASE_URL}${path}`;
  let blob: Blob;
  for (let attempt = 0; ; attempt++) {
    try {
      blob = await requestImage(url, signal, retry || attempt > 0);
      break;
    } catch (error) {
      const delay = retryDelays[attempt];
      if (
        !(error instanceof SceneRequestError) ||
        !error.retryable ||
        delay === undefined
      )
        throw error;
      await waitToRetry(delay, signal);
    }
  }
  signal.throwIfAborted();
  const image = new Image();
  const source = URL.createObjectURL(blob);
  const abort = () => image.removeAttribute('src');
  signal.addEventListener('abort', abort, { once: true });
  try {
    image.src = source;
    await image.decode();
    signal.throwIfAborted();
    return image;
  } finally {
    signal.removeEventListener('abort', abort);
    URL.revokeObjectURL(source);
  }
}
