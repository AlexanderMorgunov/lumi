import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinSpeech, quietEdges, joinPolicy } from './lib/speech-joins.mjs';
const samples = (ms) => ms * 24;
function take(head, duration, tail, amplitude = 3000) {
  const pcm = Buffer.alloc(samples(head + duration + tail) * 2);
  for (let i = samples(head); i < samples(head + duration); i++)
    pcm.writeInt16LE(amplitude, i * 2);
  return pcm;
}
test('short English I and a keep every active sample, plus onset and tail guards', () => {
  for (const rawText of ['I', 'a']) {
    const parts = [
      { rawText: 'Слово ', pcm: take(20, 300, 900) },
      { rawText, pcm: take(650, 90, 800) },
      { rawText: ' означает', pcm: take(700, 400, 30) },
    ];
    const result = joinSpeech(parts);
    parts.forEach((part, i) => {
      const edge = quietEdges(part.pcm),
        range = result.ranges[i];
      assert.ok(range.start <= edge.leading);
      assert.ok(range.end >= edge.count - edge.trailing);
      for (let n = 0; n < range.start; n++)
        assert.ok(
          Math.abs(part.pcm.readInt16LE(n * 2)) <= joinPolicy.peakLimit,
        );
      for (let n = range.end; n < edge.count; n++)
        assert.ok(
          Math.abs(part.pcm.readInt16LE(n * 2)) <= joinPolicy.peakLimit,
        );
    });
    assert.equal(result.ranges[0].start, 0);
    assert.equal(result.ranges.at(-1).end, parts.at(-1).pcm.length / 2);
    assert.equal(result.ranges[1].start, samples(650 - 80));
    assert.equal(result.ranges[1].end, samples(650 + 90 + 100));
    assert.ok(result.joins.every((join) => join.afterMs === 180));
  }
});
test('does not remove quiet consonant onsets, breaths, internal pauses or uncertain silent takes', () => {
  const speech = take(400, 600, 400);
  speech.writeInt16LE(34, samples(250) * 2); // quiet onset above the conservative threshold
  speech.fill(0, samples(550) * 2, samples(700) * 2); // within the spoken fragment
  const result = joinSpeech([
    { rawText: 'Это', pcm: take(20, 200, 500) },
    { rawText: 'Who', pcm: speech },
    { rawText: 'дальше', pcm: take(300, 200, 20) },
  ]);
  assert.equal(result.ranges[1].start, samples(170));
  const retained = speech.subarray(
    result.ranges[1].start * 2,
    result.ranges[1].end * 2,
  );
  assert.ok(result.pcm.includes(retained));
  const quiet = Buffer.alloc(samples(1000) * 2);
  const uncertain = joinSpeech([
    { rawText: 'one', pcm: quiet },
    { rawText: 'два', pcm: speech },
  ]);
  assert.deepEqual(uncertain.ranges, [
    { start: 0, end: quiet.length / 2 },
    { start: 0, end: speech.length / 2 },
  ]);
});
test('punctuation comes from source text, not the extra full stop sent to TTS', () => {
  const pcm = take(500, 100, 500);
  assert.equal(
    joinSpeech([
      { rawText: 'I', text: 'I.', pcm },
      { rawText: ' значит', pcm },
    ]).joins[0].afterMs,
    180,
  );
  assert.equal(
    joinSpeech([
      { rawText: 'Are you ready?', pcm },
      { rawText: ' Ответ', pcm },
    ]).joins[0].afterMs,
    300,
  );
  assert.equal(
    joinSpeech([
      { rawText: 'I', pcm },
      { rawText: ' — я', pcm },
    ]).joins[0].afterMs,
    220,
  );
});
test('leaves short pauses and single language recordings byte-identical', () => {
  const a = take(20, 200, 20),
    b = take(10, 200, 20);
  assert.deepEqual(joinSpeech([{ rawText: 'Русская реплика', pcm: a }]).pcm, a);
  assert.deepEqual(
    joinSpeech([
      { rawText: 'Слово', pcm: a },
      { rawText: 'I', pcm: b },
    ]).pcm,
    Buffer.concat([a, Buffer.alloc(samples(60) * 2), b]),
  );
  assert.throws(() => quietEdges(Buffer.alloc(3)), /PCM/);
  assert.throws(() => joinSpeech([]), /No speech/);
});
