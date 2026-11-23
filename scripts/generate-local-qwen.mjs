import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const localRoot = path.join(root, 'artifacts/voice/local-qwen');
const runtime = path.join(
  localRoot,
  'runtime/v0.9.5-portable/audiocpp_cli.exe',
);
const jobPath = process.argv[2];
const dryRun = process.argv[3] === '--dry-run';
if (
  !jobPath ||
  (process.argv.length !== 3 && !(dryRun && process.argv.length === 4))
) {
  throw new Error(
    'Usage: node scripts/generate-local-qwen.mjs <job.json> [--dry-run]',
  );
}
const job = JSON.parse(await readFile(path.resolve(jobPath), 'utf8'));
if (
  !job ||
  typeof job !== 'object' ||
  typeof job.id !== 'string' ||
  !/^[a-z0-9][a-z0-9-]{0,79}$/.test(job.id) ||
  typeof job.text !== 'string' ||
  !job.text.trim() ||
  job.text.length > 600 ||
  !['design', 'clone'].includes(job.mode ?? 'design') ||
  !['Russian', 'English', 'Auto'].includes(job.language) ||
  !Number.isSafeInteger(job.seed) ||
  job.seed < 0 ||
  job.seed > 2147483647 ||
  !['vulkan', 'cpu'].includes(job.backend ?? 'vulkan')
) {
  throw new Error(
    'Invalid job: id, text (1–600 chars), language, seed, optional mode and backend required.',
  );
}
const mode = job.mode ?? 'design';
if (
  job.cloneConditioning !== undefined &&
  (mode !== 'clone' || !['icl', 'speaker'].includes(job.cloneConditioning))
) {
  throw new Error(
    'cloneConditioning must be icl or speaker, and is only valid for clone jobs.',
  );
}
const variant = mode === 'clone' ? 'Base' : 'VoiceDesign';
const modelId = `Qwen/Qwen3-TTS-12Hz-1.7B-${variant}`;
const revision =
  mode === 'clone'
    ? 'fd4b254389122332181a7c3db7f27e918eec64e3'
    : '5ecdb67327fd37bb2e042aab12ff7391903235d3';
const model = path.join(localRoot, `models/Qwen3-TTS-12Hz-1.7B-${variant}`);
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const voiceArgs = [];
let voiceReference;
if (mode === 'clone') {
  if (typeof job.voiceProfile !== 'string')
    throw new Error('Clone job requires voiceProfile.');
  const profileRoot = path.join(root, 'docs/voice');
  const profilePath = path.resolve(root, job.voiceProfile);
  if (!profilePath.startsWith(profileRoot + path.sep))
    throw new Error('Voice profile must be inside docs/voice.');
  const profile = JSON.parse(
    (await readFile(profilePath, 'utf8')).replace(/^\uFEFF/, ''),
  );
  if (
    !profile ||
    typeof profile !== 'object' ||
    profile.status !== 'owner-selected-reference' ||
    typeof profile.voiceProfileId !== 'string' ||
    typeof profile.referenceAudio !== 'string' ||
    typeof profile.referenceAudioSha256 !== 'string' ||
    typeof profile.referenceText !== 'string' ||
    !profile.referenceText.trim()
  ) {
    throw new Error('Missing or unapproved voice reference.');
  }
  const reference = path.resolve(
    path.dirname(profilePath),
    profile.referenceAudio,
  );
  if (!reference.startsWith(profileRoot + path.sep))
    throw new Error('Voice reference must be inside docs/voice.');
  if ((await sha256(reference)) !== profile.referenceAudioSha256)
    throw new Error('Voice reference checksum mismatch.');
  const languageDefaults = profile.cloneConditioningByLanguage;
  if (
    languageDefaults !== undefined &&
    (!languageDefaults ||
      typeof languageDefaults !== 'object' ||
      Array.isArray(languageDefaults) ||
      Object.entries(languageDefaults).some(
        ([language, value]) =>
          !['Russian', 'English', 'Auto'].includes(language) ||
          !['icl', 'speaker'].includes(value),
      ))
  )
    throw new Error('Invalid voice profile conditioning defaults.');
  const conditioning =
    job.cloneConditioning ?? languageDefaults?.[job.language] ?? 'icl';
  voiceArgs.push('--voice-ref', reference);
  if (conditioning === 'speaker') {
    voiceArgs.push('--request-option', 'x_vector_only_mode=true');
  } else {
    voiceArgs.push('--reference-text', profile.referenceText);
  }
  voiceReference = {
    profile: job.voiceProfile,
    id: profile.voiceProfileId,
    audioSha256: profile.referenceAudioSha256,
    text: profile.referenceText,
    conditioning,
  };
} else {
  if (
    typeof job.instruct !== 'string' ||
    !job.instruct.trim() ||
    job.instruct.length > 1500
  ) {
    throw new Error('VoiceDesign job requires instruct (1–1500 chars).');
  }
  voiceArgs.push('--instruct', job.instruct);
}
await access(runtime);
await access(path.join(model, 'model.safetensors'));
await access(path.join(model, 'speech_tokenizer/model.safetensors'));
const installed = JSON.parse(
  (await readFile(path.join(model, 'download-manifest.json'), 'utf8')).replace(
    /^\uFEFF/,
    '',
  ),
);
if (installed.id !== modelId || installed.sha !== revision)
  throw new Error('Unexpected installed model revision.');
const outputDir = path.join(localRoot, 'samples', job.id);
const output = path.join(outputDir, 'speech.wav');
const args = [
  '--task',
  mode === 'clone' ? 'clon' : 'vdes',
  '--family',
  'qwen3_tts',
  '--model',
  model,
  '--backend',
  job.backend ?? 'vulkan',
  '--threads',
  '6',
  '--text',
  job.text,
  ...voiceArgs,
  '--language',
  job.language,
  '--seed',
  String(job.seed),
  '--max-tokens',
  '384',
  '--session-option',
  'qwen3_tts.talker_weight_type=q8_0',
  '--session-option',
  'qwen3_tts.kv_cache_type=f16',
  '--out',
  output,
  '--metrics',
  '--log-file',
  path.join(outputDir, 'engine.log'),
];
if (dryRun) {
  console.log(
    JSON.stringify(
      { id: job.id, model: modelId, revision, voiceReference, args },
      null,
      2,
    ),
  );
  process.exit(0);
}
// A new id is required for every take; never overwrite an earlier audition.
await mkdir(path.dirname(outputDir), { recursive: true });
await mkdir(outputDir);
const record = {
  ...job,
  provider: 'local',
  runtime: 'audio.cpp v0.9.5 portable (61c7838b)',
  model: modelId,
  revision,
  voiceReference,
  sourceTextSha256: createHash('sha256').update(job.text).digest('hex'),
  args,
  startedAt: new Date().toISOString(),
  status: 'running',
  reviewed: false,
};
const manifest = path.join(outputDir, 'request.json');
await writeFile(manifest, JSON.stringify(record, null, 2) + '\n');
const started = performance.now();
let processLog = '';
try {
  await new Promise((resolve, reject) => {
    const child = spawn(runtime, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 20 * 60 * 1000,
    });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      processLog += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      processLog += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`Engine failed: ${code ?? signal}`)),
    );
  });
  await access(output);
  record.audioSha256 = await sha256(output);
  record.metrics = Object.fromEntries(
    [...processLog.matchAll(/^metrics\.([\w.]+)=([^\r\n]+)/gm)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  record.status = 'generated-unreviewed';
} catch (error) {
  record.status = 'failed';
  record.error = String(error);
  throw error;
} finally {
  record.wallSeconds = (performance.now() - started) / 1000;
  await writeFile(path.join(outputDir, 'process.log'), processLog);
  await writeFile(manifest, JSON.stringify(record, null, 2) + '\n');
}
console.log(`Unreviewed sample: ${output}`);
