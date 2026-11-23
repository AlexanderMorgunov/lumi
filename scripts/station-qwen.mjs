// Offline authoring: exact source spans, reusable language segments, one final file per line.
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  access,
  rename,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const command = process.argv[2];
const episode = process.argv[3] ?? '01';
if (
  !['prepare', 'generate', 'assemble', 'install'].includes(command) ||
  !['01', '02', '03', '04', '05'].includes(episode) ||
  process.argv.length > 4
) {
  throw new Error(
    'Usage: node scripts/station-qwen.mjs prepare|generate|assemble|install [01|02|03|04|05]',
  );
}
const root = process.cwd();
const localRoot = 'artifacts/voice/local-qwen';
const outputRoot = `${localRoot}/station-${episode}-v1`;
const segmentRoot = `${outputRoot}/segments`;
const lineRoot = `${outputRoot}/lines`;
const model = 'Qwen/Qwen3-TTS-12Hz-1.7B-Base';
const revision = 'fd4b254389122332181a7c3db7f27e918eec64e3';
const modelRoot = `${localRoot}/models/Qwen3-TTS-12Hz-1.7B-Base`;
const cli = `${localRoot}/runtime/v0.9.5-portable/audiocpp_cli.exe`;
const ffOptions = {
  windowsHide: true,
  timeout: 120000,
  maxBuffer: 4 * 1024 * 1024,
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = async (file) =>
  JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const save = async (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2) + '\n');
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
};
const profiles = {};
for (const speaker of ['marta', 'tik']) {
  const profile = await json(`docs/voice/${speaker}-voice-profile.json`);
  if (
    profile.character !== speaker ||
    profile.status !== 'owner-selected-reference'
  )
    throw new Error('Unapproved voice profile.');
  const reference = path.resolve('docs/voice', profile.referenceAudio);
  if (
    !reference.startsWith(path.resolve('docs/voice/references') + path.sep) ||
    hash(await readFile(reference)) !== profile.referenceAudioSha256
  )
    throw new Error('Reference integrity failed.');
  profiles[speaker] = { ...profile, reference };
}
const source = await json(`docs/voice/station-${episode}-script.json`);
if (
  !Array.isArray(source.lines) ||
  source.lines.length !== (episode === '04' ? 17 : 14)
)
  throw new Error('Unexpected reviewed station script length.');
const jobs = new Map();
const lines = source.lines.map((line) => {
  if (
    !/^[a-z0-9-]+$/.test(line.id) ||
    !line.id.startsWith(`chapter-02-${episode}-`) ||
    !profiles[line.speaker] ||
    typeof line.sourceText !== 'string'
  )
    throw new Error('Invalid line.');
  const profile = profiles[line.speaker];
  // Retain every original character for review; spoken punctuation may be simplified.
  const rawSpans = line.sourceText.split(/([A-Za-z]+(?:[ \t]+[A-Za-z]+)*)/g);
  const segments = rawSpans.filter(Boolean).map((rawText) => {
    const language = /[A-Za-z]/.test(rawText) ? 'English' : 'Russian';
    const text = rawText.replace(/^[\s«»—–,;:.!?]+|[\s«»—–,;:]+$/g, '').trim();
    if (!/[A-Za-zА-Яа-яЁё]/.test(text)) return { rawText, jobId: null };
    const spoken = language === 'English' ? text + '.' : text;
    const conditioning =
      profile.cloneConditioningByLanguage?.[language] ?? 'icl';
    if (!['icl', 'speaker'].includes(conditioning))
      throw new Error('Invalid conditioning.');
    const request = {
      speaker: line.speaker,
      voiceId: profile.voiceProfileId,
      referenceAudioSha256: profile.referenceAudioSha256,
      referenceText: profile.referenceText,
      model,
      revision,
      runtime: 'audio.cpp v0.9.5 portable (61c7838b)',
      text: spoken,
      language,
      conditioning,
      seed: 42,
      maxTokens: 384,
      talkerWeights: 'q8_0',
      kvCache: 'f16',
    };
    const requestHash = hash(JSON.stringify(request));
    const jobId = `${line.speaker}-${language === 'English' ? 'en' : 'ru'}-${requestHash.slice(0, 16)}`;
    jobs.set(jobId, { id: jobId, requestHash, ...request });
    return { rawText, language, spokenText: spoken, jobId };
  });
  if (segments.map((part) => part.rawText).join('') !== line.sourceText)
    throw new Error('Source text lost during segmentation.');
  return {
    id: line.id,
    speaker: line.speaker,
    voiceId: profile.voiceProfileId,
    sourceText: line.sourceText,
    segments,
  };
});
if (new Set(lines.map((line) => line.id)).size !== lines.length)
  throw new Error('Duplicate dialogue ids.');
const plan = {
  schemaVersion: 1,
  model,
  revision,
  review: 'voices-selected-lines-await-listening',
  lines,
  jobs: [...jobs.values()],
};
await mkdir(segmentRoot, { recursive: true });
await mkdir(lineRoot, { recursive: true });
await save(`docs/voice/station-${episode}-qwen-plan.json`, plan);
console.log(
  `${lines.length} dialogue lines, ${jobs.size} unique segments (${[...jobs.values()].filter((j) => j.language === 'English').length} English).`,
);
if (command === 'prepare') process.exit(0);

async function probe(file) {
  const { stdout } = await run(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_name,sample_rate,channels',
      '-of',
      'json',
      file,
    ],
    ffOptions,
  );
  const result = JSON.parse(stdout);
  const duration = Number(result.format?.duration);
  if (
    !Number.isFinite(duration) ||
    duration < 0.08 ||
    duration > 120 ||
    !result.streams?.length
  )
    throw new Error(`Invalid audio: ${file}`);
  return { duration, streams: result.streams };
}
async function checkedSegment(job) {
  const receiptPath = `${segmentRoot}/${job.id}.json`;
  if (!(await exists(receiptPath))) {
    let shared;
    for (const previous of ['01', '02', '03', '04']) {
      if (previous >= episode) break;
      const candidate = `${localRoot}/station-${previous}-v1/segments/${job.id}`;
      if (await exists(`${candidate}.json`)) {
        shared = candidate;
        break;
      }
    }
    if (!shared) return null;
    const cached = await json(`${shared}.json`);
    if (
      cached.requestHash !== job.requestHash ||
      hash(await readFile(`${shared}.wav`)) !== cached.audioSha256
    )
      throw new Error(`Changed shared segment: ${job.id}`);
    await copyFile(`${shared}.wav`, `${segmentRoot}/${job.id}.wav`);
    await copyFile(`${shared}.json`, receiptPath);
    console.log(`Reused matching segment: ${job.id}`);
  }
  const receipt = await json(receiptPath);
  if (
    receipt.requestHash !== job.requestHash ||
    hash(await readFile(`${segmentRoot}/${job.id}.wav`)) !== receipt.audioSha256
  )
    throw new Error(`Changed segment: ${job.id}`);
  return receipt;
}

if (command === 'generate') {
  const installed = await json(`${modelRoot}/download-manifest.json`);
  if (installed.id !== model || installed.sha !== revision)
    throw new Error('Unexpected model revision.');
  // Russian first, then English; only one GPU session at a time.
  for (const language of ['Russian', 'English'])
    for (const speaker of ['marta', 'tik']) {
      const profile = profiles[speaker];
      const selected = [...jobs.values()].filter(
        (job) => job.speaker === speaker && job.language === language,
      );
      const pending = [];
      for (const job of selected) {
        if (await checkedSegment(job)) continue;
        if (await exists(`${segmentRoot}/${job.id}.wav`))
          throw new Error(`Unreceipted segment needs inspection: ${job.id}`);
        pending.push(job);
      }
      if (!pending.length) continue;
      const conditioning = pending[0].conditioning;
      if (pending.some((job) => job.conditioning !== conditioning))
        throw new Error('Mixed conditioning in session.');
      const groupHash = hash(
        JSON.stringify(pending.map((job) => job.requestHash)),
      ).slice(0, 12);
      const groupRoot = `${outputRoot}/${speaker}-${language}-${groupHash}-${Date.now()}`;
      await mkdir(groupRoot);
      const sequence = `${groupRoot}/requests.json`;
      await save(sequence, {
        requests: pending.map((job) => ({
          id: job.id,
          text: job.text,
          language: job.language,
          seed: job.seed,
          max_tokens: job.maxTokens,
          voice_ref: profile.reference,
          ...(conditioning === 'speaker'
            ? { options: { x_vector_only_mode: true } }
            : { reference_text: profile.referenceText }),
        })),
      });
      const args = [
        '--task',
        'clon',
        '--family',
        'qwen3_tts',
        '--model',
        path.resolve(modelRoot),
        '--backend',
        'vulkan',
        '--threads',
        '6',
        '--session-option',
        'qwen3_tts.talker_weight_type=q8_0',
        '--session-option',
        'qwen3_tts.kv_cache_type=f16',
        '--request-sequence',
        path.resolve(sequence),
        '--out-dir',
        path.resolve(segmentRoot),
        '--metrics',
        '--log-file',
        path.resolve(`${groupRoot}/engine.log`),
      ];
      await save(`${groupRoot}/invocation.json`, { args, jobs: pending });
      console.log(
        `Generating ${pending.length} ${speaker}/${language}/${conditioning} segments.`,
      );
      let processLog = '';
      try {
        await new Promise((resolve, reject) => {
          const child = spawn(path.resolve(cli), args, {
            cwd: root,
            windowsHide: true,
            timeout: 30 * 60 * 1000,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          child.stdout.on('data', (data) => {
            processLog += data;
            process.stdout.write(data);
          });
          child.stderr.on('data', (data) => {
            processLog += data;
            process.stderr.write(data);
          });
          child.once('error', reject);
          child.once('close', (code, signal) =>
            code === 0
              ? resolve()
              : reject(new Error(`Synthesis failed: ${code ?? signal}`)),
          );
        });
        for (const job of pending) {
          const file = `${segmentRoot}/${job.id}.wav`;
          const media = await probe(file);
          if (
            media.duration >= 30.5 ||
            media.streams[0].codec_name !== 'pcm_s16le'
          )
            throw new Error(`Possible truncated or invalid segment: ${job.id}`);
          await save(`${segmentRoot}/${job.id}.json`, {
            ...job,
            ...media,
            audioSha256: hash(await readFile(file)),
            group: groupRoot,
            reviewed: false,
          });
        }
      } finally {
        await writeFile(`${groupRoot}/process.log`, processLog);
      }
    }
  console.log('All requested segments generated. No game assets installed.');
  process.exit(0);
}

const assembled = [];
for (const line of lines) {
  const spoken = line.segments.filter((part) => part.jobId);
  const receipts = [];
  for (const part of spoken) {
    const receipt = await checkedSegment(jobs.get(part.jobId));
    if (!receipt) throw new Error(`Missing segment: ${part.jobId}`);
    receipts.push(receipt);
  }
  const requestHash = hash(
    JSON.stringify({
      sourceText: line.sourceText,
      voiceId: line.voiceId,
      hashes: receipts.map((r) => r.audioSha256),
      assembly: 'trim-48db-pad60ms-gap100ms-target-minus22-v1',
    }),
  );
  const stem = `${line.id}-${requestHash.slice(0, 12)}`;
  const mp3 = `${lineRoot}/${stem}.mp3`;
  const receiptPath = `${lineRoot}/${stem}.json`;
  if (!(await exists(receiptPath))) {
    if (await exists(mp3)) throw new Error(`Unreceipted final clip: ${stem}`);
    // Decode/trim to common PCM, then insert a short gap without crossfading syllables.
    const pcm = [];
    for (let index = 0; index < receipts.length; index++) {
      const file = `${segmentRoot}/${spoken[index].jobId}.wav`;
      const decoded = await run(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-i',
          file,
          '-af',
          'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB:start_silence=0.06,areverse',
          '-ar',
          '24000',
          '-ac',
          '1',
          '-f',
          's16le',
          'pipe:1',
        ],
        { ...ffOptions, encoding: 'buffer' },
      );
      if (decoded.stdout.length < 2400)
        throw new Error('Empty or almost silent segment.');
      if (index) pcm.push(Buffer.alloc(4800));
      pcm.push(decoded.stdout);
    }
    const pcmPath = `${lineRoot}/${stem}.pcm`;
    await writeFile(pcmPath, Buffer.concat(pcm));
    const inputArgs = [
      '-f',
      's16le',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-i',
      pcmPath,
    ];
    const measured = await run(
      'ffmpeg',
      [
        '-hide_banner',
        '-nostdin',
        ...inputArgs,
        '-af',
        'loudnorm=I=-22:TP=-2:LRA=7:print_format=json',
        '-f',
        'null',
        '-',
      ],
      ffOptions,
    );
    const level = JSON.parse(
      measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? '{}',
    );
    const gain = Math.min(
      -22 - Number(level.input_i),
      -2 - Number(level.input_tp),
    );
    if (!Number.isFinite(gain)) throw new Error('Invalid final loudness.');
    await run(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-n',
        ...inputArgs,
        '-af',
        `volume=${gain.toFixed(3)}dB`,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '96k',
        mp3,
      ],
      ffOptions,
    );
    const media = await probe(mp3);
    await save(receiptPath, {
      id: line.id,
      requestHash,
      sourceText: line.sourceText,
      voiceId: line.voiceId,
      file: mp3,
      audioSha256: hash(await readFile(mp3)),
      ...media,
      gainDb: gain,
      segments: receipts,
      reviewed: false,
    });
  }
  const receipt = await json(receiptPath);
  if (
    receipt.requestHash !== requestHash ||
    hash(await readFile(mp3)) !== receipt.audioSha256
  )
    throw new Error('Final audio changed.');
  assembled.push({
    ...line,
    ...receipt,
    speaker: line.speaker,
    spokenText: spoken.map((part) => part.spokenText).join(' '),
    artifactFile: mp3,
  });
}
await save(`${outputRoot}/manifest.json`, {
  model,
  revision,
  review: 'generated-awaiting-listening',
  clips: assembled,
});
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ],
  );
const cards = assembled
  .map(
    (clip, index) =>
      `<article><p class="label">${index + 1} · ${clip.speaker === 'marta' ? 'Марта' : 'Тик'} · ${clip.duration.toFixed(1)} с</p><p>${escapeHtml(clip.sourceText)}</p><audio controls preload="none" aria-label="${clip.speaker === 'marta' ? 'Марта' : 'Тик'}, реплика ${index + 1}" src="lines/${escapeHtml(path.basename(clip.artifactFile))}"></audio></article>`,
  )
  .join('\n');
await writeFile(
  `${outputRoot}/listen.html`,
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Станция встреч — озвучка</title><style>body{margin:0;background:#182329;color:#efe8d6;font:18px/1.6 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:32px 20px 64px}h1{font-size:30px;line-height:1.2}.intro{color:#b9c8c7}article{padding:20px 24px;margin:18px 0;border:1px solid #455754;border-radius:16px;background:#233239}.label{color:#f1c784;font-size:14px;margin:0}audio{width:100%;margin-top:6px}a{color:#f1c784}@media(max-width:480px){article{padding:16px}main{padding:20px 12px}}</style><main><h1>Станция встреч</h1><p class="intro">Эпизод ${Number(episode)} · ${assembled.length} реплик · Марта и Тик</p><p>Голоса выбраны. Новые реплики собраны для прослушивания: проверьте произношение, паузы и переходы между русским и английским.</p>${cards}</main><script>const players=[...document.querySelectorAll('audio')];for(const player of players)player.addEventListener('play',()=>{for(const other of players)if(other!==player)other.pause()});</script></html>`,
);
if (command === 'assemble') {
  console.log(`Prepared ${assembled.length} complete MP3 dialogue clips.`);
  process.exit(0);
}

const prior = await json('src/game/station-voice-manifest.json');
if (!Array.isArray(prior.clips))
  throw new Error('Invalid existing station manifest.');
const clips = prior.clips.filter(
  (clip) => !clip.id.startsWith(`chapter-02-${episode}-`),
);
for (const clip of assembled) {
  const file = `audio/station/${clip.speaker}/${path.basename(clip.artifactFile)}`;
  await mkdir(path.dirname('public/' + file), { recursive: true });
  await copyFile(clip.artifactFile, 'public/' + file);
  clips.push({
    id: clip.id,
    speaker: clip.speaker,
    voiceId: clip.voiceId,
    sourceText: clip.sourceText,
    spokenText: clip.spokenText,
    file,
    requestHash: clip.requestHash,
    audioSha256: clip.audioSha256,
    duration: clip.duration,
  });
}
for (const { word, speaker } of episode === '02'
  ? [{ word: 'lantern', speaker: 'marta' }]
  : episode === '03'
    ? ['you', 'are'].map((word) => ({ word, speaker: 'marta' }))
    : episode === '04'
      ? [
          { word: 'he', speaker: 'marta' },
          { word: 'she', speaker: 'tik' },
          { word: 'is', speaker: 'tik' },
        ]
      : episode === '05'
        ? [{ word: 'it', speaker: 'tik' }]
        : []) {
  const wordJob = [...jobs.values()].find(
    (job) =>
      job.speaker === speaker &&
      job.language === 'English' &&
      job.text.toLowerCase() === `${word}.`,
  );
  if (!wordJob)
    throw new Error(`Missing reviewed ${word} pronunciation segment.`);
  const wordReceipt = await checkedSegment(wordJob);
  const file = `audio/en-US/qwen-${speaker}-v1/${word}.mp3`;
  const receiptPath = `docs/voice/${word}-pronunciation.json`;
  if (await exists('public/' + file)) {
    const previous = await json(receiptPath);
    if (
      previous.requestHash !== wordJob.requestHash ||
      previous.audioSha256 !== hash(await readFile('public/' + file))
    )
      throw new Error('Pronunciation changed: create a new asset version.');
  } else {
    const input = `${segmentRoot}/${wordJob.id}.wav`;
    const measured = await run(
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
      ffOptions,
    );
    const level = JSON.parse(
      measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? '{}',
    );
    const gain = Math.min(
      -22 - Number(level.input_i),
      -2 - Number(level.input_tp),
    );
    if (!Number.isFinite(gain)) throw new Error('Invalid pronunciation level.');
    await mkdir(path.dirname('public/' + file), { recursive: true });
    await run(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-n',
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
        'public/' + file,
      ],
      ffOptions,
    );
    await save(receiptPath, {
      term: word,
      file,
      provider: 'local-qwen',
      model,
      revision,
      voiceId: wordJob.voiceId,
      requestHash: wordJob.requestHash,
      sourceAudioSha256: wordReceipt.audioSha256,
      audioSha256: hash(await readFile('public/' + file)),
      gainDb: gain,
      ...(await probe('public/' + file)),
      review: 'generated-awaiting-listening',
    });
  }
}
await save('src/game/station-voice-manifest.json.tmp', {
  provider: 'local-qwen',
  modelId: model,
  modelRevision: revision,
  review: 'character-references-approved; episode-recordings-await-listening',
  clips,
});
await rename(
  'src/game/station-voice-manifest.json.tmp',
  'src/game/station-voice-manifest.json',
);
await run(process.execPath, ['scripts/build-cat-mouth-cues.mjs', '--station'], {
  ...ffOptions,
  timeout: 120000,
});
console.log(
  `Installed ${clips.length} dialogue recordings and amplitude mouth cues.`,
);
