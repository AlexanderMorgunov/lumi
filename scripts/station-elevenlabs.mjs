// Offline production. Explicit phases; paid calls are cached and never retried.
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';

const command = process.argv[2];
if (
  !['prepare', 'generate', 'install'].includes(command) ||
  process.argv.length !== 3
)
  throw new Error(
    'Usage: node scripts/station-elevenlabs.mjs prepare|generate|install',
  );
const root = 'artifacts/voice/station-elevenlabs-v1';
const json = async (file) =>
  JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const save = (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = async (file) => {
  try {
    await readFile(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
const cast = await json('docs/voice/station-elevenlabs-cast.json');
if (
  ['generate', 'install'].includes(command) &&
  (await exists('docs/voice/chapter-02-bilingual-plan.json'))
)
  throw new Error(
    'Chapter-wide continuous takes supersede this archived batch. Use chapter-bilingual-voice.mjs and install chapter.',
  );
if (cast.status !== 'owner-selected' || cast.modelId !== 'eleven_v3')
  throw new Error('Unreviewed cast');
const lines = [];
for (const episode of ['01', '02', '03', '04', '05']) {
  const source = await json(`docs/voice/station-${episode}-script.json`);
  lines.push(...source.lines);
}
if (lines.length !== 74 || new Set(lines.map((l) => l.id)).size !== 74)
  throw new Error('Unexpected batch scope');
const words = [
  ['lantern', 'marta'],
  ['you', 'marta'],
  ['are', 'marta'],
  ['he', 'marta'],
  ['she', 'tik'],
  ['is', 'tik'],
  ['it', 'tik'],
].map(([term, speaker]) => ({
  id: `word-${term}`,
  term,
  speaker,
  sourceText: term + '.',
}));
const entries = [...lines, ...words].map((line) => {
  if (!cast.voices[line.speaker] || typeof line.sourceText !== 'string')
    throw new Error('Invalid source');
  const voiceId = cast.voices[line.speaker].voiceId;
  const job = prepareJob({
    kind: 'speech',
    id: `${line.id}-elv3-v1`,
    modelId: cast.modelId,
    voiceId,
    seed: cast.seed,
    text: line.sourceText,
  });
  return {
    id: line.id,
    speaker: line.speaker,
    ...(line.term ? { term: line.term } : {}),
    sourceText: line.sourceText,
    spokenText: line.sourceText,
    voiceId,
    request: job.request,
    requestHash: job.requestHash,
  };
});
const characters = entries.reduce((n, l) => n + l.spokenText.length, 0);
// Reviewed per-line repairs must survive a later full install or cached generation.
const patchFile = 'docs/voice/station-elevenlabs-patches.json';
const patches = (await exists(patchFile))
  ? (await json(patchFile)).patches
  : [];
const patchMap = new Map();
for (const patch of patches) {
  const clip = patch.clip;
  const entry = entries.find((e) => e.id === clip.id);
  const file = path.resolve('public', clip.file);
  if (
    !entry ||
    entry.sourceText !== clip.sourceText ||
    entry.voiceId !== clip.voiceId ||
    entry.speaker !== clip.speaker ||
    patchMap.has(clip.id) ||
    !file.startsWith(path.resolve('public') + path.sep) ||
    hash(await readFile(file)) !== clip.audioSha256 ||
    hash(JSON.stringify(patch.assembly)) !== clip.requestHash
  )
    throw new Error('Stale or invalid repair: ' + clip.id);
  patchMap.set(clip.id, clip);
}
if (characters > 10000) throw new Error('Batch exceeds reviewed budget');
const plan = {
  provider: cast.provider,
  modelId: cast.modelId,
  characters,
  dialogueLines: lines.length,
  wordRecordings: words.length,
  entries,
};
await mkdir(root, { recursive: true });
await save('docs/voice/station-elevenlabs-plan.json', plan);
console.log(
  JSON.stringify({
    command,
    dialogue: lines.length,
    words: words.length,
    characters,
  }),
);
if (command === 'prepare') process.exit(0);
const options = {
  windowsHide: true,
  maxBuffer: 16 * 1024 * 1024,
  timeout: 120000,
};
const probe = (file) => {
  const data = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration,size:stream=codec_name,sample_rate,channels',
        '-of',
        'json',
        file,
      ],
      { ...options, encoding: 'utf8' },
    ),
  );
  const duration = Number(data.format?.duration);
  if (
    !Number.isFinite(duration) ||
    duration < 0.08 ||
    duration > 120 ||
    data.streams?.[0]?.codec_name !== 'mp3'
  )
    throw new Error('Invalid recording: ' + file);
  return { duration, bytes: Number(data.format.size), streams: data.streams };
};
const rawPath = (entry) =>
  path.join(
    root,
    'raw',
    `${entry.request.id}-${entry.requestHash.slice(0, 16)}`,
  );
if (command === 'generate') {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('Missing ELEVENLABS_API_KEY');
  const get = async (endpoint) => {
    const response = await fetch('https://api.elevenlabs.io' + endpoint, {
      headers: { 'xi-api-key': key },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        `Preflight ${endpoint}: HTTP ${response.status}; no synthesis sent.`,
      );
    return response.json();
  };
  const subscription = await get('/v1/user/subscription');
  const models = await get('/v1/models');
  const model = models.find(
    (m) => m.model_id === cast.modelId && m.can_do_text_to_speech,
  );
  const factor = model?.model_rates?.character_cost_multiplier;
  const discount = model?.model_rates?.cost_discount_multiplier;
  if (!(factor > 0 && discount > 0))
    throw new Error('Cannot confirm model cost');
  const estimate = Math.ceil(characters * factor * discount);
  const remaining = subscription.character_limit - subscription.character_count;
  if (!Number.isFinite(remaining) || remaining < estimate || estimate > 10000)
    throw new Error('Cannot confirm included quota');
  for (const voice of Object.values(cast.voices)) {
    if ((await get('/v1/voices/' + voice.voiceId)).voice_id !== voice.voiceId)
      throw new Error('Voice unavailable');
  }
  const usagePath = root + '/usage.json';
  if (!(await exists(usagePath)))
    await save(usagePath, {
      before: subscription.character_count,
      limit: subscription.character_limit,
      estimated: estimate,
      startedAt: new Date().toISOString(),
    });
  for (const [index, entry] of entries.entries()) {
    if (patchMap.has(entry.id)) {
      console.log(
        `${index + 1}/${entries.length} ${entry.id}: retained repair`,
      );
      continue;
    }
    const result = await generate(
      prepareJob(entry.request),
      root + '/raw',
      key,
    );
    const media = probe(path.join(result.directory, 'speech.mp3'));
    console.log(
      `${index + 1}/${entries.length} ${entry.id}: ${result.cached ? 'cached' : 'generated'} ${media.duration.toFixed(2)}s`,
    );
  }
  const after = await get('/v1/user/subscription');
  const usage = await json(usagePath);
  await save(usagePath, {
    ...usage,
    after: after.character_count,
    observedDifference: after.character_count - usage.before,
    finishedAt: new Date().toISOString(),
  });
  console.log(
    'All recordings generated. Run install to compress and integrate.',
  );
  process.exit(0);
}

// Verify the complete paid batch before changing any game asset.
for (const entry of entries) {
  if (patchMap.has(entry.id)) continue;
  const receipt = await json(path.join(rawPath(entry), 'receipt.json'));
  if (
    receipt.status !== 'complete' ||
    receipt.requestHash !== entry.requestHash ||
    receipt.files.find((f) => f.name === 'speech.mp3')?.sha256 !==
      hash(await readFile(path.join(rawPath(entry), 'speech.mp3')))
  )
    throw new Error('Missing or changed paid take: ' + entry.id);
}
const archive = root + '/previous';
await mkdir(archive, { recursive: true });
for (const name of ['station-voice-manifest.json', 'station-mouth-cues.json'])
  if (!(await exists(archive + '/' + name)))
    await copyFile('src/game/' + name, archive + '/' + name);
for (const word of words)
  if (!(await exists(archive + '/' + word.term + '-pronunciation.json')))
    await copyFile(
      'docs/voice/' + word.term + '-pronunciation.json',
      archive + '/' + word.term + '-pronunciation.json',
    );
const previous = await json(archive + '/station-voice-manifest.json');
const oldFiles = [
  ...previous.clips,
  ...(await Promise.all(
    words.map((w) => json(archive + '/' + w.term + '-pronunciation.json')),
  )),
];
for (const old of oldFiles) {
  const input = path.resolve('public', old.file),
    backup = path.resolve(archive, 'public', old.file);
  if (
    !input.startsWith(path.resolve('public') + path.sep) ||
    !backup.startsWith(path.resolve(archive, 'public') + path.sep)
  )
    throw new Error('Invalid archive path');
  if (!(await exists(backup))) {
    if (hash(await readFile(input)) !== old.audioSha256)
      throw new Error('Changed prior audio');
    await mkdir(path.dirname(backup), { recursive: true });
    await copyFile(input, backup);
  }
  if (hash(await readFile(backup)) !== old.audioSha256)
    throw new Error('Archive integrity failed');
}
// Later authorized batches must survive reinstalling the original 01–05 batch.
const currentManifest = await json('src/game/station-voice-manifest.json');
const batchIds = new Set(entries.map((entry) => entry.id));
const retainedClips = currentManifest.clips.filter(
  (clip) => !batchIds.has(clip.id),
);
for (const clip of retainedClips) {
  const file = path.resolve('public', clip.file);
  if (
    !file.startsWith(path.resolve('public') + path.sep) ||
    hash(await readFile(file)) !== clip.audioSha256
  )
    throw new Error('Invalid later-batch recording: ' + clip.id);
}
const clips = [...retainedClips],
  pronunciations = [];
for (const entry of entries) {
  if (patchMap.has(entry.id)) {
    clips.push(patchMap.get(entry.id));
    continue;
  }
  const input = path.join(rawPath(entry), 'speech.mp3');
  const sourceAudioSha256 = hash(await readFile(input));
  const file = entry.term
    ? `audio/en-US/elevenlabs-${entry.speaker}-v1/${entry.term}.mp3`
    : `audio/station/${entry.speaker}/${entry.id}-${entry.requestHash.slice(0, 12)}.mp3`;
  const output = path.join('public', file);
  await mkdir(path.dirname(output), { recursive: true });
  const measured = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      input,
      '-af',
      'loudnorm=I=-22:TP=-2:LRA=7:print_format=json',
      '-f',
      'null',
      '-',
    ],
    { ...options, encoding: 'utf8' },
  );
  if (measured.error || measured.status !== 0)
    throw new Error('Audio measurement failed');
  const meter = JSON.parse(
    measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? '{}',
  );
  const gain = Math.min(
    -22 - Number(meter.input_i),
    -2 - Number(meter.input_tp),
  );
  if (!Number.isFinite(gain)) throw new Error('Invalid loudness');
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-i',
      input,
      '-af',
      `volume=${gain.toFixed(3)}dB`,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '96k',
      output,
    ],
    options,
  );
  const media = probe(output);
  const common = {
    voiceId: entry.voiceId,
    file,
    requestHash: entry.requestHash,
    audioSha256: hash(await readFile(output)),
    sourceAudioSha256,
    gainDb: gain,
    duration: media.duration,
  };
  if (entry.term) {
    const receipt = {
      term: entry.term,
      provider: 'elevenlabs',
      modelId: cast.modelId,
      ...common,
      review: 'generated-awaiting-listening',
    };
    await save('docs/voice/' + entry.term + '-pronunciation.json', receipt);
    pronunciations.push(receipt);
  } else
    clips.push({
      id: entry.id,
      speaker: entry.speaker,
      sourceText: entry.sourceText,
      spokenText: entry.spokenText,
      ...common,
    });
}
const manifest = {
  provider: 'elevenlabs',
  modelId: cast.modelId,
  review: 'voices-owner-selected; full-lines-await-listening',
  clips,
};
await save('src/game/station-voice-manifest.json.tmp', manifest);
await rename(
  'src/game/station-voice-manifest.json.tmp',
  'src/game/station-voice-manifest.json',
);
execFileSync(
  process.execPath,
  ['scripts/build-cat-mouth-cues.mjs', '--station'],
  { ...options, stdio: 'inherit' },
);
// Archived obsolete files no longer inflate the shipped public directory.
const active = new Set([...clips, ...pronunciations].map((c) => c.file));
for (const old of oldFiles) {
  if (active.has(old.file)) continue;
  const file = path.resolve('public', old.file);
  if (!file.startsWith(path.resolve('public') + path.sep))
    throw new Error('Invalid cleanup path');
  if (await exists(file)) {
    if (hash(await readFile(file)) !== old.audioSha256)
      throw new Error('Prior audio changed during install');
    await unlink(file);
  }
}
await save(root + '/manifest.json', { ...manifest, pronunciations });
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const cards = clips
  .map(
    (c) =>
      `<article><h2>${c.speaker === 'tik' ? 'Тик · Will' : c.speaker === 'lumi' ? 'Люми · Garry' : 'Марта · Matilda'} <small>${escape(c.id)}</small></h2><p>${escape(c.sourceText)}</p><audio controls preload="none" src="../../../public/${escape(c.file)}"></audio></article>`,
  )
  .join('');
await writeFile(
  root + '/listen.html',
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Станция — ElevenLabs v3</title><style>body{margin:0;background:#14282b;color:#eee7d6;font:17px/1.6 system-ui,sans-serif}main{max-width:850px;margin:auto;padding:24px 18px}h1{font:32px Georgia,serif}h2{font-size:18px;color:#efc77e}small{display:block;color:#b6cbc8;font-size:12px;overflow-wrap:anywhere}article{margin:20px 0;padding:16px 22px;border:1px solid #526662;border-radius:14px;background:#233e40}audio{width:100%}</style><main><h1>Марта, Тик и Люми · ElevenLabs v3</h1><p>${clips.length} реплики пяти эпизодов. Голоса выбраны; полные реплики готовы для слуховой проверки. Нажатие Play останавливает предыдущую запись.</p>${cards}</main><script>const players=[...document.querySelectorAll('audio')];for(const p of players)p.addEventListener('play',()=>{for(const q of players)if(q!==p)q.pause()});</script></html>`,
);
console.log(
  JSON.stringify({
    installed: clips.length,
    words: pronunciations.length,
    seconds: clips.reduce((n, c) => n + c.duration, 0),
    listen: root + '/listen.html',
  }),
);
