// Authoring only. Never import this module into the browser bundle.
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (
      !['--execute', '--script', '--episodes', '--budget'].includes(flag) ||
      Object.hasOwn(options, flag)
    )
      throw new Error(
        'Use --script path [--episodes key,apple] [--budget characters] [--execute]',
      );
    options[flag] = flag === '--execute' ? true : args[++index];
    if (options[flag] === undefined)
      throw new Error(`Missing value for ${flag}`);
  }
  const script = JSON.parse(
    await readFile(
      options['--script'] ?? 'docs/voice/episode-01-script.json',
      'utf8',
    ),
  );
  const selected = options['--episodes']?.split(',');
  if (
    selected?.some(
      (episode) => !script.lines.some((line) => line.episode === episode),
    )
  )
    throw new Error('Unknown selected episode');
  const jobs = script.lines
    .filter((line) => !selected || selected.includes(line.episode))
    .map((line) => ({
      line,
      job: prepareJob({
        kind: 'speech',
        id: `${line.id}-callum-01`,
        modelId: script.modelId,
        voiceId: script.voiceId,
        seed: script.seed,
        text: line.spokenText,
      }),
    }));
  if (!jobs.length) throw new Error('Empty batch');
  let pendingCharacters = 0;
  for (const { job } of jobs) {
    const receiptPath = path.join(
      'artifacts/voice',
      `${job.request.id}-${job.requestHash.slice(0, 16)}`,
      'receipt.json',
    );
    try {
      const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
      if (
        receipt.status !== 'complete' ||
        receipt.requestHash !== job.requestHash
      )
        throw new Error(
          'Unresolved prior request; inspect receipt before a new attempt.',
        );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      pendingCharacters += job.request.text.length;
    }
  }
  const budget =
    options['--budget'] === undefined ? Infinity : Number(options['--budget']);
  if (!(budget > 0) || pendingCharacters > budget)
    throw new Error(
      `Batch needs ${pendingCharacters} uncached characters; budget is ${budget}. No request sent.`,
    );
  console.log(
    JSON.stringify({
      mode: options['--execute'] ? 'generate-and-install' : 'dry-run',
      voice: script.voice,
      lines: jobs.length,
      characters: jobs.reduce(
        (sum, { job }) => sum + job.request.text.length,
        0,
      ),
      pendingCharacters,
    }),
  );
  if (!options['--execute']) return;
  // Fail before any synthesis if the local audio validator is unavailable.
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
  if (pendingCharacters) {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' },
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        `Cannot verify available quota (HTTP ${response.status}); no synthesis sent.`,
      );
    const user = await response.json();
    const remaining =
      user.subscription?.character_limit - user.subscription?.character_count;
    if (!Number.isFinite(remaining) || remaining < pendingCharacters)
      throw new Error(
        `Not enough included quota for ${pendingCharacters} characters. No synthesis sent.`,
      );
    console.log(JSON.stringify({ remaining, pendingCharacters }));
  }
  const previous = JSON.parse(
    await readFile('src/game/cat-voice-manifest.json', 'utf8'),
  );
  if (
    previous.voiceId !== script.voiceId ||
    previous.modelId !== script.modelId
  )
    throw new Error(
      'Voice/model differs from current manifest; review before replacing.',
    );
  const installed = new Map(previous.clips.map((clip) => [clip.id, clip]));
  await mkdir('public/audio/cat/callum-v1', { recursive: true });
  const clips = [];
  const safeFetch = async (...params) => {
    const response = await fetch(...params);
    if (!response.ok) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      const detail = body?.detail;
      const message = typeof detail?.message === 'string' ? detail.message : '';
      console.error(
        JSON.stringify({
          httpStatus: response.status,
          code: detail?.status,
          message: message
            .replaceAll(
              process.env.ELEVENLABS_API_KEY || '__NO_KEY__',
              '[REDACTED]',
            )
            .slice(0, 1200),
        }),
      );
    }
    return response;
  };
  for (const { line, job } of jobs) {
    console.log(`Generating ${line.id}`);
    const result = await generate(
      job,
      'artifacts/voice',
      process.env.ELEVENLABS_API_KEY,
      safeFetch,
    );
    const receipt = JSON.parse(
      await readFile(path.join(result.directory, 'receipt.json'), 'utf8'),
    );
    const source = path.join(result.directory, 'speech.mp3');
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration:stream=codec_name,sample_rate',
          '-of',
          'json',
          source,
        ],
        { encoding: 'utf8' },
      ),
    );
    const duration = Number(probe.format?.duration);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 180 ||
      probe.streams?.[0]?.codec_name !== 'mp3'
    )
      throw new Error(
        `Invalid audio for ${line.id}; no automatic regeneration.`,
      );
    const clip = {
      id: line.id,
      sourceText: line.sourceText,
      spokenText: line.spokenText,
      file: `audio/cat/callum-v1/${line.id}-${job.requestHash.slice(0, 12)}.mp3`,
      requestHash: job.requestHash,
      audioSha256: receipt.files[0].sha256,
      duration,
    };
    clips.push(clip);
    // Preserve every completed line even if a later request fails or quota ends.
    await copyFile(source, path.join('public', clip.file));
    installed.set(clip.id, clip);
    const manifest = {
      provider: script.provider,
      voice: script.voice,
      voiceId: script.voiceId,
      modelId: script.modelId,
      review:
        'voice-and-delivery-approved-by-owner; episode-lines-await-listening',
      clips: [...installed.values()],
    };
    await writeFile(
      'src/game/cat-voice-manifest.json.tmp',
      JSON.stringify(manifest, null, 2) + '\n',
    );
    await rename(
      'src/game/cat-voice-manifest.json.tmp',
      'src/game/cat-voice-manifest.json',
    );
  }
  console.log(
    JSON.stringify({
      installed: clips.length,
      duration: clips.reduce((sum, clip) => sum + clip.duration, 0),
    }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
