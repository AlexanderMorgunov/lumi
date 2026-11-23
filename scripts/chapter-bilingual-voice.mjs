// Whole chapter scope. Paid requests are sequential, cached, quota bounded and never retried.
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';
import { bilingualSpeech } from './lib/bilingual-speech.mjs';
const mode = process.argv[2];
if (!['prepare', 'generate'].includes(mode) || process.argv.length > 3)
  throw Error('Use prepare|generate');
const root = 'artifacts/voice/chapter-02-bilingual-v1',
  planPath = 'docs/voice/chapter-02-bilingual-plan.json';
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = (file, data) =>
  writeFile(file, JSON.stringify(data, null, 2) + '\n');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
};
const cast = await json('docs/voice/station-elevenlabs-cast.json');
if (cast.status !== 'owner-selected' || cast.modelId !== 'eleven_v3')
  throw Error('Changed cast');
if (mode === 'prepare') {
  if (await exists(planPath))
    throw Error('Prepared plan exists; preserve provenance');
  const manifest = await json('src/game/station-voice-manifest.json');
  const repair = await json('docs/voice/station-speech-repair-plan.json');
  const patches = await json('docs/voice/station-elevenlabs-patches.json');
  const original = await json('docs/voice/station-elevenlabs-plan.json');
  const batches = await Promise.all(
    ['06-10', '11-15', '16-20'].map((b) =>
      json(`docs/voice/station-${b}-elevenlabs-plan.json`),
    ),
  );
  const entries = [],
    audit = [];
  await mkdir(root + '/previous', { recursive: true });
  for (const clip of manifest.clips) {
    if (hash(await readFile('public/' + clip.file)) !== clip.audioSha256)
      throw Error('Changed active file');
    const mixed =
      /[A-Za-z]/.test(clip.sourceText) && /[А-Яа-яЁё]/.test(clip.sourceText);
    const current = repair.entries.find((e) => e.id === clip.id);
    const patch = patches.patches.find(
      (p) => p.clip.id === clip.id && p.clip.requestHash === clip.requestHash,
    );
    const native = original.entries.find(
      (e) => e.id === clip.id && e.requestHash === clip.requestHash,
    );
    const legacy = batches
      .flatMap((b) => b.entries)
      .find((e) => e.id === clip.id);
    if (!current && !patch && !native && !legacy)
      throw Error('Unknown provenance: ' + clip.id);
    if (current) {
      const assembled = await json(
        `artifacts/voice/station-06-20-speech-v3/assembled/${clip.id}.json`,
      );
      if (assembled.clip.audioSha256 !== clip.audioSha256)
        throw Error('Stale current repair');
    }
    const continuous = current
      ? !!current.job
      : patch
        ? patch.assembly.segments.length === 1
        : !!native;
    const action = mixed && !continuous ? 'continuous-take' : 'preserve';
    audit.push({
      id: clip.id,
      mixed,
      action,
      previousAssembly: continuous ? 'whole-line' : 'fragments',
      sourceTextHash: hash(clip.sourceText),
      audioSha256: clip.audioSha256,
    });
    if (action === 'preserve') continue;
    const spokenText = bilingualSpeech(clip.sourceText);
    const job = prepareJob({
      kind: 'speech',
      id: clip.id + '-bilingual-v1',
      modelId: cast.modelId,
      voiceId: clip.voiceId,
      text: spokenText,
      seed: 42,
      textNormalization: 'off',
    });
    if (clip.voiceId !== cast.voices[clip.speaker]?.voiceId)
      throw Error('Unexpected actor');
    entries.push({
      id: clip.id,
      speaker: clip.speaker,
      voiceId: clip.voiceId,
      sourceText: clip.sourceText,
      sourceTextHash: hash(clip.sourceText),
      spokenText,
      action,
      job: { request: job.request, requestHash: job.requestHash },
    });
    await mkdir(path.dirname(root + '/previous/' + clip.file), {
      recursive: true,
    });
    await copyFile('public/' + clip.file, root + '/previous/' + clip.file);
  }
  if (entries.length !== 150 || audit.length !== 320)
    throw Error('Review changed scope');
  await copyFile(
    'src/game/station-voice-manifest.json',
    root + '/previous/manifest.json',
  );
  await copyFile(
    'src/game/station-mouth-cues.json',
    root + '/previous/cues.json',
  );
  const plan = {
    modelId: cast.modelId,
    review:
      'owner-approved-whole-Matilda-pilot; chapter-authorized; new-lines-await-listening',
    characters: entries.reduce((n, e) => n + e.spokenText.length, 0),
    entries,
    audit,
  };
  await save(planPath, plan);
  console.log({
    audited: audit.length,
    mixed: audit.filter((e) => e.mixed).length,
    preserveWhole: audit.filter((e) => e.mixed && e.action === 'preserve')
      .length,
    generate: entries.length,
    characters: plan.characters,
  });
  process.exit(0);
}
const plan = await json(planPath),
  key = process.env.ELEVENLABS_API_KEY;
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
let subscription = await get('/v1/user/subscription');
const model = (await get('/v1/models')).find(
  (m) => m.model_id === plan.modelId && m.can_do_text_to_speech,
);
const rate =
  model?.model_rates?.character_cost_multiplier *
  model?.model_rates?.cost_discount_multiplier;
if (!(rate > 0)) throw Error('Unknown billing');
for (const voiceId of new Set(plan.entries.map((e) => e.voiceId)))
  if ((await get('/v1/voices/' + voiceId)).voice_id !== voiceId)
    throw Error('Voice unavailable');
const usageFile = root + '/usage.json';
const usage = (await exists(usageFile))
  ? await json(usageFile)
  : {
      before: subscription.character_count,
      limit: subscription.character_limit,
      initialRemaining:
        subscription.character_limit - subscription.character_count,
      startedAt: new Date().toISOString(),
    };
if (!(usage.initialRemaining > 0)) throw Error('No included quota');
await save(usageFile, usage);
let reserved = 0,
  complete = 0;
for (const [i, e] of plan.entries.entries()) {
  const prepared = prepareJob(e.job.request);
  if (
    prepared.requestHash !== e.job.requestHash ||
    prepared.request.voiceId !== cast.voices[e.speaker].voiceId
  )
    throw Error('Prepared request changed');
  const receiptPath = `${root}/raw/${prepared.request.id}-${prepared.requestHash.slice(0, 16)}/receipt.json`;
  const cached = await exists(receiptPath);
  const estimate = Math.ceil(e.spokenText.length * rate);
  if (!cached) {
    if (i % 10 === 0) subscription = await get('/v1/user/subscription');
    const available = Math.min(
      usage.initialRemaining - reserved,
      subscription.character_limit - subscription.character_count,
    );
    if (estimate > available) {
      await save(usageFile, {
        ...usage,
        status: 'included-quota-exhausted',
        complete,
        reserved,
        remaining: available,
      });
      throw Error(
        'Included quota reached; completed takes retained, no overage requested',
      );
    }
  }
  const result = await generate(prepared, root + '/raw', key);
  const receipt = await json(receiptPath);
  // Official character-cost header is exact per request; absence reserves the full upper estimate.
  const charge =
    Number.isFinite(receipt.characterCost) && receipt.characterCost >= 0
      ? Math.ceil(receipt.characterCost)
      : estimate;
  reserved += charge;
  complete++;
  await save(usageFile, {
    ...usage,
    status: 'generating',
    complete,
    reserved,
    remainingConservative: usage.initialRemaining - reserved,
  });
  console.log(
    `${i + 1}/${plan.entries.length} ${e.id} ${result.cached ? 'cached' : 'generated'} cost=${charge} reserved=${reserved}`,
  );
  if (charge > estimate)
    throw Error(
      'Cost exceeds model estimate; review billing before continuing',
    );
}
subscription = await get('/v1/user/subscription');
await save(usageFile, {
  ...usage,
  status: 'complete',
  complete,
  reserved,
  after: subscription.character_count,
  remaining: subscription.character_limit - subscription.character_count,
  finishedAt: new Date().toISOString(),
});
console.log({
  complete,
  reserved,
  remaining: subscription.character_limit - subscription.character_count,
});
