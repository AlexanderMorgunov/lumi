import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  prepareJob,
  generate,
} from '../.agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs';

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const voiceOption = args.find((arg) => arg.startsWith('--voice='))?.slice(8);
  if (
    args.some(
      (arg) =>
        arg !== '--execute' &&
        arg !== '--auditions' &&
        !arg.startsWith('--voice='),
    )
  )
    throw new Error('Use --auditions or --voice=george [--execute]');
  if (args.includes('--auditions') === Boolean(voiceOption))
    throw new Error('Choose exactly one mode');
  const script = JSON.parse(
    await readFile('docs/voice/prologue-script.json', 'utf8'),
  );
  const voices = voiceOption
    ? script.voices.filter((voice) => voice.id === voiceOption)
    : script.voices;
  if (!voices.length) throw new Error('Unknown voice');
  const jobs = voices.flatMap((voice) =>
    (voiceOption
      ? script.lines
      : [{ id: 'audition', text: script.sampleText }]
    ).map((line) => {
      const text = line.delivery
        ? `[${line.delivery}] ${line.text}`
        : line.text;
      return {
        voice,
        line,
        job: prepareJob({
          kind: 'speech',
          id: `prologue-v1-${voice.id}-${line.id}`,
          modelId: script.modelId,
          voiceId: voice.voiceId,
          seed: script.seed,
          text,
          ...(voiceOption ? { withTimestamps: true } : {}),
        }),
      };
    }),
  );
  const characters = jobs.reduce(
    (n, entry) => n + entry.job.request.text.length,
    0,
  );
  console.log(
    JSON.stringify({
      mode: execute ? 'generate' : 'dry-run',
      lines: jobs.length,
      characters,
    }),
  );
  if (!execute) return;
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
  const response = await fetch('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' },
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Quota check failed: HTTP ${response.status}`);
  const account = await response.json();
  const remaining =
    account.subscription?.character_limit -
    account.subscription?.character_count;
  if (!Number.isFinite(remaining) || remaining < characters)
    throw new Error('Insufficient included quota; no generation sent');
  const root = 'public/audio/prologue';
  await mkdir(root, { recursive: true });
  const clips = [];
  for (const { voice, line, job } of jobs) {
    console.log(`Generating ${job.request.id}`);
    const result = await generate(
      job,
      'artifacts/voice',
      process.env.ELEVENLABS_API_KEY,
    );
    const source = path.join(result.directory, 'speech.mp3');
    const receipt = JSON.parse(
      await readFile(path.join(result.directory, 'receipt.json'), 'utf8'),
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
          'default=noprint_wrappers=1:nokey=1',
          source,
        ],
        { encoding: 'utf8' },
      ),
    );
    if (!(duration > 0 && duration < 120))
      throw new Error('Invalid duration; no automatic regeneration');
    const file = `${voice.id}-${line.id}-${job.requestHash.slice(0, 12)}.mp3`;
    await copyFile(source, path.join(root, file));
    const alignmentFile = receipt.alignment
      ? `docs/voice/prologue-alignments/${voice.id}-${line.id}-${job.requestHash.slice(0, 12)}.json`
      : undefined;
    if (alignmentFile) {
      await mkdir(path.dirname(alignmentFile), { recursive: true });
      await copyFile(
        path.join(result.directory, receipt.alignment.name),
        alignmentFile,
      );
    }
    clips.push({
      id: line.id,
      voice: voice.name,
      voiceId: voice.voiceId,
      sourceText: line.text,
      spokenText: job.request.text,
      file: `audio/prologue/${file}`,
      duration,
      requestHash: job.requestHash,
      audioSha256: receipt.files[0].sha256,
      ...(alignmentFile ? { alignmentFile } : {}),
    });
  }
  await writeFile(
    `docs/voice/prologue-${voiceOption ?? 'auditions'}-manifest.json`,
    JSON.stringify(
      {
        provider: script.provider,
        modelId: script.modelId,
        review: 'awaiting-listening',
        clips,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify(
      clips.map(({ voice, id, duration, file }) => ({
        voice,
        id,
        duration,
        file,
      })),
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
