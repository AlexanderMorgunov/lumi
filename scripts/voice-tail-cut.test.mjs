import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTailCut } from './voice-tail-cut.mjs';
const text = 'The English pronoun is... I.';
function fixture() {
  const pcm = Buffer.alloc(24000 * 2 * 3);
  for (let i = 2.4 * 24000; i < 2.9 * 24000; i++) pcm.writeInt16LE(8000, i * 2);
  const starts = [...text].map(() => 0),
    ends = [...text].map(() => 1.6);
  starts[text.lastIndexOf('I')] = 2.6;
  ends[text.lastIndexOf('I')] = 2.8;
  return {
    cut: {
      requestHash: 'request',
      audioSha256: 'audio',
      alignmentSha256: 'alignment',
      start: 2.2,
    },
    requestHash: 'request',
    audioSha256: 'audio',
    alignmentSha256: 'alignment',
    text,
    alignment: {
      characters: [...text],
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    },
    pcm,
  };
}
test('keeps silence before onset and all sound through the end, beyond character timing', () => {
  const result = validateTailCut(fixture());
  assert.equal(result.start, 2.2);
  assert.equal(result.end, 3);
  assert.equal(result.method, 'quiet-gap-to-end-no-silence-trimming');
});
test('refuses changed source audio or alignment', () => {
  for (const key of ['requestHash', 'audioSha256', 'alignmentSha256']) {
    const value = fixture();
    value[key] = 'changed';
    assert.throws(() => validateTailCut(value), /does not match/);
  }
});
test('refuses a cut in the audible onset even before the character start', () => {
  const value = fixture();
  value.cut.start = 2.45;
  assert.throws(() => validateTailCut(value), /not quiet/);
});
test('refuses a cut before the carrier ends or after the target begins', () => {
  for (const start of [0, 1.5, 2.7, NaN]) {
    const value = fixture();
    value.cut.start = start;
    assert.throws(() => validateTailCut(value), /Unsafe/);
  }
});
test('refuses a different carrier instead of leaking it into the game', () => {
  const value = fixture();
  value.text = 'I am Lumi.';
  assert.throws(() => validateTailCut(value), /Unexpected/);
});
