// Offline, explicitly selected five-episode batch; one take per request.
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { joinSpeech } from './lib/speech-joins.mjs';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';

const command = process.argv[2] ?? 'prepare';
const batch = process.argv[3] ?? '06-10';
const finale = batch === '16-20';
const departure = batch === '11-15' || finale;
const episodes = finale
  ? ['16', '17', '18', '19', '20']
  : departure
    ? ['11', '12', '13', '14', '15']
    : ['06', '07', '08', '09', '10'];
const expectedLines = finale ? 79 : departure ? 90 : 77;
if (
  !['prepare', 'generate', 'install', 'verify'].includes(command) ||
  !['06-10', '11-15', '16-20'].includes(batch) ||
  process.argv.length > 4
)
  throw Error(
    'Usage: node scripts/station-next-voice.mjs prepare|generate|install|verify [06-10|11-15|16-20]',
  );
const root = `artifacts/voice/station-${batch}-elevenlabs-v1`;
const planPath = `docs/voice/station-${batch}-elevenlabs-plan.json`;
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = async (file) => {
  try {
    await readFile(file);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
};
const options = {
  windowsHide: true,
  timeout: 120000,
  maxBuffer: 16 * 1024 * 1024,
};
if (
  command !== 'verify' &&
  (await exists('docs/voice/station-speech-repair-plan.json'))
)
  throw Error(
    'Archived segmented workflow: preserve continuous repairs. Use scripts/station-speech-repair.mjs for its prepared scope; author a new continuous plan for new work.',
  );
const cast = await json('docs/voice/station-elevenlabs-cast.json');
if (cast.status !== 'owner-selected' || cast.modelId !== 'eleven_v3')
  throw Error('Cast changed');
const lines = [];
for (const n of episodes) {
  const script = await json(`docs/voice/station-${n}-script.json`);
  if (script.lines.some((l) => !l.id.startsWith(`chapter-02-${n}-`)))
    throw Error('Unexpected source scope');
  lines.push(...script.lines);
}
if (
  lines.length !== expectedLines ||
  new Set(lines.map((l) => l.id)).size !== expectedLines
)
  throw Error('Review changed batch scope');

// Display text stays exact. Spoken notation is explicit, rather than asking TTS to read symbols.
function spokenSource(text) {
  if (departure)
    text = text.replaceAll('=', ' означает то же, что ').replaceAll('/', ', ');
  return text
    .replace(
      'Значок ’ называется апострофом',
      'Этот значок называется апострофом',
    )
    .replace(
      'В I’m часть ’m передаёт am',
      'В сокращении I’m часть после апострофа передаёт am',
    )
    .replaceAll('→', ' превращается в ')
    .replaceAll('+', ' плюс ')
    .replace(/\ba\/an\b/gi, 'a или an')
    .replace(/[\t ]+/g, ' ');
}
// Take complete language fragments, with no phoneme cuts, crossfades or silence removal.
function segments(text) {
  const result = [];
  const english = departure
    ? /-?[A-Za-z]+(?:[’'][A-Za-z]+)?(?:[ ,]+[A-Za-z]+(?:[’'][A-Za-z]+)?)*(?:[.!?])?/g
    : /-?[A-Za-z]+(?:[’'][A-Za-z]+)?(?:[ ,]+[A-Za-z]+(?:[’'][A-Za-z]+)?)*/g;
  let cursor = 0;
  const add = (rawText, languageCode) => {
    if (!rawText) return;
    let speech = rawText.replace(/^[\s—:;,«»?!.]+|[\s—:;,«»]+$/g, '').trim();
    if (!/[A-Za-zА-Яа-яЁё]/.test(speech)) return;
    if (languageCode === 'en') {
      const spelling = {
        s: 'S',
        es: 'E, S',
        ies: 'I, E, S',
        ys: 'Y, S',
        x: 'X',
        y: 'Y',
        r: 'R',
        e: 'E',
        i: 'I',
        a: 'A',
      };
      speech = spelling[speech.replace(/^-/, '').toLowerCase()] ?? speech;
      if (!/[.!?]$/.test(speech)) speech += '.';
    } else {
      // A lone consonant preposition can be spoken as its letter name.
      speech =
        {
          В: 'В записи',
          в: 'в записи',
          С: 'Со словом',
          с: 'со словом',
          К: 'К слову',
          к: 'к слову',
          У: 'У слова',
          у: 'у слова',
          А: 'А вот',
          а: 'а вот',
        }[speech] ?? speech;
    }
    result.push({ rawText, text: speech, languageCode });
  };
  for (const match of text.matchAll(english)) {
    add(text.slice(cursor, match.index), 'ru');
    add(match[0], 'en');
    cursor = match.index + match[0].length;
  }
  add(text.slice(cursor), 'ru');
  return result;
}
const jobs = new Map();
const entries = lines.map((line) => {
  const voiceId = cast.voices[line.speaker]?.voiceId;
  if (!voiceId) throw Error('Missing actor');
  const spokenText = spokenSource(line.sourceText);
  const parts = segments(spokenText).map((part) => {
    const id = `station-next-${line.speaker}-${hash(part.languageCode + '\n' + part.text).slice(0, 20)}-v1`;
    const prepared = prepareJob({
      kind: 'speech',
      id,
      modelId: cast.modelId,
      voiceId,
      seed: 42,
      text: part.text,
      languageCode: part.languageCode,
    });
    jobs.set(id, {
      request: prepared.request,
      requestHash: prepared.requestHash,
    });
    return { ...part, jobId: id, requestHash: prepared.requestHash };
  });
  return {
    id: line.id,
    speaker: line.speaker,
    voiceId,
    sourceText: line.sourceText,
    sourceTextHash: hash(line.sourceText),
    spokenText,
    segments: parts,
  };
});
const plan = {
  provider: 'elevenlabs',
  modelId: cast.modelId,
  episodes,
  review: 'owner-authorized; text-reviewed; generated-audio-awaits-listening',
  assembly:
    'whole-language-fragments; no trimming; 60ms gap; constant per-line gain',
  characters: [...jobs.values()].reduce((n, j) => n + j.request.text.length, 0),
  entries,
  jobs: [...jobs.values()],
};
if (plan.characters > 10000 || plan.jobs.length > 400)
  throw Error('Review changed batch budget');
await mkdir(root, { recursive: true });
if (command === 'prepare') {
  await save(planPath, plan);
  console.log({
    lines: entries.length,
    jobs: jobs.size,
    characters: plan.characters,
    actors: Object.fromEntries(
      Object.keys(cast.voices).map((s) => [
        s,
        entries.filter((e) => e.speaker === s).length,
      ]),
    ),
  });
  process.exit(0);
}
if (JSON.stringify(await json(planPath)) !== JSON.stringify(plan))
  throw Error('Prepared plan is stale; review before generation');
const rawPath = (job) =>
  path.join(root, 'raw', `${job.request.id}-${job.requestHash.slice(0, 16)}`);
// Reuse only complete, byte-verified exact requests from the previous batch.
if (departure && command === 'generate') {
  let reused = 0;
  for (const job of plan.jobs) {
    if (await exists(path.join(rawPath(job), 'receipt.json'))) continue;
    let prior;
    for (const priorBatch of finale ? ['11-15', '06-10'] : ['06-10']) {
      const candidate = path.join(
        `artifacts/voice/station-${priorBatch}-elevenlabs-v1/raw`,
        path.basename(rawPath(job)),
      );
      if (await exists(path.join(candidate, 'receipt.json'))) {
        prior = candidate;
        break;
      }
    }
    if (!prior) continue;
    const receipt = await json(path.join(prior, 'receipt.json'));
    if (
      receipt.status !== 'complete' ||
      receipt.requestHash !== job.requestHash ||
      receipt.files.length !== 1 ||
      receipt.files[0].name !== 'speech.mp3'
    )
      throw Error('Invalid prior cache');
    const bytes = await readFile(path.join(prior, 'speech.mp3'));
    if (hash(bytes) !== receipt.files[0].sha256)
      throw Error('Prior cache changed');
    await mkdir(rawPath(job), { recursive: true });
    await writeFile(path.join(rawPath(job), 'speech.mp3'), bytes);
    await copyFile(
      path.join(prior, 'receipt.json'),
      path.join(rawPath(job), 'receipt.json'),
    );
    reused++;
  }
  console.log({ reusedExactJobs: reused });
}
const verifyRaw = async (job) => {
  const receipt = await json(path.join(rawPath(job), 'receipt.json'));
  const bytes = await readFile(path.join(rawPath(job), 'speech.mp3'));
  if (
    receipt.status !== 'complete' ||
    receipt.requestHash !== job.requestHash ||
    receipt.files.find((f) => f.name === 'speech.mp3')?.sha256 !== hash(bytes)
  )
    throw Error('Unverified take: ' + job.request.id);
  return hash(bytes);
};
if (command === 'generate') {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw Error('Missing API key');
  const get = async (endpoint) => {
    const r = await fetch('https://api.elevenlabs.io' + endpoint, {
      headers: { 'xi-api-key': key },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error(`Preflight ${endpoint}: HTTP ${r.status}`);
    return r.json();
  };
  const subscription = await get('/v1/user/subscription');
  const models = await get('/v1/models');
  const model = models.find(
    (m) => m.model_id === cast.modelId && m.can_do_text_to_speech,
  );
  const factor = model?.model_rates?.character_cost_multiplier;
  const discount = model?.model_rates?.cost_discount_multiplier;
  if (!(factor > 0 && discount > 0)) throw Error('Unknown billing');
  const estimate = Math.ceil(plan.characters * factor * discount);
  if (
    estimate > 10000 ||
    !Number.isFinite(
      subscription.character_limit - subscription.character_count,
    ) ||
    subscription.character_limit - subscription.character_count < estimate
  )
    throw Error('Insufficient included quota');
  for (const voice of Object.values(cast.voices))
    if ((await get('/v1/voices/' + voice.voiceId)).voice_id !== voice.voiceId)
      throw Error('Voice unavailable');
  if (!(await exists(root + '/usage.json')))
    await save(root + '/usage.json', {
      before: subscription.character_count,
      limit: subscription.character_limit,
      estimate,
      startedAt: new Date().toISOString(),
    });
  console.log({
    lines: entries.length,
    jobs: jobs.size,
    characters: plan.characters,
    estimate,
    remaining: subscription.character_limit - subscription.character_count,
  });
  for (const [i, job] of plan.jobs.entries()) {
    const result = await generate(prepareJob(job.request), root + '/raw', key);
    await verifyRaw(job);
    console.log(
      `${i + 1}/${plan.jobs.length} ${job.request.id} ${result.cached ? 'cached' : 'generated'}`,
    );
  }
  const after = await get('/v1/user/subscription');
  const usage = await json(root + '/usage.json');
  await save(root + '/usage.json', {
    ...usage,
    after: after.character_count,
    observedDifference: after.character_count - usage.before,
    remaining: after.character_limit - after.character_count,
    finishedAt: new Date().toISOString(),
  });
  console.log('All paid takes complete; no automatic retakes.');
  process.exit(0);
}
const jobMap = new Map(plan.jobs.map((j) => [j.request.id, j]));
for (const job of plan.jobs) await verifyRaw(job);
const previous = await json('src/game/station-voice-manifest.json');
const ids = new Set(entries.map((e) => e.id));
const retained = previous.clips.filter((c) => !ids.has(c.id));
if (retained.length < (finale ? 241 : departure ? 151 : 74))
  throw Error('Unexpected prior scope; do not overwrite other batches');
for (const c of retained)
  if (hash(await readFile(path.join('public', c.file))) !== c.audioSha256)
    throw Error('Prior clip changed');
if (command === 'verify') {
  for (const entry of entries) {
    const c = previous.clips.find((c) => c.id === entry.id);
    if (
      !c ||
      c.sourceText !== entry.sourceText ||
      c.voiceId !== entry.voiceId ||
      hash(await readFile(path.join('public', c.file))) !== c.audioSha256
    )
      throw Error('Installed clip mismatch: ' + entry.id);
  }
  const baseline = await json(root + '/previous/station-voice-manifest.json');
  if (
    baseline.clips.some(
      (old) =>
        JSON.stringify(old) !==
        JSON.stringify(retained.find((c) => c.id === old.id)),
    )
  )
    throw Error('Prior entries changed');
  const oldCues = await json(root + '/previous/station-mouth-cues.json');
  const currentCues = await json('src/game/station-mouth-cues.json');
  if (
    oldCues.step !== currentCues.step ||
    oldCues.clips.some(
      (old) =>
        JSON.stringify(old) !==
        JSON.stringify(currentCues.clips.find((cue) => cue.id === old.id)),
    )
  )
    throw Error('Prior mouth cues changed');
  console.log({ verified: entries.length, retained: retained.length });
  process.exit(0);
}
await mkdir(root + '/previous', { recursive: true });
for (const name of ['station-voice-manifest.json', 'station-mouth-cues.json'])
  if (!(await exists(root + '/previous/' + name)))
    await copyFile('src/game/' + name, root + '/previous/' + name);
await mkdir(root + '/assembled', { recursive: true });
const pcmCache = new Map();
const clips = [];
for (const entry of entries) {
  const chunks = [];
  const parts = [];
  const sources = [];
  for (const [index, segment] of entry.segments.entries()) {
    const job = jobMap.get(segment.jobId);
    if (!pcmCache.has(segment.jobId))
      pcmCache.set(
        segment.jobId,
        execFileSync(
          'ffmpeg',
          [
            '-v',
            'error',
            '-nostdin',
            '-i',
            path.join(rawPath(job), 'speech.mp3'),
            '-ac',
            '1',
            '-ar',
            '24000',
            '-f',
            's16le',
            'pipe:1',
          ],
          options,
        ),
      );
    const pcm = pcmCache.get(segment.jobId);
    if (pcm.length < 2400) throw Error('Empty take');
    chunks.push(pcm);
    parts.push({ ...segment, pcm });
    if (index < entry.segments.length - 1) chunks.push(Buffer.alloc(2880));
    sources.push({ jobId: segment.jobId, audioSha256: await verifyRaw(job) });
  }
  const montage = finale ? joinSpeech(parts) : null;
  const adjusted = montage?.joins.some(
    (join) => join.beforeMs !== join.afterMs,
  );
  const assembly = adjusted
    ? {
        segments: entry.segments,
        sources,
        mode: montage.policy.version,
        policy: montage.policy,
        ranges: montage.ranges,
        joins: montage.joins,
      }
    : { segments: entry.segments, sources, mode: plan.assembly };
  const requestHash = hash(JSON.stringify(assembly));
  const current = previous.clips.find((clip) => clip.id === entry.id);
  if (
    finale &&
    current?.requestHash === requestHash &&
    current.sourceText === entry.sourceText &&
    current.voiceId === entry.voiceId
  ) {
    if (hash(await readFile('public/' + current.file)) !== current.audioSha256)
      throw Error('Current clip changed');
    clips.push(current);
    continue;
  }
  const wav = path.join(root, 'assembled', entry.id + '.wav');
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      '-y',
      '-f',
      's16le',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-i',
      'pipe:0',
      wav,
    ],
    { ...options, input: adjusted ? montage.pcm : Buffer.concat(chunks) },
  );
  const measurement = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      wav,
      '-af',
      'loudnorm=I=-22:TP=-2:LRA=7:print_format=json',
      '-f',
      'null',
      '-',
    ],
    { ...options, encoding: 'utf8' },
  );
  if (measurement.status !== 0) throw Error('Measurement failed');
  const meter = JSON.parse(
    measurement.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? '{}',
  );
  const gain = Math.min(
    -22 - Number(meter.input_i),
    -2 - Number(meter.input_tp),
  );
  if (!Number.isFinite(gain)) throw Error('Invalid loudness');
  const file = `audio/station/${entry.speaker}/${entry.id}-${requestHash.slice(0, 12)}.mp3`;
  await mkdir(path.dirname('public/' + file), { recursive: true });
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      '-y',
      '-i',
      wav,
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
      'public/' + file,
    ],
    options,
  );
  const media = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration,size:stream=codec_name,sample_rate,channels',
        '-of',
        'json',
        'public/' + file,
      ],
      { ...options, encoding: 'utf8' },
    ),
  );
  const duration = Number(media.format.duration);
  if (
    !(duration > 0.1 && duration < 120) ||
    media.streams[0].codec_name !== 'mp3'
  )
    throw Error('Invalid output');
  clips.push({
    id: entry.id,
    speaker: entry.speaker,
    sourceText: entry.sourceText,
    spokenText: entry.spokenText,
    voiceId: entry.voiceId,
    file,
    requestHash,
    audioSha256: hash(await readFile('public/' + file)),
    sourceAudioSha256: hash(await readFile(wav)),
    gainDb: gain,
    duration,
  });
  await save(path.join(root, 'assembled', entry.id + '.json'), {
    ...entry,
    assembly,
    clip: clips.at(-1),
  });
  console.log('Prepared ' + entry.id);
}
await save(root + '/manifest.json', {
  provider: cast.provider,
  modelId: cast.modelId,
  review: 'generated-awaiting-listening',
  clips,
});
await save('src/game/station-voice-manifest.json.tmp', {
  ...previous,
  clips: [...retained, ...clips],
});
await rename(
  'src/game/station-voice-manifest.json.tmp',
  'src/game/station-voice-manifest.json',
);
execFileSync(
  process.execPath,
  ['scripts/build-cat-mouth-cues.mjs', '--station'],
  { ...options, stdio: 'inherit' },
);
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
await writeFile(
  root + '/listen.html',
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Станция: эпизоды ${batch}</title><style>body{background:#152c2c;color:#eee6d3;font:17px/1.6 system-ui;margin:0}main{max-width:820px;margin:auto;padding:20px}article{padding:20px;margin:20px 0;border:1px solid #6b7967;border-radius:14px}h2{font-size:19px;color:#eed090}small{display:block;overflow-wrap:anywhere}audio{width:100%}</style><main><h1>Эпизоды ${batch} · ${clips.length} реплик</h1><p>Matilda, Will и Garry. Новые записи подключены; произношение и темп ждут прослушивания.</p>${clips.map((c) => `<article><h2>${escape(cast.voices[c.speaker].name)}<small>${c.id}</small></h2><p>${escape(c.sourceText)}</p><audio controls preload="none" src="../../../public/${c.file}"></audio></article>`).join('')}</main><script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script></html>`,
);
console.log({
  installed: clips.length,
  retained: retained.length,
  seconds: clips.reduce((n, c) => n + c.duration, 0),
  listen: root + '/listen.html',
});
