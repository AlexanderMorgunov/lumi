import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = (data) => createHash('sha256').update(data).digest('hex');
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());

export function prepareJob(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Request must be a JSON object.');
  const options = {
    design: {
      models: ['eleven_ttv_v3', 'eleven_multilingual_ttv_v2'],
      fields: ['voiceDescription', 'seed'],
      min: 100,
      max: 1000,
      endpoint: '/v1/text-to-voice/design',
    },
    speech: {
      models: ['eleven_v4', 'eleven_v3', 'eleven_multilingual_v2'],
      fields: [
        'voiceId',
        'seed',
        'withTimestamps',
        'languageCode',
        'textNormalization',
      ],
      min: 1,
      max: 5000,
    },
    sfx: {
      models: ['eleven_text_to_sound_v2', 'eleven_text_to_sound_v3'],
      fields: ['durationSeconds'],
      min: 1,
      max: 450,
      endpoint: '/v1/sound-generation',
    },
  };
  const config = Object.hasOwn(options, input.kind) && options[input.kind];
  if (!config) throw new Error('kind must be design, speech or sfx.');
  const allowed = ['kind', 'id', 'modelId', 'text', ...config.fields];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new Error('Unknown request field.');
  if (
    typeof input.id !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.id)
  )
    throw new Error(
      'Use a lowercase alphanumeric/hyphen take id, up to 80 characters.',
    );
  if (!config.models.includes(input.modelId))
    throw new Error(
      'Unsupported model for this job kind; review provider docs before extending the helper.',
    );
  if (
    typeof input.text !== 'string' ||
    !input.text.trim() ||
    input.text.length < config.min ||
    input.text.length > config.max
  )
    throw new Error(
      `Text length must be ${config.min}–${config.max} characters.`,
    );
  const body = { text: input.text, model_id: input.modelId };
  let endpoint = config.endpoint;
  if (input.seed !== undefined) {
    if (
      !Number.isInteger(input.seed) ||
      input.seed < 0 ||
      input.seed > 2147483647
    )
      throw new Error('seed must be an integer from 0 to 2147483647.');
    body.seed = input.seed;
  }
  if (input.kind === 'design') {
    if (
      typeof input.voiceDescription !== 'string' ||
      input.voiceDescription.trim().length < 20 ||
      input.voiceDescription.length > 1000
    )
      throw new Error('voiceDescription must contain 20–1000 characters.');
    body.voice_description = input.voiceDescription;
    body.auto_generate_text = false;
  }
  if (input.kind === 'speech') {
    if (input.textNormalization !== undefined) {
      if (!['auto', 'on', 'off'].includes(input.textNormalization))
        throw new Error('textNormalization must be auto, on or off.');
      body.apply_text_normalization = input.textNormalization;
    }
    if (input.languageCode !== undefined) {
      if (
        !['en', 'ru'].includes(input.languageCode) ||
        input.modelId === 'eleven_multilingual_v2'
      )
        throw new Error(
          'languageCode requires en/ru and a supporting speech model.',
        );
      body.language_code = input.languageCode;
    }
    if (
      typeof input.voiceId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(input.voiceId) ||
      input.voiceId.startsWith('SELECTED_')
    )
      throw new Error('Supply an actual selected account voiceId.');
    endpoint = `/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`;
    if (
      input.withTimestamps !== undefined &&
      typeof input.withTimestamps !== 'boolean'
    )
      throw new Error('withTimestamps must be boolean.');
    if (input.withTimestamps) endpoint += '/with-timestamps';
  }
  if (input.kind === 'sfx') {
    if (
      !Number.isFinite(input.durationSeconds) ||
      input.durationSeconds < 0.5 ||
      input.durationSeconds > 30
    )
      throw new Error('durationSeconds must be between 0.5 and 30.');
    body.duration_seconds = input.durationSeconds;
    body.loop = false;
  }
  const request = JSON.parse(canonical(input));
  const requestHash = digest(canonical(input));
  return {
    request,
    requestHash,
    textHash: digest(input.text),
    body,
    url: `https://api.elevenlabs.io${endpoint}?output_format=mp3_44100_128`,
  };
}

function mp3(buffer) {
  return (
    buffer.length > 4 &&
    (buffer.subarray(0, 3).toString() === 'ID3' ||
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
  );
}

function validAlignment(value) {
  return (
    value &&
    Array.isArray(value.characters) &&
    value.characters.length > 0 &&
    value.characters.every((char) => typeof char === 'string') &&
    Array.isArray(value.character_start_times_seconds) &&
    Array.isArray(value.character_end_times_seconds) &&
    value.characters.length === value.character_start_times_seconds.length &&
    value.characters.length === value.character_end_times_seconds.length &&
    value.character_start_times_seconds.every(
      (time, i, all) =>
        Number.isFinite(time) &&
        time >= 0 &&
        (i === 0 || time >= all[i - 1]) &&
        Number.isFinite(value.character_end_times_seconds[i]) &&
        value.character_end_times_seconds[i] >= time,
    )
  );
}

export async function generate(job, output, apiKey, fetcher = fetch) {
  const directory = path.resolve(
    output,
    `${job.request.id}-${job.requestHash.slice(0, 16)}`,
  );
  const receiptPath = path.join(directory, 'receipt.json');
  let existing;
  try {
    existing = JSON.parse(await readFile(receiptPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw new Error('Cannot read existing receipt; no request sent.', {
        cause: error,
      });
  }
  if (existing) {
    if (
      existing.status !== 'complete' ||
      existing.requestHash !== job.requestHash
    )
      throw new Error(
        'Previous request is unresolved. Inspect its receipt/provider history; no automatic retry.',
      );
    if (!Array.isArray(existing.files) || !existing.files.length)
      throw new Error('Invalid cached receipt; no request sent.');
    for (const file of existing.files) {
      if (!/^(?:preview-\d+|speech|sfx)\.mp3$/.test(file.name))
        throw new Error('Invalid cached filename.');
      const buffer = await readFile(path.join(directory, file.name));
      if (digest(buffer) !== file.sha256 || !mp3(buffer))
        throw new Error('Cached audio is missing or changed; no request sent.');
    }
    if (job.request.withTimestamps) {
      if (existing.alignment?.name !== 'alignment.json')
        throw new Error('Missing cached alignment; no request sent.');
      const bytes = await readFile(path.join(directory, 'alignment.json'));
      if (
        digest(bytes) !== existing.alignment.sha256 ||
        !validAlignment(JSON.parse(bytes))
      )
        throw new Error('Cached alignment is changed; no request sent.');
    }
    return { directory, cached: true, files: existing.files.length };
  }
  if (!apiKey)
    throw new Error('ELEVENLABS_API_KEY is missing; no request sent.');
  await mkdir(path.resolve(output), { recursive: true });
  // Reserving the job directory prevents concurrent duplicate billed requests.
  try {
    await mkdir(directory);
  } catch {
    throw new Error(
      'Job directory already exists or is unavailable; inspect it before retrying.',
    );
  }
  const receipt = {
    provider: 'elevenlabs',
    status: 'pending',
    request: job.request,
    requestHash: job.requestHash,
    textHash: job.textHash,
    startedAt: new Date().toISOString(),
    outputFormat: 'mp3_44100_128',
    auditoryReview: 'not-reviewed',
    files: [],
  };
  const save = () =>
    writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  await save();
  try {
    const response = await fetcher(job.url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(120000),
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(job.body),
    });
    receipt.httpStatus = response.status;
    const reportedCost = response.headers.get('character-cost');
    if (
      reportedCost !== null &&
      reportedCost.trim() !== '' &&
      Number.isFinite(Number(reportedCost)) &&
      Number(reportedCost) >= 0
    )
      receipt.characterCost = Number(reportedCost);
    const requestId = response.headers.get('request-id');
    if (requestId) receipt.providerRequestId = requestId;
    if (!response.ok)
      throw new Error(`Provider returned HTTP ${response.status}.`);
    if (Number(response.headers.get('content-length')) > 32 * 1024 * 1024)
      throw new Error('Response exceeds the small-job limit.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 32 * 1024 * 1024) throw new Error('Response too large.');
    let clips;
    if (job.request.kind === 'design') {
      const data = JSON.parse(bytes.toString('utf8'));
      if (
        !Array.isArray(data.previews) ||
        !data.previews.length ||
        data.previews.length > 8
      )
        throw new Error('Invalid voice preview response.');
      clips = data.previews.map((preview, i) => {
        if (
          typeof preview.audio_base_64 !== 'string' ||
          !/^[A-Za-z0-9+/=\r\n]+$/.test(preview.audio_base_64) ||
          typeof preview.generated_voice_id !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,120}$/.test(preview.generated_voice_id)
        )
          throw new Error('Invalid preview audio or generated voice ID.');
        return {
          name: `preview-${i + 1}.mp3`,
          buffer: Buffer.from(preview.audio_base_64, 'base64'),
          generatedVoiceId: preview.generated_voice_id,
        };
      });
    } else if (job.request.withTimestamps) {
      const data = JSON.parse(bytes.toString('utf8'));
      if (
        typeof data.audio_base64 !== 'string' ||
        !/^[A-Za-z0-9+/=\r\n]+$/.test(data.audio_base64)
      )
        throw new Error('Invalid timestamped audio');
      const alignment = validAlignment(data.alignment)
        ? data.alignment
        : data.normalized_alignment;
      if (!validAlignment(alignment))
        throw new Error('Missing or invalid speech alignment');
      const content = JSON.stringify(alignment, null, 2) + '\n';
      await writeFile(path.join(directory, 'alignment.json'), content, {
        flag: 'wx',
      });
      receipt.alignment = { name: 'alignment.json', sha256: digest(content) };
      clips = [
        {
          name: 'speech.mp3',
          buffer: Buffer.from(data.audio_base64, 'base64'),
        },
      ];
    } else clips = [{ name: `${job.request.kind}.mp3`, buffer: bytes }];
    if (clips.some((clip) => !mp3(clip.buffer)))
      throw new Error('Response is not recognizable MP3 audio.');
    for (const clip of clips) {
      await writeFile(path.join(directory, clip.name), clip.buffer, {
        flag: 'wx',
      });
      receipt.files.push({
        name: clip.name,
        sha256: digest(clip.buffer),
        ...(clip.generatedVoiceId
          ? { generatedVoiceId: clip.generatedVoiceId }
          : {}),
      });
    }
    receipt.status = 'complete';
    await save();
    return { directory, cached: false, files: receipt.files.length };
  } catch {
    receipt.status = 'failed-or-unknown';
    await save();
    throw new Error(
      `Generation did not complete${receipt.httpStatus ? ` (HTTP ${receipt.httpStatus})` : ''}. Inspect receipt/provider history before any new request; no retry performed.`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (
      !['--request', '--out', '--execute'].includes(key) ||
      Object.hasOwn(flags, key)
    )
      throw new Error(
        'Usage: --request job.json --out artifacts/voice [--execute]',
      );
    flags[key] = key === '--execute' ? true : args[++i];
  }
  if (
    typeof flags['--request'] !== 'string' ||
    typeof flags['--out'] !== 'string'
  )
    throw new Error('Both --request and --out are required.');
  const source = await readFile(flags['--request'], 'utf8');
  let input;
  try {
    input = JSON.parse(source);
  } catch {
    throw new Error('Invalid request JSON.');
  }
  const job = prepareJob(input);
  if (!flags['--execute']) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          network: false,
          kind: job.request.kind,
          model: job.request.modelId,
          characters: job.request.text.length,
          requestHash: job.requestHash,
          directory: path.resolve(
            flags['--out'],
            `${job.request.id}-${job.requestHash.slice(0, 16)}`,
          ),
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(
    JSON.stringify(
      await generate(job, flags['--out'], process.env.ELEVENLABS_API_KEY),
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
