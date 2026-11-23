// Targeted, offline-authored repairs. Default is a network-free plan.
import { readFile, writeFile, mkdir, copyFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { validateTailCut } from './voice-tail-cut.mjs';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';

const command = process.argv[2] ?? 'prepare';
const lumiOnly = process.argv[3] === 'lumi';
const tikOnly = process.argv[3] === 'tik-i';
const feedbackOnly = process.argv[3] === 'tik-feedback';
const articleOnly = process.argv[3] === 'marta-a';
const standalone = process.argv[3] === 'standalone';
const smooth = process.argv[3] === 'smooth';
const wholeArticle = process.argv[3] === 'marta-a-whole';
const remainingI = process.argv[3] === 'remaining-i';
if (
  !['prepare', 'generate', 'install'].includes(command) ||
  process.argv.length > 4 ||
  (process.argv[3] &&
    !lumiOnly &&
    !tikOnly &&
    !feedbackOnly &&
    !articleOnly &&
    !standalone &&
    !smooth &&
    !wholeArticle &&
    !remainingI)
)
  throw new Error(
    'Usage: node scripts/repair-station-voice.mjs prepare|generate|install [lumi|tik-i|tik-feedback|marta-a|standalone|smooth|marta-a-whole|remaining-i]',
  );
const root = lumiOnly
  ? 'artifacts/voice/lumi-garry-v1'
  : 'artifacts/voice/station-repairs-2026-11-19';
const batch = process.argv[3] ?? 'repairs';
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
if (command !== 'prepare') {
  const current = await json('src/game/station-voice-manifest.json');
  if (current.clips.some((clip) => clip.repair === 'chapter-02-bilingual-v1'))
    throw new Error(
      'Archived fragment repair: preserve the chapter-wide continuous takes. Use chapter-bilingual-voice.mjs and install chapter; author a new continuous plan for changed lines.',
    );
}
const save = (file, data) =>
  writeFile(file, JSON.stringify(data, null, 2) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const cast = await json('docs/voice/station-elevenlabs-cast.json');
const script = await json('docs/voice/station-01-script.json');
const tik = script.lines.find((l) => l.id === 'chapter-02-01-task-02');
const marta = script.lines.find((l) => l.id === 'chapter-02-01-marta-task-01');
const russian = tik.sourceText.split('I');
if (russian.length !== 3 || russian[0] !== '' || !russian[1].startsWith(' — '))
  throw new Error('Source changed; review the I segmentation');
let recipes = [
  {
    ...tik,
    segments: [
      {
        id: 'tik-i-context-en',
        rawText: 'I',
        text: 'I am Lumi.',
        languageCode: 'en',
        extractPrefix: 'I',
        gapMs: 140,
      },
      {
        id: 'tik-i-rule-ru',
        rawText: russian[1],
        text: russian[1].replace(/^ — /, ''),
        languageCode: 'ru',
        gapMs: 240,
      },
      {
        id: 'tik-i-context-en',
        rawText: 'I',
        text: 'I am Lumi.',
        languageCode: 'en',
        extractPrefix: 'I',
        gapMs: 100,
      },
      {
        id: 'tik-i-capital-ru',
        rawText: russian[2],
        text: russian[2].trim(),
        languageCode: 'ru',
        gapMs: 0,
      },
    ],
  },
  {
    ...marta,
    segments: [
      {
        id: 'marta-intro-short',
        rawText: marta.sourceText,
        text: marta.sourceText,
        languageCode: 'ru',
        gapMs: 0,
      },
    ],
  },
];
if (tikOnly) recipes = [recipes[0]];
if (articleOnly) {
  const chapter = await json('docs/voice/station-02-script.json');
  const line = chapter.lines.find((l) => l.id === 'chapter-02-02-task-03');
  if (
    !line ||
    line.sourceText !==
      'Lantern можно посчитать: один фонарь, два фонаря. Когда говорим, что ты один из фонарей, перед этим словом нужен неопределённый артикль. Здесь a: lantern начинается с согласного звука.'
  )
    throw new Error('Article line changed; review segmentation');
  recipes = [
    {
      ...line,
      segments: [
        {
          id: 'marta-lantern-en',
          rawText: 'Lantern',
          text: 'Lantern.',
          languageCode: 'en',
          gapMs: 80,
        },
        {
          id: 'marta-a-rule-ru',
          rawText:
            ' можно посчитать: один фонарь, два фонаря. Когда говорим, что ты один из фонарей, перед этим словом нужен неопределённый артикль. Здесь ',
          text: 'можно посчитать: один фонарь, два фонаря. Когда говорим, что ты один из фонарей, перед этим словом нужен неопределённый артикль. Здесь',
          languageCode: 'ru',
          gapMs: 80,
        },
        {
          id: 'marta-a-context-en',
          rawText: 'a',
          text: 'a lantern.',
          languageCode: 'en',
          extractPrefix: 'a',
          gapMs: 160,
        },
        {
          id: 'marta-lantern-en',
          rawText: ': lantern',
          text: 'Lantern.',
          languageCode: 'en',
          gapMs: 80,
        },
        {
          id: 'marta-a-sound-ru',
          rawText: ' начинается с согласного звука.',
          text: 'начинается с согласного звука.',
          languageCode: 'ru',
          gapMs: 0,
        },
      ],
    },
  ];
}
if (feedbackOnly) {
  const line = script.lines.find(
    (l) => l.id === 'chapter-02-01-marta-feedback-speaker-marta',
  );
  if (
    !line ||
    line.sourceText !==
      'Верно. I указывает на автора сообщения. В I am Marta говорит Марта, хотя таблички двигает Люми. Первый эпизод станции завершён; остальные встречи ещё впереди.'
  )
    throw new Error('Feedback changed; review segmentation');
  recipes = [
    {
      ...line,
      segments: [
        {
          id: 'tik-feedback-yes-ru',
          rawText: 'Верно. ',
          text: 'Верно.',
          languageCode: 'ru',
          gapMs: 120,
        },
        { ...recipes[0].segments[0], gapMs: 80 },
        {
          id: 'tik-feedback-author-ru',
          rawText: ' указывает на автора сообщения. В ',
          text: 'указывает на автора сообщения. В',
          languageCode: 'ru',
          gapMs: 100,
        },
        {
          id: 'tik-feedback-marta-en',
          rawText: 'I am Marta',
          text: 'I am Marta.',
          languageCode: 'en',
          gapMs: 100,
        },
        {
          id: 'tik-feedback-finish-ru',
          rawText:
            ' говорит Марта, хотя таблички двигает Люми. Первый эпизод станции завершён; остальные встречи ещё впереди.',
          text: 'говорит Марта, хотя таблички двигает Люми. Первый эпизод станции завершён; остальные встречи ещё впереди.',
          languageCode: 'ru',
          gapMs: 0,
        },
      ],
    },
  ];
}
if (lumiOnly) {
  const lumi = script.lines.find(
    (l) => l.id === 'chapter-02-01-success-01' && l.speaker === 'lumi',
  );
  if (
    !lumi ||
    lumi.sourceText !==
      'I am Lumi. Я Люми. Это моё имя — его и запишем на бирке!'
  )
    throw new Error('Lumi text changed; review before synthesis');
  recipes = [
    {
      ...lumi,
      segments: [
        {
          id: 'lumi-garry-en',
          rawText: 'I am Lumi. ',
          text: 'I am Lumi.',
          languageCode: 'en',
          gapMs: 180,
        },
        {
          id: 'lumi-garry-ru',
          rawText: 'Я Люми. Это моё имя — его и запишем на бирке!',
          text: 'Я Люми. Это моё имя — его и запишем на бирке!',
          languageCode: 'ru',
          gapMs: 0,
        },
      ],
    },
  ];
}
if (
  marta.sourceText !==
  'Я Марта, мастер фонарей. Помоги мне подписать мою бирку.'
)
  throw new Error('Marta text changed; review repair');
const jobs = new Map();
if (standalone) {
  const sources = (
    await Promise.all(
      ['01', '02', '03', '04', '05'].map((n) =>
        json(`docs/voice/station-${n}-script.json`),
      ),
    )
  ).flatMap((s) => s.lines);
  const alreadyRepaired = new Set([
    'chapter-02-01-task-02',
    'chapter-02-01-marta-feedback-speaker-marta',
    'chapter-02-02-task-03',
  ]);
  const registry = await json('docs/voice/station-elevenlabs-patches.json');
  const priorRequests = registry.patches.flatMap((p) => p.assembly.requests);
  recipes = sources
    .filter(
      (line) =>
        !alreadyRepaired.has(line.id) &&
        [...line.sourceText.matchAll(/[A-Za-z]+(?:[ \t]+[A-Za-z]+)*/g)].some(
          (m) => ['I', 'a'].includes(m[0]),
        ),
    )
    .map((line) => {
      const segments = [];
      let cursor = 0,
        pending = '';
      function add(rawText, text, languageCode, extractPrefix) {
        if (!/[A-Za-zА-Яа-яЁё]/.test(rawText)) {
          if (segments.length) segments[segments.length - 1].rawText += rawText;
          else pending += rawText;
          return;
        }
        const reuse = priorRequests.find(
          (r) =>
            r.voiceId === cast.voices[line.speaker].voiceId &&
            r.text === text &&
            r.languageCode === languageCode &&
            Boolean(r.withTimestamps) === Boolean(extractPrefix),
        );
        const id = reuse
          ? reuse.id.replace(/^station-repair-/, '').replace(/-01$/, '')
          : 'shared-' +
            hash(
              JSON.stringify({
                speaker: line.speaker,
                text,
                languageCode,
                extractPrefix,
              }),
            ).slice(0, 16);
        segments.push({
          id,
          rawText: pending + rawText,
          text,
          languageCode,
          ...(extractPrefix ? { extractPrefix } : {}),
          gapMs: 100,
        });
        pending = '';
      }
      for (const match of line.sourceText.matchAll(
        /[A-Za-z]+(?:[ \t]+[A-Za-z]+)*[.,!?;:]?/g,
      )) {
        const before = line.sourceText.slice(cursor, match.index);
        add(before, before.trim().replace(/^—\s*/, ''), 'ru');
        const word = match[0].replace(/[.,!?;:]$/, '');
        const prefix = ['I', 'a'].includes(word) ? word : undefined;
        add(
          match[0],
          prefix === 'I'
            ? 'I am Lumi.'
            : prefix === 'a'
              ? 'a lantern.'
              : word + '.',
          'en',
          prefix,
        );
        cursor = match.index + match[0].length;
      }
      const after = line.sourceText.slice(cursor);
      add(after, after.trim(), 'ru');
      segments[segments.length - 1].gapMs = 0;
      return { ...line, segments };
    });
  if (recipes.length !== 11)
    throw new Error('Standalone repair scope changed; review batch');
}
if (smooth || wholeArticle) {
  const registry = await json('docs/voice/station-elevenlabs-patches.json');
  const ids = [
    'chapter-02-01-task-02',
    'chapter-02-01-task-04',
    'chapter-02-01-marta-task-02',
    'chapter-02-02-task-03',
    'chapter-02-02-tik-success-02',
  ];
  // Freeze the previous recipes: repeated preparation must not use our own output.
  const snapshot = root + '/smooth-source-recipes.json';
  try {
    await writeFile(
      snapshot,
      JSON.stringify(
        registry.patches.filter((p) => ids.includes(p.clip.id)),
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const sources = await json(snapshot);
  if (sources.length !== ids.length)
    throw new Error('Missing smooth repair source');
  recipes = sources.map((patch) => {
    const recipe = {
      ...patch.clip,
      segments: structuredClone(patch.assembly.segments),
    };
    for (const segment of recipe.segments) {
      delete segment.extraction;
      if (segment.extractPrefix === 'I') {
        segment.id = recipe.speaker + '-i-tail-en-v2';
        segment.text = 'The English pronoun is... I.';
        delete segment.extractPrefix;
        segment.extractSuffix = 'I';
      }
    }
    if (recipe.id === 'chapter-02-02-task-03') {
      const article = recipe.segments[2],
        noun = recipe.segments[3];
      if (article.extractPrefix !== 'a' || noun.text !== 'Lantern.')
        throw new Error('Article recipe changed');
      article.rawText += noun.rawText;
      article.gapMs = noun.gapMs;
      article.withTimestamps = true; // Reuse the verified full take, without cropping.
      delete article.extractPrefix;
      recipe.segments.splice(3, 1);
    }
    if (recipe.id === 'chapter-02-02-tik-success-02') {
      recipe.segments.splice(8, 7, {
        id: 'tik-question-continuous-v2',
        rawText: recipe.segments
          .slice(8)
          .map((s) => s.rawText)
          .join(''),
        text: 'Почему перед lantern и robot нужен неопределённый артикль, а перед нашими именами его нет?',
        gapMs: 0,
      });
      recipe.spokenText = recipe.sourceText.replace(
        'нужен a,',
        'нужен неопределённый артикль,',
      );
    }
    return recipe;
  });
  if (wholeArticle)
    recipes = recipes.filter((r) => r.id === 'chapter-02-02-task-03');
}
if (remainingI) {
  const ids = [
    'chapter-02-01-marta-feedback-speaker-marta',
    'chapter-02-01-marta-success-02',
    'chapter-02-01-marta-feedback-speaker-lumi',
    'chapter-02-01-marta-feedback-speaker-listener',
    'chapter-02-02-tik-task-02',
    'chapter-02-03-tik-feedback-address-lumi',
    'chapter-02-04-transfer-feedback-third-speaker',
  ];
  const registry = await json('docs/voice/station-elevenlabs-patches.json');
  const snapshot = root + '/remaining-i-source-recipes.json';
  try {
    await writeFile(
      snapshot,
      JSON.stringify(
        registry.patches.filter((p) => ids.includes(p.clip.id)),
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const sources = await json(snapshot);
  if (sources.length !== ids.length)
    throw new Error('Missing remaining I source');
  recipes = sources.map((patch) => {
    const recipe = {
      ...patch.clip,
      segments: structuredClone(patch.assembly.segments),
    };
    if (!recipe.segments.some((s) => s.extractPrefix === 'I'))
      throw new Error('Unexpected remaining I scope');
    for (const segment of recipe.segments) {
      if (segment.extractPrefix === 'I') {
        segment.id = recipe.speaker + '-i-tail-en-v2';
        segment.text = 'The English pronoun is... I.';
        delete segment.extractPrefix;
        delete segment.extraction;
        segment.extractSuffix = 'I';
      }
      if (
        recipe.id === 'chapter-02-01-marta-feedback-speaker-marta' &&
        segment.id === 'tik-feedback-author-ru'
      ) {
        segment.id = 'tik-feedback-author-phrase-ru-v2';
        segment.text = 'указывает на автора сообщения. В предложении';
        recipe.spokenText = recipe.sourceText.replace(
          'В I am Marta',
          'В предложении I am Marta',
        );
      }
    }
    return recipe;
  });
}
for (const recipe of recipes) {
  if (recipe.segments.map((s) => s.rawText).join('') !== recipe.sourceText)
    throw new Error('Lossy source segmentation');
  for (const segment of recipe.segments) {
    const job = prepareJob({
      kind: 'speech',
      id: `station-repair-${segment.id}-01`,
      modelId: 'eleven_v3',
      voiceId: cast.voices[recipe.speaker].voiceId,
      seed: 42,
      text: segment.text,
      ...(segment.languageCode ? { languageCode: segment.languageCode } : {}),
      ...(segment.extractPrefix ||
      segment.extractSuffix ||
      segment.withTimestamps
        ? { withTimestamps: true }
        : {}),
    });
    segment.requestHash = job.requestHash;
    jobs.set(job.requestHash, job);
  }
}
const characters = [...jobs.values()].reduce(
  (n, j) => n + j.request.text.length,
  0,
);
const characterLimit = standalone || smooth || remainingI ? 2500 : 300;
if (characters > characterLimit) throw new Error('Repair scope exceeded');
await mkdir(root, { recursive: true });
await save(root + '/' + batch + '-plan.json', {
  recipes,
  jobs: [...jobs.values()].map((j) => j.request),
  characters,
});
console.log(
  JSON.stringify({
    command,
    lines: recipes.length,
    requests: jobs.size,
    characters,
  }),
);
if (command === 'prepare') process.exit(0);
if (command === 'generate') {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('Missing API key');
  const get = async (endpoint) => {
    const r = await fetch('https://api.elevenlabs.io' + endpoint, {
      headers: { 'xi-api-key': key },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error('Preflight HTTP ' + r.status);
    return r.json();
  };
  const subscription = await get('/v1/user/subscription');
  const model = (await get('/v1/models')).find(
    (m) => m.model_id === 'eleven_v3',
  );
  const rate =
    model?.model_rates?.character_cost_multiplier *
    model?.model_rates?.cost_discount_multiplier;
  const estimate = Math.ceil(characters * rate);
  if (!(
    rate > 0 &&
    estimate <= characterLimit &&
    subscription.character_limit - subscription.character_count >= estimate
  ))
    throw new Error('Cannot confirm included budget');
  const before = subscription.character_count;
  await save(root + '/' + batch + '-usage.json', { before, estimate });
  for (const job of jobs.values()) {
    const result = await generate(job, root + '/raw', key);
    console.log(
      job.request.id + ': ' + (result.cached ? 'cached' : 'generated'),
    );
  }
  const after = (await get('/v1/user/subscription')).character_count;
  await save(root + '/' + batch + '-usage.json', {
    before,
    after,
    estimate,
    observedDifference: after - before,
  });
  process.exit(0);
}
const options = {
  windowsHide: true,
  maxBuffer: 16 * 1024 * 1024,
  timeout: 120000,
};
const ff = (args, extra = {}) =>
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args],
    { ...options, ...extra },
  );
const inputs = new Map();
const alignments = new Map();
for (const job of jobs.values()) {
  const directory = `${root}/raw/${job.request.id}-${job.requestHash.slice(0, 16)}`;
  const receipt = await json(directory + '/receipt.json');
  const file = directory + '/speech.mp3';
  if (
    receipt.status !== 'complete' ||
    receipt.requestHash !== job.requestHash ||
    receipt.files[0].sha256 !== hash(await readFile(file))
  )
    throw new Error('Unverified take ' + job.request.id);
  inputs.set(job.requestHash, file);
  if (job.request.withTimestamps) {
    const bytes = await readFile(directory + '/alignment.json');
    if (hash(bytes) !== receipt.alignment?.sha256)
      throw new Error('Alignment changed: ' + job.request.id);
    alignments.set(job.requestHash, {
      data: JSON.parse(bytes),
      sha256: hash(bytes),
    });
  }
}
// Validate every suffix before any live asset or manifest is changed.
const suffixes = recipes
  .flatMap((r) => r.segments)
  .filter((s) => s.extractSuffix);
if (suffixes.length) {
  const cuts = await json('docs/voice/station-smooth-cuts.json');
  for (const segment of suffixes) {
    const source = inputs.get(segment.requestHash);
    const alignment = alignments.get(segment.requestHash);
    const pcm = ff([
      '-i',
      source,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-f',
      's16le',
      'pipe:1',
    ]);
    segment.extraction = validateTailCut({
      cut: cuts.cuts.find((c) => c.requestHash === segment.requestHash),
      requestHash: segment.requestHash,
      audioSha256: hash(await readFile(source)),
      alignmentSha256: alignment?.sha256,
      alignment: alignment?.data,
      text: segment.text,
      pcm,
    });
  }
}
const manifest = await json('src/game/station-voice-manifest.json');
await mkdir(root + '/previous', { recursive: true });
for (const name of ['station-voice-manifest.json', 'station-mouth-cues.json']) {
  try {
    await copyFile('src/game/' + name, root + '/previous/' + name, 1);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
const patches = [];
const replacedClips = [];
for (const recipe of recipes) {
  for (const segment of recipe.segments) {
    if (!segment.extractPrefix) continue;
    const alignment = alignments.get(segment.requestHash);
    const data = alignment?.data;
    if (
      !data ||
      data.characters.join('') !== segment.text ||
      !segment.text.startsWith(segment.extractPrefix + ' ')
    )
      throw new Error('Context alignment does not match source');
    const start = data.character_start_times_seconds[0];
    const end =
      data.character_end_times_seconds[segment.extractPrefix.length - 1];
    const nextStart =
      data.character_start_times_seconds[segment.extractPrefix.length + 1];
    if (!(
      start >= 0 &&
      end - start >= (segment.extractPrefix === 'a' ? 0.03 : 0.1) &&
      end - start < 2 &&
      nextStart >= end
    ))
      throw new Error('Ambiguous word boundary; inspect alignment');
    segment.extraction = {
      start: Math.max(0, start - 0.03),
      end: Math.min(end + 0.02, nextStart),
      alignmentSha256: alignment.sha256,
    };
  }
  const assembly = {
    segments: recipe.segments,
    requests: recipe.segments.map((s) => jobs.get(s.requestHash).request),
    trim: recipe.segments.some((s) => s.extractSuffix)
      ? 'suffix:quiet-gap-to-end;others:outer-silence-48dB-keep40ms'
      : 'outer-silence-48dB-keep40ms',
    sampleRate: 24000,
    gapAfterLastMs: 100,
  };
  const requestHash = hash(JSON.stringify(assembly));
  const old = manifest.clips.find((c) => c.id === recipe.id);
  if (!old && !lumiOnly) throw new Error('Missing current clip');
  if (old && hash(await readFile('public/' + old.file)) !== old.audioSha256)
    throw new Error('Current clip modified');
  const chunks = [];
  for (const segment of recipe.segments) {
    const crop = segment.extraction
      ? `atrim=start=${segment.extraction.start}:end=${segment.extraction.end},asetpts=PTS-STARTPTS,`
      : '';
    const pcm = ff([
      '-i',
      inputs.get(segment.requestHash),
      '-ar',
      '24000',
      '-ac',
      '1',
      '-af',
      segment.extractSuffix
        ? crop.slice(0, -1)
        : crop +
          'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB:start_silence=0.04,areverse',
      '-f',
      's16le',
      'pipe:1',
    ]);
    if (pcm.length < (segment.extractPrefix === 'a' ? 960 : 2400))
      throw new Error('Empty segment');
    if (segment.extraction)
      ff(
        [
          '-y',
          '-f',
          's16le',
          '-ar',
          '24000',
          '-ac',
          '1',
          '-i',
          'pipe:0',
          root + '/' + segment.id + '-preview.wav',
        ],
        { input: pcm },
      );
    chunks.push(pcm, Buffer.alloc(Math.round(segment.gapMs * 24) * 2));
  }
  chunks.push(Buffer.alloc(4800));
  const assembled = root + '/' + recipe.id + '-assembled.wav';
  ff(
    [
      '-y',
      '-f',
      's16le',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-i',
      'pipe:0',
      assembled,
    ],
    { input: Buffer.concat(chunks) },
  );
  const measured = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      assembled,
      '-af',
      'loudnorm=I=-22:TP=-2:LRA=7:print_format=json',
      '-f',
      'null',
      '-',
    ],
    { ...options, encoding: 'utf8' },
  );
  if (measured.error || measured.status !== 0)
    throw new Error('Measurement failed');
  const meter = JSON.parse(
    measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? '{}',
  );
  const gainDb = Math.min(
    -22 - Number(meter.input_i),
    -2 - Number(meter.input_tp),
  );
  if (!Number.isFinite(gainDb)) throw new Error('Invalid loudness');
  const file = `audio/station/${recipe.speaker}/${recipe.id}-${requestHash.slice(0, 12)}.mp3`;
  await mkdir(path.dirname(path.join('public', file)), { recursive: true });
  ff([
    '-y',
    '-i',
    assembled,
    '-af',
    `volume=${gainDb.toFixed(3)}dB`,
    '-ar',
    '24000',
    '-ac',
    '1',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '96k',
    'public/' + file,
  ]);
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
  if (!(duration > 0 && duration < 60)) throw new Error('Invalid duration');
  const clip = {
    id: recipe.id,
    speaker: recipe.speaker,
    sourceText: recipe.sourceText,
    spokenText: recipe.spokenText ?? recipe.sourceText,
    voiceId: cast.voices[recipe.speaker].voiceId,
    file,
    requestHash,
    audioSha256: hash(await readFile('public/' + file)),
    sourceAudioSha256: hash(await readFile(assembled)),
    gainDb,
    duration,
  };
  patches.push({ clip, assembly, review: 'generated-awaiting-listening' });
  if (old) manifest.clips[manifest.clips.indexOf(old)] = clip;
  else manifest.clips.push(clip);
  if (old && old.file !== file) {
    const backup = path.resolve(root, 'previous', old.file),
      input = path.resolve('public', old.file);
    if (
      !backup.startsWith(path.resolve(root, 'previous') + path.sep) ||
      !input.startsWith(path.resolve('public') + path.sep)
    )
      throw new Error('Invalid archive path');
    await mkdir(path.dirname(backup), { recursive: true });
    try {
      await copyFile(input, backup, 1);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    if (hash(await readFile(backup)) !== old.audioSha256)
      throw new Error('Archive mismatch');
    replacedClips.push(old);
  }
}
const registry = await json('docs/voice/station-elevenlabs-patches.json');
await save('docs/voice/station-elevenlabs-patches.json', {
  patches: [
    ...registry.patches.filter(
      (p) => !patches.some((next) => next.clip.id === p.clip.id),
    ),
    ...patches,
  ],
});
await save('src/game/station-voice-manifest.json', manifest);
execFileSync(
  process.execPath,
  ['scripts/build-cat-mouth-cues.mjs', '--station'],
  { ...options, stdio: 'inherit' },
);
for (const old of replacedClips) {
  const input = path.resolve('public', old.file),
    backup = path.resolve(root, 'previous', old.file);
  if (
    !input.startsWith(path.resolve('public') + path.sep) ||
    !backup.startsWith(path.resolve(root, 'previous') + path.sep)
  )
    throw new Error('Invalid cleanup path');
  try {
    if (
      hash(await readFile(input)) !== old.audioSha256 ||
      hash(await readFile(backup)) !== old.audioSha256
    )
      throw new Error('Cleanup hash mismatch');
    await unlink(input);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
console.log(
  `Installed ${patches.length} authored clips; other dialogue files unchanged.`,
);
