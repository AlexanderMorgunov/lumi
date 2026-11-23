import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import film from './prologue-film.json';
import source from '../../tests/fixtures/voice/prologue-george-manifest.json';

describe('shipped prologue', () => {
  it('has playable assets and complete, ordered captions without performance tags', () => {
    expect(statSync(`public/${film.video}`).size).toBeGreaterThan(100_000);
    const vtt = readFileSync(`public/${film.captions}`, 'utf8');
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(film.cues.map((c) => c.text).join(' ')).toBe(
      source.clips.map((c) => c.sourceText).join(' '),
    );
    expect(film.story).toEqual(source.clips.map((c) => c.sourceText));
    let end = 0;
    for (const cue of film.cues) {
      expect(cue.start).toBeGreaterThanOrEqual(end);
      expect(cue.end).toBeGreaterThan(cue.start);
      expect(cue.end).toBeLessThan(film.duration);
      expect(cue.text).not.toContain('[');
      expect(cue.text).not.toContain(']');
      expect(vtt).toContain(cue.text);
      end = cue.end;
    }
  });
});
