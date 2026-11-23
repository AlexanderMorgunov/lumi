import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import cues from './cat-mouth-cues.json';
import voice from './cat-voice-manifest.json';
import { catMouthAt } from './cat-mouth';

it('has amplitude cues for every exact shipped recording, not stale audio', () => {
  expect(cues.clips.length).toBe(voice.clips.length);
  for (const clip of voice.clips) {
    const cue = cues.clips.find((c) => c.id === clip.id)!;
    expect(cue.file).toBe(clip.file);
    expect(cue.audioSha256).toBe(clip.audioSha256);
    expect(
      createHash('sha256')
        .update(readFileSync('public/' + clip.file))
        .digest('hex'),
    ).toBe(cue.audioSha256);
    expect(cue.frames).toMatch(/^[01]+$/);
    expect(
      Math.abs(cue.frames.length * cues.step - clip.duration),
    ).toBeLessThan(0.15);
  }
});

it('closes at silence and follows recording time, with a safe missing-cue fallback', () => {
  const cue = cues.clips[0]!;
  expect(
    catMouthAt(cue.file, (cue.frames.indexOf('1') + 0.5) * cues.step),
  ).toBe('open');
  expect(
    catMouthAt(cue.file, (cue.frames.indexOf('0') + 0.5) * cues.step),
  ).toBe('closed');
  for (const time of [-1, NaN, Infinity, 999])
    expect(catMouthAt(cue.file, time)).toBe('rest');
  expect(catMouthAt('missing.mp3', 1)).toBe('rest');
});
