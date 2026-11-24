// Bounded 23.11 editorial repair. One continuous take per selected line; no paid retries.
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';
import { bilingualSpeech } from './lib/bilingual-speech.mjs';

const mode = process.argv[2];
if (
  !['prepare', 'generate', 'install'].includes(mode) ||
  process.argv.length !== 3
)
  throw Error('Use prepare|generate|install');
const tag = 'chapter-02-review-v1',
  root = `artifacts/voice/${tag}`;
const planPath = 'tests/fixtures/voice/chapter-02-review-plan.json';
const manifestPath = 'src/game/station-voice-manifest.json';
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const save = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + '\n');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const cast = await json('tests/fixtures/voice/station-elevenlabs-cast.json');
const options = {
  windowsHide: true,
  timeout: 120000,
  maxBuffer: 16 * 1024 * 1024,
};
if (mode === 'prepare') {
  if (existsSync(planPath)) throw Error('Keep existing provenance');
  const manifest = await json(manifestPath);
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  const entries = [];
  try {
    const { levels } = await server.ssrLoadModule('/src/domain/levels.ts');
    const { reflections } = await server.ssrLoadModule(
      '/src/domain/episodes.ts',
    );
    const { dialogueVoiceLine } = await server.ssrLoadModule(
      '/src/domain/dialogue.ts',
    );
    for (const [episode, rootLevel] of Object.entries(levels).filter(([id]) =>
      id.startsWith('chapter-02'),
    )) {
      for (
        let definition = rootLevel;
        definition;
        definition = definition.continuation
      ) {
        const room = { episode, definition, explanations: [] };
        const lines = [];
        for (const conversation of ['task', 'success']) {
          const texts =
            conversation === 'task'
              ? definition.presentation.introduction
              : definition.presentation.success;
          texts.forEach((_, i) =>
            lines.push(dialogueVoiceLine(room, conversation, i)),
          );
        }
        if (!definition.continuation)
          for (const choice of reflections[episode].choices)
            lines.push(
              dialogueVoiceLine(
                { ...room, explanations: [choice.id] },
                'success',
                definition.presentation.success.length - 1,
              ),
            );
        for (const line of lines) {
          const old = manifest.clips.find((c) => c.id === line.id);
          if (!old) throw Error('Missing original ' + line.id);
          if (
            old.sourceText === line.text &&
            !line.text.startsWith('Верно. Согласная + y')
          )
            continue;
          const spokenText = bilingualSpeech(line.text);
          const job = prepareJob({
            kind: 'speech',
            id: line.id + '-review-v1',
            modelId: 'eleven_v3',
            voiceId: old.voiceId,
            text: spokenText,
            seed: 43,
            textNormalization: 'off',
          });
          entries.push({
            id: line.id,
            speaker: old.speaker,
            voiceId: old.voiceId,
            sourceText: line.text,
            sourceTextHash: hash(line.text),
            spokenText,
            action: 'continuous-take',
            job,
          });
        }
      }
    }
  } finally {
    await server.close();
  }
  if (entries.length !== 5)
    throw Error(`Unexpected repair scope: ${entries.length}`);
  await mkdir(root + '/previous', { recursive: true });
  await copyFile(manifestPath, root + '/previous/manifest.json');
  await copyFile(
    'src/game/station-mouth-cues.json',
    root + '/previous/cues.json',
  );
  for (const e of entries) {
    const clip = manifest.clips.find((c) => c.id === e.id);
    await copyFile('public/' + clip.file, root + '/previous/' + e.id + '.mp3');
  }
  await save(planPath, {
    modelId: 'eleven_v3',
    review: 'awaiting-listening',
    entries,
  });
  console.log(
    entries.map((e) => ({
      id: e.id,
      text: e.sourceText,
      spoken: e.spokenText,
    })),
  );
  process.exit(0);
}
const plan = await json(planPath),
  previous = await json(root + '/previous/manifest.json');
const rawDir = (e) =>
  `${root}/raw/${e.job.request.id}-${e.job.requestHash.slice(0, 16)}`;
if (mode === 'generate') {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw Error('Missing key');
  const get = async (p) => {
    const r = await fetch('https://api.elevenlabs.io' + p, {
      headers: { 'xi-api-key': key },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error(`Preflight HTTP ${r.status}`);
    return r.json();
  };
  const sub = await get('/v1/user/subscription');
  const model = (await get('/v1/models')).find(
    (m) => m.model_id === plan.modelId && m.can_do_text_to_speech,
  );
  const rate =
    model?.model_rates?.character_cost_multiplier *
    model?.model_rates?.cost_discount_multiplier;
  if (!(rate > 0)) throw Error('Unknown billing');
  const remaining = sub.character_limit - sub.character_count;
  const estimate = plan.entries.reduce(
    (n, e) => n + Math.ceil(e.spokenText.length * rate),
    0,
  );
  console.log({
    remaining,
    maximumEstimate: estimate,
    lines: plan.entries.length,
  });
  if (estimate > remaining) throw Error('Insufficient included credits');
  let charge = 0;
  for (const e of plan.entries) {
    const job = prepareJob(e.job.request);
    if (
      job.requestHash !== e.job.requestHash ||
      e.voiceId !== cast.voices[e.speaker].voiceId
    )
      throw Error('Changed request/cast');
    const result = await generate(job, root + '/raw', key);
    const receipt = await json(rawDir(e) + '/receipt.json');
    const cost = receipt.characterCost ?? Math.ceil(e.spokenText.length * rate);
    charge += cost;
    await save(root + '/usage.json', {
      before: sub.character_count,
      remainingBefore: remaining,
      maximumEstimate: estimate,
      chargedOrReserved: charge,
    });
    console.log({ id: e.id, cached: result.cached, cost });
    if (cost > Math.ceil(e.spokenText.length * rate))
      throw Error('Unexpected cost');
  }
  process.exit(0);
}
const current = await json(manifestPath),
  replacements = new Map();
await mkdir(root + '/assembled', { recursive: true });
for (const e of plan.entries) {
  const old = previous.clips.find((c) => c.id === e.id),
    live = current.clips.find((c) => c.id === e.id);
  if (live.audioSha256 !== old.audioSha256 && live.repair !== tag)
    throw Error('Concurrent recording change');
  const receipt = await json(rawDir(e) + '/receipt.json'),
    raw = await readFile(rawDir(e) + '/speech.mp3');
  if (
    receipt.status !== 'complete' ||
    receipt.requestHash !== e.job.requestHash ||
    receipt.files.find((f) => f.name === 'speech.mp3')?.sha256 !== hash(raw)
  )
    throw Error('Invalid receipt');
  const wav = root + '/assembled/' + e.id + '.wav';
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      '-y',
      '-i',
      rawDir(e) + '/speech.mp3',
      '-ac',
      '1',
      '-ar',
      '24000',
      wav,
    ],
    options,
  );
  const measured = spawnSync(
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
  if (measured.status !== 0) throw Error('Measurement failed');
  const meter = JSON.parse(
    measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? '{}',
  );
  const gain = Math.min(
    -22 - Number(meter.input_i),
    -2 - Number(meter.input_tp),
  );
  if (!Number.isFinite(gain)) throw Error('Invalid loudness');
  const assembly = {
    mode: 'continuous-take; no cuts',
    requestHash: e.job.requestHash,
    rawSha256: hash(raw),
  };
  const requestHash = hash(JSON.stringify(assembly)),
    file = `audio/station/${e.speaker}/${e.id}-${requestHash.slice(0, 12)}.mp3`;
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
  const duration = Number(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        'public/' + file,
      ],
      { ...options, encoding: 'utf8' },
    ),
  );
  if (!(duration > 0.1 && duration < 120)) throw Error('Bad duration');
  const clip = {
    ...old,
    sourceText: e.sourceText,
    spokenText: e.spokenText,
    file,
    requestHash,
    audioSha256: hash(await readFile('public/' + file)),
    sourceAudioSha256: hash(await readFile(wav)),
    gainDb: gain,
    duration,
    repair: tag,
  };
  await save(root + '/assembled/' + e.id + '.json', {
    assembly,
    clip,
    listening: 'awaiting-owner',
  });
  replacements.set(e.id, clip);
}
for (const clip of current.clips.filter((c) => !replacements.has(c.id))) {
  if (
    JSON.stringify(clip) !==
    JSON.stringify(previous.clips.find((c) => c.id === clip.id))
  )
    throw Error('Untouched clip changed');
  if (hash(await readFile('public/' + clip.file)) !== clip.audioSha256)
    throw Error('Audio checksum changed');
}
await save(manifestPath + '.tmp', {
  ...current,
  clips: current.clips.map((c) => replacements.get(c.id) ?? c),
});
await rename(manifestPath + '.tmp', manifestPath);
execFileSync(
  process.execPath,
  ['scripts/build-cat-mouth-cues.mjs', '--station'],
  { ...options, stdio: 'inherit' },
);
console.log({
  installed: replacements.size,
  preserved: current.clips.length - replacements.size,
});
