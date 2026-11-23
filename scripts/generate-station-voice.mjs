// Authoring only. Uses the existing audited helper and never retries a paid call.
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
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (
      !['--execute', '--pilot', '--marta-voice', '--tik-voice'].includes(
        flag,
      ) ||
      Object.hasOwn(options, flag)
    )
      throw new Error(
        'Use [--marta-voice ID --tik-voice ID] [--pilot] [--execute]',
      );
    options[flag] = ['--execute', '--pilot'].includes(flag) ? true : args[++i];
    if (!options[flag]) throw new Error('Missing value: ' + flag);
  }
  const script = JSON.parse(
    await readFile('docs/voice/station-01-script.json', 'utf8'),
  );
  const selected = options['--pilot']
    ? ['marta', 'tik'].map((speaker) =>
        script.lines.find((line) => line.speaker === speaker),
      )
    : script.lines;
  const voices = {
    marta: options['--marta-voice'],
    tik: options['--tik-voice'],
  };
  const characters = selected.reduce(
    (n, line) => n + line.spokenText.length,
    0,
  );
  console.log(
    JSON.stringify({
      mode: options['--execute'] ? 'generate' : 'dry-run',
      lines: selected.length,
      characters,
      voices,
      limit: 5000,
    }),
  );
  if (!options['--execute']) return;
  if (
    characters > 5000 ||
    !voices.marta ||
    !voices.tik ||
    voices.marta === voices.tik
  )
    throw new Error(
      'Two different verified voice IDs and a batch under 5000 characters are required.',
    );
  for (const id of Object.values(voices))
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid voice ID.');
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore', windowsHide: true });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('Missing ELEVENLABS_API_KEY.');
  const get = async (endpoint) => {
    const response = await fetch('https://api.elevenlabs.io' + endpoint, {
      headers: { 'xi-api-key': key },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(`Preflight HTTP ${response.status}; no synthesis sent.`);
    return response.json();
  };
  for (const id of Object.values(voices)) {
    const voice = await get('/v1/voices/' + id);
    if (voice.voice_id !== id) throw new Error('Voice unavailable.');
  }
  const models = await get('/v1/models');
  if (
    !Array.isArray(models) ||
    !models.some(
      (model) =>
        model.model_id === script.modelId && model.can_do_text_to_speech,
    )
  )
    throw new Error('Requested model unavailable.');
  const user = await get('/v1/user');
  const remaining =
    user.subscription?.character_limit - user.subscription?.character_count;
  if (!Number.isFinite(remaining) || remaining < characters)
    throw new Error('Cannot confirm included quota; no synthesis sent.');
  const previous = JSON.parse(
    await readFile('src/game/station-voice-manifest.json', 'utf8'),
  );
  const installed = new Map(previous.clips.map((clip) => [clip.id, clip]));
  for (const line of selected) {
    const voiceId = voices[line.speaker];
    const job = prepareJob({
      kind: 'speech',
      id: `${line.id}-${line.speaker}-${voiceId}-v1`,
      modelId: script.modelId,
      voiceId,
      seed: script.seed,
      text: line.spokenText,
    });
    const result = await generate(job, 'artifacts/voice', key);
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
          'format=duration:stream=codec_name',
          '-of',
          'json',
          source,
        ],
        { encoding: 'utf8', windowsHide: true },
      ),
    );
    const duration = Number(probe.format?.duration);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 180 ||
      probe.streams?.[0]?.codec_name !== 'mp3'
    )
      throw new Error('Invalid recording; do not regenerate automatically.');
    const file = `audio/station/${line.speaker}/${line.id}-${job.requestHash.slice(0, 12)}.mp3`;
    await mkdir(path.dirname('public/' + file), { recursive: true });
    await copyFile(source, 'public/' + file);
    installed.set(line.id, {
      ...line,
      voiceId,
      file,
      requestHash: job.requestHash,
      audioSha256:
        receipt.files.find(
          (file) => file.path === 'speech.mp3' || file.name === 'speech.mp3',
        )?.sha256 ?? receipt.files[0].sha256,
      duration,
    });
    // Preserve a completed paid take even if a later request fails.
    await writeFile(
      'src/game/station-voice-manifest.json.tmp',
      JSON.stringify(
        {
          provider: 'elevenlabs',
          modelId: script.modelId,
          review: 'generated-awaiting-listening',
          clips: [...installed.values()],
        },
        null,
        2,
      ) + '\n',
    );
    await rename(
      'src/game/station-voice-manifest.json.tmp',
      'src/game/station-voice-manifest.json',
    );
  }
  execFileSync(
    process.execPath,
    ['scripts/build-cat-mouth-cues.mjs', '--station'],
    { stdio: 'inherit', windowsHide: true },
  );
}
main().catch((error) => {
  console.error(
    String(error.message).replaceAll(
      process.env.ELEVENLABS_API_KEY || '__NO_KEY__',
      '[REDACTED]',
    ),
  );
  process.exitCode = 1;
});
