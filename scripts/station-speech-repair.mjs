// Scoped, resumable repair. Never retry an uncertain paid request.
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  access,
  rename,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';
import { joinSpeech, joinPolicy } from './lib/speech-joins.mjs';

const mode = process.argv[2];
const wholeChapter = process.argv[3] === 'chapter';
if (process.argv.length > 4 || (process.argv[3] && !wholeChapter))
  throw Error('Unknown scope');
if (wholeChapter && !['install', 'verify'].includes(mode))
  throw Error(
    'Use chapter-bilingual-voice.mjs to prepare/generate the whole-chapter plan',
  );
if (!['prepare', 'generate', 'install', 'verify'].includes(mode))
  throw Error('Expected prepare|generate|install|verify');
const repairTag = wholeChapter
  ? 'chapter-02-bilingual-v1'
  : 'station-06-20-speech-v3';
const root = `artifacts/voice/${repairTag}`;
const planFile = wholeChapter
  ? 'docs/voice/chapter-02-bilingual-plan.json'
  : 'docs/voice/station-speech-repair-plan.json';
const manifestFile = 'src/game/station-voice-manifest.json';
const cuesFile = 'src/game/station-mouth-cues.json';
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const save = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + '\n');
const hash = (v) => createHash('sha256').update(v).digest('hex');
const exists = async (p) => {
  try {
    await access(p);
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
  !wholeChapter &&
  mode === 'install' &&
  (await exists('docs/voice/chapter-02-bilingual-plan.json'))
)
  throw Error(
    'Whole-chapter repairs supersede this installer scope; use install chapter to preserve current takes.',
  );
const decode = (file) =>
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      '-i',
      file,
      '-ac',
      '1',
      '-ar',
      '24000',
      '-f',
      's16le',
      'pipe:1',
    ],
    options,
  );
const batches = ['06-10', '11-15', '16-20'];
const filler = new Set([
  'В записи',
  'в записи',
  'Со словом',
  'со словом',
  'К слову',
  'к слову',
  'У слова',
  'у слова',
  'А вот',
  'а вот',
]);

if (mode === 'prepare') {
  if (await exists(planFile))
    throw Error('Plan already exists; do not overwrite repair provenance');
  await mkdir(root + '/previous', { recursive: true });
  const manifest = await json(manifestFile);
  const current06 = await json('docs/voice/station-06-script.json');
  const audit = [],
    entries = [];
  for (const batch of batches) {
    const source = await json(
      `docs/voice/station-${batch}-elevenlabs-plan.json`,
    );
    const pauses = await json(
      `artifacts/voice/station-${batch}-joins-v2/audit.json`,
    );
    for (const line of source.entries) {
      const reasons = [];
      if (line.id.startsWith('chapter-02-06-'))
        reasons.push('reported-episode-with-fragmented-speech');
      if (
        line.segments.some((s) => s.languageCode === 'ru' && filler.has(s.text))
      )
        reasons.push('automatic-filler');
      if (
        line.segments.some(
          (s) => s.languageCode === 'en' && /^[AI]\.$/.test(s.text),
        )
      )
        reasons.push('isolated-letter-or-pronoun');
      const joins = pauses.lines.find((l) => l.id === line.id).joins;
      const reassemble =
        batch !== '16-20' && joins.some((j) => j.beforeMs !== j.afterMs);
      const action = reasons.length
        ? 'continuous-take'
        : reassemble
          ? 'quiet-edge-repair'
          : 'preserve';
      audit.push({
        id: line.id,
        batch,
        action,
        reasons,
        originalJoins: joins,
        listening: 'not-auditioned',
      });
      if (action === 'preserve') continue;
      const sourceText =
        current06.lines.find((l) => l.id === line.id)?.sourceText ??
        line.sourceText;
      // Explicit spoken notation, never a changed displayed English example.
      // V3 IPA support is documented in the provider FAQ; acceptance still requires listening.
      const spokenText = sourceText
        .replace('Значок ’ называется', 'Этот значок называется')
        .replace(
          'В I’m часть ’m передаёт am',
          'В сокращении I’m часть после апострофа передаёт am',
        )
        .replaceAll('→', ' превращается в ')
        .replaceAll('+', ' плюс ')
        .replaceAll('=', ' означает то же, что ')
        .replaceAll('/', ', ')
        .replace(/апостроф/gi, (match) => match.slice(0, -1) + '\u0301' + 'ф')
        .replace(
          /-?[A-Za-z]+(?:[’'][A-Za-z]+)?(?:[ ,]+[A-Za-z]+(?:[’'][A-Za-z]+)?)*/g,
          (fragment) => {
            if (fragment === 'I' || fragment === 'i') return '/aɪ/';
            if (fragment === 'a' || fragment === 'A') return '/eɪ/';
            return fragment;
          },
        );
      const request =
        action === 'continuous-take'
          ? prepareJob({
              kind: 'speech',
              id: line.id + '-continuous-v3',
              modelId: 'eleven_v3',
              voiceId: line.voiceId,
              text: spokenText,
              seed: 42,
              textNormalization: 'off',
            })
          : null;
      entries.push({
        ...line,
        sourceText,
        sourceTextHash: hash(sourceText),
        spokenText: request ? spokenText : line.spokenText,
        batch,
        action,
        ...(request
          ? {
              job: {
                request: request.request,
                requestHash: request.requestHash,
              },
            }
          : {}),
      });
    }
  }
  for (const clip of manifest.clips) {
    if (hash(await readFile('public/' + clip.file)) !== clip.audioSha256)
      throw Error('Baseline changed: ' + clip.id);
    if (!entries.some((e) => e.id === clip.id)) continue;
    await mkdir(path.dirname(root + '/previous/' + clip.file), {
      recursive: true,
    });
    await copyFile('public/' + clip.file, root + '/previous/' + clip.file);
  }
  await copyFile(manifestFile, root + '/previous/manifest.json');
  await copyFile(cuesFile, root + '/previous/cues.json');
  const characters = entries.reduce(
    (n, e) => n + (e.job?.request.text.length ?? 0),
    0,
  );
  if (characters > 6500 || entries.filter((e) => e.job).length > 45)
    throw Error('Review increased paid scope');
  const plan = {
    modelId: 'eleven_v3',
    review: 'owner-authorized-repair; awaiting-listening',
    characters,
    entries,
    audit,
  };
  await save(planFile, plan);
  console.log({
    audited: audit.length,
    rerecord: entries.filter((e) => e.job).length,
    remount: entries.filter((e) => !e.job).length,
    characters,
  });
  process.exit(0);
}
const plan = await json(planFile);
const previous = await json(root + '/previous/manifest.json');
const rawPath = (e) =>
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
    if (!r.ok) throw Error(`Preflight ${p}: HTTP ${r.status}`);
    return r.json();
  };
  const subscription = await get('/v1/user/subscription');
  const models = await get('/v1/models');
  const model = models.find(
    (m) => m.model_id === plan.modelId && m.can_do_text_to_speech,
  );
  const rate =
    model?.model_rates?.character_cost_multiplier *
    model?.model_rates?.cost_discount_multiplier;
  if (!(rate > 0)) throw Error('Unknown billing');
  const jobs = plan.entries.filter((e) => e.job);
  const estimate = Math.ceil(plan.characters * rate);
  if (
    estimate > 6500 ||
    subscription.character_limit - subscription.character_count < estimate
  )
    throw Error('Included quota insufficient');
  for (const voiceId of new Set(jobs.map((e) => e.voiceId)))
    if ((await get('/v1/voices/' + voiceId)).voice_id !== voiceId)
      throw Error('Voice unavailable');
  if (!(await exists(root + '/usage.json')))
    await save(root + '/usage.json', {
      before: subscription.character_count,
      estimate,
      limit: subscription.character_limit,
    });
  for (const [i, e] of jobs.entries()) {
    if (prepareJob(e.job.request).requestHash !== e.job.requestHash)
      throw Error('Job hash changed');
    const result = await generate(
      prepareJob(e.job.request),
      root + '/raw',
      key,
    );
    console.log(
      `${i + 1}/${jobs.length} ${e.id} ${result.cached ? 'cached' : 'generated'}`,
    );
  }
  const after = await get('/v1/user/subscription');
  await save(root + '/usage.json', {
    ...(await json(root + '/usage.json')),
    after: after.character_count,
    remaining: after.character_limit - after.character_count,
    completedAt: new Date().toISOString(),
  });
  process.exit(0);
}
const verifiedRaw = async (dir, requestHash) => {
  const receipt = await json(dir + '/receipt.json');
  const bytes = await readFile(dir + '/speech.mp3');
  if (
    receipt.status !== 'complete' ||
    receipt.requestHash !== requestHash ||
    receipt.files.find((f) => f.name === 'speech.mp3')?.sha256 !== hash(bytes)
  )
    throw Error('Invalid raw take: ' + dir);
  return bytes;
};
if (mode === 'install') {
  const current = await json(manifestFile);
  // Validate every raw input before changing any live entry.
  for (const e of plan.entries) {
    if (e.job) await verifiedRaw(rawPath(e), e.job.requestHash);
    else
      for (const s of e.segments)
        await verifiedRaw(
          `artifacts/voice/station-${e.batch}-elevenlabs-v1/raw/${s.jobId}-${s.requestHash.slice(0, 16)}`,
          s.requestHash,
        );
  }
  const replacements = new Map();
  const superseded = [];
  await mkdir(root + '/assembled', { recursive: true });
  for (const e of plan.entries) {
    const old = previous.clips.find((c) => c.id === e.id);
    const live = current.clips.find((c) => c.id === e.id);
    if (live.audioSha256 !== old.audioSha256 && live.repair !== repairTag)
      throw Error('Concurrent recording change');
    const assembledFile = `${root}/assembled/${e.id}.json`;
    if (live.repair === repairTag && (await exists(assembledFile))) {
      const prepared = await json(assembledFile);
      const sameAssembly = e.job
        ? prepared.assembly.mode === 'continuous-take; no cuts' &&
          prepared.assembly.requestHash === e.job.requestHash
        : prepared.assembly.mode === joinPolicy.version &&
          JSON.stringify(prepared.assembly.policy) ===
            JSON.stringify(joinPolicy) &&
          JSON.stringify(prepared.assembly.segments) ===
            JSON.stringify(e.segments);
      if (
        sameAssembly &&
        live.sourceText === e.sourceText &&
        live.spokenText === e.spokenText &&
        live.voiceId === e.voiceId &&
        live.audioSha256 === prepared.clip.audioSha256
      ) {
        if (hash(await readFile('public/' + live.file)) !== live.audioSha256)
          throw Error('Cached output changed');
        replacements.set(e.id, live);
        continue;
      }
    }
    let pcm, assembly;
    if (e.job) {
      pcm = decode(rawPath(e) + '/speech.mp3');
      assembly = {
        mode: 'continuous-take; no cuts',
        requestHash: e.job.requestHash,
        rawSha256: hash(await verifiedRaw(rawPath(e), e.job.requestHash)),
      };
    } else {
      const parts = e.segments.map((s) => ({
        ...s,
        pcm: decode(
          `artifacts/voice/station-${e.batch}-elevenlabs-v1/raw/${s.jobId}-${s.requestHash.slice(0, 16)}/speech.mp3`,
        ),
      }));
      const joined = joinSpeech(parts);
      parts.forEach((p, i) => {
        for (let n = 0; n < p.pcm.length / 2; n++) {
          if (n >= joined.ranges[i].start && n < joined.ranges[i].end) continue;
          if (Math.abs(p.pcm.readInt16LE(n * 2)) > joinPolicy.peakLimit)
            throw Error('Audible sample removed');
        }
      });
      pcm = joined.pcm;
      assembly = {
        mode: joined.policy.version,
        policy: joined.policy,
        ranges: joined.ranges,
        joins: joined.joins,
        segments: e.segments,
      };
    }
    const requestHash = hash(JSON.stringify(assembly));
    const wav = `${root}/assembled/${e.id}.wav`;
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
      { ...options, input: pcm },
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
    const file = `audio/station/${e.speaker}/${e.id}-${requestHash.slice(0, 12)}.mp3`;
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
          'format=duration:stream=codec_name,sample_rate,channels',
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
      media.streams[0].channels !== 1 ||
      media.streams[0].sample_rate !== '24000'
    )
      throw Error('Bad output');
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
      repair: repairTag,
    };
    replacements.set(e.id, clip);
    if (live.file !== old.file && live.file !== file) superseded.push(live);
    await save(`${root}/assembled/${e.id}.json`, {
      assembly,
      clip,
      listening: 'awaiting-owner',
    });
    console.log('Prepared ' + e.id);
  }
  await save(manifestFile + '.tmp', {
    ...current,
    clips: current.clips.map((c) => replacements.get(c.id) ?? c),
  });
  await rename(manifestFile + '.tmp', manifestFile);
  execFileSync(
    process.execPath,
    ['scripts/build-cat-mouth-cues.mjs', '--station'],
    { ...options, stdio: 'inherit' },
  );
  for (const clip of superseded) {
    const from = path.resolve('public', clip.file),
      to = path.resolve(root, 'intermediate', clip.file);
    if (
      !from.startsWith(path.resolve('public/audio/station') + path.sep) ||
      !to.startsWith(path.resolve(root) + path.sep)
    )
      throw Error('Unsafe intermediate path');
    if (
      hash(await readFile(from)) !== clip.audioSha256 ||
      [...replacements.values()].some((c) => c.file === clip.file)
    )
      throw Error('Intermediate asset changed or active');
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
  }
  console.log({ installed: replacements.size });
  process.exit(0);
}
const current = await json(manifestFile),
  cues = await json(cuesFile),
  oldCues = await json(root + '/previous/cues.json');
const changed = new Set(plan.entries.map((e) => e.id));
if (current.clips.length !== previous.clips.length)
  throw Error('Manifest size changed');
for (const old of previous.clips) {
  const clip = current.clips.find((c) => c.id === old.id),
    cue = cues.clips.find((c) => c.id === old.id);
  if (
    hash(await readFile('public/' + clip.file)) !== clip.audioSha256 ||
    cue.file !== clip.file ||
    cue.audioSha256 !== clip.audioSha256 ||
    Math.abs(cue.frames.length * cues.step - clip.duration) > 0.15
  )
    throw Error('Bad audio/cues: ' + old.id);
  if (!changed.has(old.id)) {
    if (
      JSON.stringify(old) !== JSON.stringify(clip) ||
      JSON.stringify(oldCues.clips.find((c) => c.id === old.id)) !==
        JSON.stringify(cue)
    )
      throw Error('Untargeted line changed');
  } else {
    const e = plan.entries.find((e) => e.id === old.id);
    if (
      clip.sourceText !== e.sourceText ||
      clip.voiceId !== e.voiceId ||
      clip.file === old.file
    )
      throw Error('Stale repaired clip');
    if (
      hash(await readFile(root + '/previous/' + old.file)) !== old.audioSha256
    )
      throw Error('Bad archive');
  }
}
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
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Станция — исправленные записи</title><style>body{background:#152c2c;color:#eee6d3;font:17px/1.55 system-ui;margin:0}main{max-width:850px;margin:auto;padding:20px}article{padding:16px;border:1px solid #6b7967;border-radius:14px;margin:20px 0}small{overflow-wrap:anywhere}audio{display:block;width:100%;margin:12px 0}</style><main><h1>${wholeChapter ? 'Глава 2: смешанная речь' : 'Реплики 06–20'} — до и после</h1><p>Записи подключены. Требуется слуховая приёмка: произношение, ударение и естественность переходов не подтверждаются техническими тестами.</p>${plan.entries
    .map((e) => {
      const old = previous.clips.find((c) => c.id === e.id),
        clip = current.clips.find((c) => c.id === e.id);
      return `<article><small>${e.id} · ${e.speaker} · ${e.action}</small><p>${escape(e.sourceText)}</p><details><summary>Текст для синтеза</summary>${escape(e.spokenText)}</details><label>До<audio controls preload="none" src="previous/${old.file}"></audio></label><label>После<audio controls preload="none" src="../../../public/${clip.file}"></audio></label></article>`;
    })
    .join(
      '',
    )}</main><script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script></html>`,
);
const report = {
  audited: plan.audit.length,
  ...(wholeChapter
    ? { mixedLines: plan.audit.filter((e) => e.mixed).length }
    : {}),
  rerecorded: plan.entries.filter((e) => e.job).length,
  remounted: plan.entries.filter((e) => !e.job).length,
  preserved: current.clips.length - changed.size,
  listening: 'awaiting-owner',
  characters: plan.characters,
};
// Only verified, superseded assets leave public/. Archives are outside the build.
for (const old of previous.clips.filter((c) => changed.has(c.id))) {
  const from = path.resolve('public', old.file);
  const to = path.resolve(root, 'retired', old.file);
  if (
    !from.startsWith(path.resolve('public/audio/station') + path.sep) ||
    !to.startsWith(path.resolve(root) + path.sep)
  )
    throw Error('Unsafe archive path');
  if (current.clips.some((c) => path.resolve('public', c.file) === from))
    throw Error('Asset still active');
  if (await exists(from)) {
    if (hash(await readFile(from)) !== old.audioSha256)
      throw Error('Obsolete asset changed');
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
  }
}
await save(root + '/verification.json', report);
console.log(report);
