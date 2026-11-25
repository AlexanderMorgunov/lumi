import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createGameAudio } from './audio';
import { catVoiceClip, firstEpisodeLine } from './cat-voice';
import manifest from './cat-voice-manifest.json';
import { createPuzzle } from '../domain/puzzle';
import { levels, type LevelDefinition } from '../domain/levels';
import { nextEpisodes, reflections, type EpisodeId } from '../domain/episodes';
import { dialogueStory, dialogueVoiceLine } from '../domain/dialogue';
import restScript from '../../tests/fixtures/voice/chapter-01-rest-script.json';

class TestAudio {
  static instances: TestAudio[] = [];
  static playResult: () => Promise<void> = () => Promise.resolve();
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(() => TestAudio.playResult());
  constructor(public src: string) {
    TestAudio.instances.push(this);
  }
}
const clip = { id: 'long-lesson', file: 'audio/cat/lesson.mp3', duration: 40 };

beforeEach(() => {
  vi.useFakeTimers();
  TestAudio.instances = [];
  TestAudio.playResult = () => Promise.resolve();
  vi.stubGlobal('Audio', TestAudio);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('ships all ten current first-episode lines with intact local audio', () => {
  expect(
    manifest.clips.filter((recording) => recording.id.startsWith('ep01-')),
  ).toHaveLength(10);
  for (const [conversation, count] of [
    ['meet', 2],
    ['rule', 7],
    ['success', 1],
  ] as const) {
    for (let index = 0; index < count; index++) {
      const recording = catVoiceClip(createPuzzle(), conversation, index)!;
      expect(recording.sourceText).toBe(firstEpisodeLine(conversation, index));
      expect(recording.duration).toBeGreaterThan(0);
      const bytes = readFileSync(`public/${recording.file}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        recording.audioSha256,
      );
    }
  }
  expect(catVoiceClip(createPuzzle(), 'rule', 99)).toBeUndefined();
});

it('prepared script covers every later dialogue, continuation and answer without raw phonetic markup', () => {
  const expected = new Map<string, string>();
  for (
    let episode: EpisodeId | null = nextEpisodes.cat;
    episode;
    episode = nextEpisodes[episode]
  ) {
    for (
      let definition: LevelDefinition | undefined = levels[episode];
      definition;
      definition = definition.continuation
    ) {
      const room = { episode, definition, explanations: [] };
      for (const conversation of ['task', 'success'] as const) {
        dialogueStory(room, conversation).lines.forEach((_, index) => {
          const line = dialogueVoiceLine(room, conversation, index)!;
          expect(expected.has(line.id)).toBe(false);
          expected.set(line.id, line.text);
          expect(catVoiceClip(room, conversation, index)?.sourceText).toBe(
            line.text,
          );
        });
      }
      if (!definition.continuation && episode !== 'cat') {
        const index = dialogueStory(room, 'success').lines.length - 1;
        for (const choice of reflections[episode].choices) {
          const line = dialogueVoiceLine(
            { ...room, explanations: [choice.id] },
            'success',
            index,
          )!;
          expect(expected.has(line.id)).toBe(false);
          expected.set(line.id, line.text);
          expect(
            catVoiceClip(
              { ...room, explanations: [choice.id] },
              'success',
              index,
            )?.sourceText,
          ).toBe(line.text);
        }
      }
    }
  }
  expect(restScript.lines).toHaveLength(expected.size);
  for (const line of restScript.lines) {
    expect(line.sourceText).toBe(expected.get(line.id));
    expect(line.spokenText).not.toMatch(/[/æəʌɒˈː]/);
  }
});

it('installed voices match every line and feedback in the whole chapter', () => {
  expect(manifest.clips).toHaveLength(10 + restScript.lines.length);
  expect(new Set(manifest.clips.map((recording) => recording.id)).size).toBe(
    manifest.clips.length,
  );
  for (const line of restScript.lines) {
    const recording = manifest.clips.find(
      (candidate) => candidate.id === line.id,
    )!;
    expect(recording?.sourceText).toBe(line.sourceText);
    expect(recording?.spokenText).toBe(line.spokenText);
  }
  for (const recording of manifest.clips) {
    const bytes = readFileSync(`public/${recording.file}`);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      recording.audioSha256,
    );
  }
  const key = createPuzzle('key');
  expect(catVoiceClip(key, 'task', 0)).toBeDefined();
  expect(
    catVoiceClip({ ...key, explanations: ['any'] }, 'success', 0)?.id,
  ).toContain('-success-');
  expect(
    catVoiceClip({ ...key, explanations: ['any'] }, 'success', 1)?.id,
  ).toContain('-feedback-any');
  const edited = {
    ...key,
    definition: {
      ...key.definition,
      presentation: {
        title: 'Changed',
        noun: 'key',
        quest: '',
        introduction: ['Changed text'],
        success: [],
        rule: '',
        hint: '',
        destination: 'bag' as const,
      },
    },
  };
  expect(catVoiceClip(edited, 'task', 0)).toBeUndefined();
});

it('English interrupts the cat and mute leaves manual English available', () => {
  const audio = createGameAudio();
  const dispose = audio.mount();
  audio.playCat(clip);
  const cat = TestAudio.instances[0]!;
  audio.speak('cat');
  expect(cat.pause).toHaveBeenCalled();
  expect(audio.getSnapshot()).toMatchObject({
    catPlaying: null,
    playing: 'cat',
  });
  audio.setCatEnabled(false);
  expect(audio.getSnapshot().playing).toBe('cat');
  audio.playCat(clip);
  expect(TestAudio.instances).toHaveLength(2);
  dispose();
});

it('mute immediately stops cat playback; unmuting does not replay it', () => {
  const audio = createGameAudio();
  const dispose = audio.mount();
  audio.playCat(clip);
  audio.setCatEnabled(false);
  expect(TestAudio.instances[0]!.pause).toHaveBeenCalled();
  expect(audio.getSnapshot().catPlaying).toBeNull();
  audio.setCatEnabled(true);
  expect(TestAudio.instances).toHaveLength(1);
  audio.playCat(clip);
  expect(TestAudio.instances).toHaveLength(2);
  dispose();
});

it('obsolete play rejections and completion cannot clear a newer line', async () => {
  let rejectOld: (error: Error) => void = () => {};
  TestAudio.playResult = () =>
    new Promise((_resolve, reject) => {
      rejectOld = reject;
    });
  const audio = createGameAudio();
  const dispose = audio.mount();
  audio.playCat(clip);
  const endOld = TestAudio.instances[0]!.onended!;
  TestAudio.playResult = () => Promise.resolve();
  audio.playCat({ ...clip, id: 'next-line' });
  rejectOld(new Error('cancelled load'));
  endOld();
  await Promise.resolve();
  expect(audio.getSnapshot()).toMatchObject({
    catPlaying: 'next-line',
    catMessage: '',
  });
  dispose();
});

it('long lessons outlive the word timeout and disposal invalidates callbacks', async () => {
  const audio = createGameAudio();
  const dispose = audio.mount();
  audio.playCat(clip);
  await Promise.resolve();
  vi.advanceTimersByTime(20000);
  expect(audio.getSnapshot().catPlaying).toBe(clip.id);
  expect(TestAudio.instances).toHaveLength(1);
  const end = TestAudio.instances[0]!.onended!;
  dispose();
  end();
  vi.advanceTimersByTime(100000);
  expect(audio.getSnapshot().catPlaying).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('a stalled start retries once and then makes manual repeat available', () => {
  TestAudio.playResult = () => new Promise(() => {});
  const audio = createGameAudio();
  const dispose = audio.mount();
  audio.playCat(clip);
  vi.advanceTimersByTime(10000);
  expect(TestAudio.instances).toHaveLength(2);
  expect(audio.getSnapshot().catPlaying).toBe(clip.id);
  vi.advanceTimersByTime(10000);
  expect(TestAudio.instances).toHaveLength(2);
  expect(audio.getSnapshot()).toMatchObject({
    catPlaying: null,
    catMessage: expect.stringContaining('Не удалось загрузить запись'),
  });
  dispose();
});

it('retries a failed load once and ignores the abandoned player rejection', async () => {
  let rejectFirst: (error: DOMException) => void = () => {};
  TestAudio.playResult = () =>
    new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
  const audio = createGameAudio();
  const dispose = audio.mount();
  audio.playCat(clip);
  const first = TestAudio.instances[0]!;
  TestAudio.playResult = () => Promise.resolve();
  first.onerror!();
  rejectFirst(new DOMException('Load failed', 'NotSupportedError'));
  await Promise.resolve();
  expect(first.pause).toHaveBeenCalled();
  expect(TestAudio.instances).toHaveLength(2);
  expect(audio.getSnapshot()).toMatchObject({
    catPlaying: clip.id,
    catMessage: '',
  });
  TestAudio.instances[1]!.onerror!();
  expect(TestAudio.instances).toHaveLength(2);
  expect(audio.getSnapshot()).toMatchObject({
    catPlaying: null,
    catMessage: expect.stringContaining('Не удалось загрузить запись'),
  });
  dispose();
});

it('a browser autoplay block waits for the player to repeat the line', async () => {
  const audio = createGameAudio();
  const dispose = audio.mount();
  TestAudio.playResult = () =>
    Promise.reject(new DOMException('Autoplay denied', 'NotAllowedError'));
  audio.playCat(clip);
  await Promise.resolve();
  expect(TestAudio.instances).toHaveLength(1);
  expect(audio.getSnapshot()).toMatchObject({
    catPlaying: null,
    catMessage: expect.stringContaining('чтобы включить звук'),
  });
  expect(TestAudio.instances[0]!.pause).toHaveBeenCalled();
  TestAudio.playResult = () => Promise.resolve();
  audio.playCat(clip);
  expect(audio.getSnapshot()).toMatchObject({
    catPlaying: clip.id,
    catMessage: '',
  });
  dispose();
});
