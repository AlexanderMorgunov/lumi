import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareJob, generate } from './elevenlabs.mjs';

const input = {
  kind: 'speech',
  id: 'cat-test',
  modelId: 'eleven_v4',
  voiceId: 'testvoice123',
  text: 'Привет, Люми. A key.',
  seed: 42,
};
// Container stub for transport/cache tests, not playable or reviewed audio.
const stub = Buffer.from('ID3mock-audio-data');
test('normalization is explicit, validated and included in the cached request', () => {
  const job = prepareJob({
    ...input,
    modelId: 'eleven_v3',
    textNormalization: 'off',
  });
  assert.equal(job.body.apply_text_normalization, 'off');
  assert.equal(job.body.language_code, undefined);
  assert.notEqual(
    job.requestHash,
    prepareJob({ ...input, modelId: 'eleven_v3' }).requestHash,
  );
  assert.throws(() => prepareJob({ ...input, textNormalization: false }));
});
async function workspace(t) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'dayenglish-voice-test-'),
  );
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('dayenglish-voice-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('validates paid-job inputs before use and fingerprints exact text/settings independently of key order', () => {
  const job = prepareJob(input);
  assert.equal(
    job.requestHash,
    prepareJob(Object.fromEntries(Object.entries(input).reverse())).requestHash,
  );
  assert.notEqual(
    job.requestHash,
    prepareJob({ ...input, text: input.text + '!' }).requestHash,
  );
  assert.notEqual(
    job.requestHash,
    prepareJob({ ...input, seed: 43 }).requestHash,
  );
  for (const bad of [
    null,
    [],
    { ...input, id: '../outside' },
    { ...input, apiKey: 'never-log-this' },
    { ...input, modelId: 'eleven_ttv_v3' },
    { ...input, text: '' },
    { ...input, seed: -1 },
  ])
    assert.throws(() => prepareJob(bad));
  assert.equal(
    job.url,
    'https://api.elevenlabs.io/v1/text-to-speech/testvoice123?output_format=mp3_44100_128',
  );
  assert.equal(job.body.language_code, undefined);
});

test('caches exact jobs without another API call and detects modified audio', async (t) => {
  const out = await workspace(t);
  const job = prepareJob(input);
  let calls = 0;
  const fake = async (_url, options) => {
    calls++;
    assert.equal(options.headers['xi-api-key'], 'test-key');
    assert.equal(JSON.parse(options.body).text, input.text);
    return new Response(stub, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'character-cost': '7.5',
        'request-id': 'test-request-123',
      },
    });
  };
  const result = await generate(job, out, 'test-key', fake);
  assert.equal(result.cached, false);
  assert.equal((await generate(job, out, undefined, fake)).cached, true);
  assert.equal(calls, 1);
  const receipt = await readFile(
    path.join(result.directory, 'receipt.json'),
    'utf8',
  );
  assert.ok(!receipt.includes('test-key'));
  assert.equal(JSON.parse(receipt).auditoryReview, 'not-reviewed');
  assert.equal(JSON.parse(receipt).characterCost, 7.5);
  assert.equal(JSON.parse(receipt).providerRequestId, 'test-request-123');
  await writeFile(path.join(result.directory, 'speech.mp3'), 'corrupt');
  await assert.rejects(generate(job, out, 'test-key', fake));
  assert.equal(calls, 1);
});

test('explicit segment language reaches the API and changes the cache key; unsupported requests fail before billing', () => {
  const english = prepareJob({
    ...input,
    modelId: 'eleven_v3',
    text: 'I.',
    languageCode: 'en',
  });
  assert.equal(english.body.language_code, 'en');
  assert.notEqual(
    english.requestHash,
    prepareJob({ ...english.request, languageCode: 'ru' }).requestHash,
  );
  assert.notEqual(
    english.requestHash,
    prepareJob({ ...input, modelId: 'eleven_v3', text: 'I.' }).requestHash,
  );
  assert.throws(() => prepareJob({ ...input, languageCode: 'auto' }));
  assert.throws(() =>
    prepareJob({
      ...input,
      modelId: 'eleven_multilingual_v2',
      languageCode: 'en',
    }),
  );
});

test('timestamped speech stores validated alignment and never regenerates a broken cache', async (t) => {
  const out = await workspace(t);
  const job = prepareJob({ ...input, withTimestamps: true });
  assert.ok(job.url.includes('/with-timestamps?'));
  assert.notEqual(job.requestHash, prepareJob(input).requestHash);
  assert.throws(() => prepareJob({ ...input, withTimestamps: 'yes' }));
  let calls = 0;
  const fake = async () => {
    calls++;
    return Response.json({
      audio_base64: stub.toString('base64'),
      alignment: {
        characters: ['H', 'i'],
        character_start_times_seconds: [0, 0.1],
        character_end_times_seconds: [0.1, 0.2],
      },
    });
  };
  const result = await generate(job, out, 'test-key', fake);
  assert.equal((await generate(job, out, undefined, fake)).cached, true);
  await writeFile(path.join(result.directory, 'alignment.json'), '{}');
  await assert.rejects(generate(job, out, 'test-key', fake), /alignment/);
  assert.equal(calls, 1);
});

test('invalid alignment stops timestamped generation without retry', async (t) => {
  const out = await workspace(t);
  const job = prepareJob({ ...input, withTimestamps: true });
  let calls = 0;
  const fake = async () => {
    calls++;
    return Response.json({
      audio_base64: stub.toString('base64'),
      alignment: {
        characters: ['H'],
        character_start_times_seconds: [1],
        character_end_times_seconds: [0],
      },
    });
  };
  await assert.rejects(generate(job, out, 'test-key', fake), /no retry/);
  await assert.rejects(generate(job, out, 'test-key', fake), /unresolved/);
  assert.equal(calls, 1);
});

test('missing key and uncertain requests do not cause automatic paid retries', async (t) => {
  const out = await workspace(t);
  const job = prepareJob(input);
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error('sensitive-provider-body');
  };
  await assert.rejects(generate(job, out, undefined, fail), /KEY is missing/);
  assert.equal(calls, 0);
  await assert.rejects(
    generate(job, out, 'test-key', fail),
    /no retry performed/,
  );
  await assert.rejects(generate(job, out, 'test-key', fail), /unresolved/);
  assert.equal(calls, 1);
});

test('decodes design previews without saving a persistent provider voice', async (t) => {
  const out = await workspace(t);
  const job = prepareJob({
    kind: 'design',
    id: 'preview-test',
    modelId: 'eleven_ttv_v3',
    voiceDescription: 'A warm native Russian male voice.',
    text: 'Пробная реплика кота. '.repeat(8),
  });
  let calls = 0;
  const result = await generate(job, out, 'test-key', async (url) => {
    calls++;
    assert.ok(url.includes('/text-to-voice/design?'));
    return Response.json({
      previews: [
        {
          audio_base_64: stub.toString('base64'),
          generated_voice_id: 'preview123',
        },
      ],
    });
  });
  assert.equal(result.files, 1);
  assert.equal(calls, 1);
  const receipt = JSON.parse(
    await readFile(path.join(result.directory, 'receipt.json'), 'utf8'),
  );
  assert.equal(receipt.files[0].generatedVoiceId, 'preview123');
});

test('rejects successful HTTP responses containing non-audio data without retry', async (t) => {
  const out = await workspace(t);
  let calls = 0;
  const fake = async () => {
    calls++;
    return new Response('<html>not an mp3</html>');
  };
  const job = prepareJob(input);
  await assert.rejects(
    generate(job, out, 'test-key', fake),
    /no retry performed/,
  );
  await assert.rejects(generate(job, out, 'test-key', fake), /unresolved/);
  assert.equal(calls, 1);
});

test('SFX requests have explicit duration, independent model and no speech voice', () => {
  const job = prepareJob({
    kind: 'sfx',
    id: 'cat-chirp',
    modelId: 'eleven_text_to_sound_v3',
    text: 'One quiet friendly cat chirrup.',
    durationSeconds: 1.5,
  });
  assert.equal(job.body.duration_seconds, 1.5);
  assert.equal(job.body.loop, false);
  assert.throws(() => prepareJob({ ...job.request, voiceId: 'testvoice123' }));
  assert.throws(() => prepareJob({ ...job.request, durationSeconds: 0.1 }));
});
