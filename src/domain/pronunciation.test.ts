import { expect, it } from 'vitest';
import {
  pronunciationParts,
  recordedTerms,
  pronunciationRecording,
} from './pronunciation';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { firstLesson } from './first-lesson';
import { createSession } from '../game/session';
import manifest from '../../tests/fixtures/design/listening/audio-manifest.json';

it('ships the new lantern pronunciation with honest provider attribution and intact provenance', () => {
  const clip = pronunciationRecording('Lantern')!;
  expect(clip.voice).toContain('ElevenLabs v3');
  expect(pronunciationRecording('robot')?.voice).toContain('Piper');
  expect(pronunciationParts('lantern — фонарь')[0]?.term).toBe('lantern');
  const receipt: unknown = JSON.parse(
    readFileSync('tests/fixtures/voice/lantern-pronunciation.json', 'utf8'),
  );
  expect(receipt).toMatchObject({
    file: clip.file,
    term: 'lantern',
    provider: 'elevenlabs',
    modelId: 'eleven_v3',
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    audioSha256: createHash('sha256')
      .update(readFileSync('public/' + clip.file))
      .digest('hex'),
  });
});

it('provides checked local recordings for you and are without changing Piper words', () => {
  for (const term of ['You', 'are']) {
    const clip = pronunciationRecording(term)!;
    expect(clip.file).toBe(
      `audio/en-US/elevenlabs-marta-v1/${term.toLowerCase()}.mp3`,
    );
    const receipt: unknown = JSON.parse(
      readFileSync(
        `tests/fixtures/voice/${term.toLowerCase()}-pronunciation.json`,
        'utf8',
      ),
    );
    expect(receipt).toMatchObject({
      term: term.toLowerCase(),
      provider: 'elevenlabs',
      modelId: 'eleven_v3',
      voiceId: 'XrExE9yKIg1WjnnlVkGX',
      audioSha256: createHash('sha256')
        .update(readFileSync('public/' + clip.file))
        .digest('hex'),
    });
  }
});

it('ships he, she, it and is with the actual speaker and checked provenance', () => {
  for (const [term, speaker, voiceId] of [
    ['He', 'marta', 'XrExE9yKIg1WjnnlVkGX'],
    ['She', 'tik', 'bIHbv24MWmeRgasZH58o'],
    ['is', 'tik', 'bIHbv24MWmeRgasZH58o'],
    ['It', 'tik', 'bIHbv24MWmeRgasZH58o'],
  ]) {
    const clip = pronunciationRecording(term!)!;
    expect(clip.file).toBe(
      `audio/en-US/elevenlabs-${speaker}-v1/${term!.toLowerCase()}.mp3`,
    );
    const receipt: unknown = JSON.parse(
      readFileSync(
        `tests/fixtures/voice/${term!.toLowerCase()}-pronunciation.json`,
        'utf8',
      ),
    );
    expect(receipt).toMatchObject({
      term: term!.toLowerCase(),
      provider: 'elevenlabs',
      modelId: 'eleven_v3',
      voiceId,
      audioSha256: createHash('sha256')
        .update(readFileSync('public/' + clip.file))
        .digest('hex'),
    });
  }
});

it('keeps mixed Russian/English text intact and does not pronounce IPA as letters', () => {
  const text =
    'a/an/the: key /kiː/, apple /ˈæp.əl/, cat /k/, I am Lumi. cats — коты; water — вода.';
  const parts = pronunciationParts(text);
  expect(parts.map((p) => p.text).join('')).toBe(text);
  expect(parts.flatMap((p) => (p.term ? [p.term] : []))).toEqual([
    'a',
    'an',
    'the',
    'key',
    'apple',
    'cat',
    'i',
    'am',
    'lumi',
    'cats',
    'water',
  ]);
  expect(pronunciationParts('слово unknown /bʊk/')).toEqual([
    { text: 'слово ', term: null },
    { text: 'unknown', term: null },
    { text: ' ', term: null },
    { text: '/bʊk/', term: null },
  ]);
});
it('keeps the original Piper catalogue intact, including lesson boundary examples', () => {
  expect(manifest.assets.map((asset) => asset.word)).toEqual([
    ...recordedTerms,
  ]);
  const terms = firstLesson.flatMap((line) =>
    pronunciationParts(line.text).flatMap((p) => (p.term ? [p.term] : [])),
  );
  expect(terms).toContain('cats');
  expect(terms).toContain('water');
  expect(new Set(manifest.assets.map((asset) => asset.sha256)).size).toBe(
    recordedTerms.length,
  );
});
it('listening blocks all puzzle actions and survives an independent host pause/resume', () => {
  const s = createSession();
  const before = s.getSnapshot().room;
  s.setPaused('listening', true);
  for (const action of [
    { type: 'move', direction: 'up' },
    { type: 'undo' },
    { type: 'apply' },
    { type: 'reset' },
  ] as const)
    s.dispatch(action);
  expect(s.getSnapshot().room).toBe(before);
  s.setPaused('platform', true);
  s.setPaused('platform', false);
  expect(s.getSnapshot().paused).toBe(true);
  s.setPaused('listening', false);
  s.dispatch({ type: 'move', direction: 'up' });
  expect(s.getSnapshot().room.moves).toBe(1);
});
