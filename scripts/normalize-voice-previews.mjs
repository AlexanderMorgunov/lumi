import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(
  new URL('../artifacts/voice/local-qwen/samples/', import.meta.url),
);
const ids = process.argv.slice(2);
if (
  !ids.length ||
  new Set(ids).size !== ids.length ||
  ids.some((id) => !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))
) {
  throw new Error(
    'Usage: node scripts/normalize-voice-previews.mjs <sample-id> [...]',
  );
}
const options = {
  windowsHide: true,
  timeout: 120000,
  maxBuffer: 2 * 1024 * 1024,
};
async function measure(file) {
  const { stderr } = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      file,
      '-af',
      'loudnorm=I=-22:TP=-2:LRA=7:print_format=json',
      '-f',
      'null',
      '-',
    ],
    options,
  );
  const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
  if (!json) throw new Error('Missing FFmpeg loudness report.');
  const raw = JSON.parse(json);
  const integratedLufs = Number(raw.input_i);
  const truePeakDb = Number(raw.input_tp);
  if (!Number.isFinite(integratedLufs) || !Number.isFinite(truePeakDb))
    throw new Error(`Silent or invalid audio: ${file}`);
  return { integratedLufs, truePeakDb };
}
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const samples = [];
for (const id of ids) {
  const dir = path.join(root, id);
  const source = path.join(dir, 'speech.wav');
  const output = path.join(dir, 'preview.wav');
  try {
    await access(output);
    throw new Error(`Preview already exists: ${id}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  samples.push({ id, dir, source, output, measured: await measure(source) });
}
// One common level for the group, with headroom; only constant gain is applied.
const targetLufs = Math.min(
  -22,
  ...samples.map(
    ({ measured }) => measured.integratedLufs - measured.truePeakDb - 2,
  ),
);
for (const sample of samples) {
  const gainDb = targetLufs - sample.measured.integratedLufs;
  const filter = `volume=${gainDb.toFixed(3)}dB`;
  await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-n',
      '-i',
      sample.source,
      '-af',
      filter,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      sample.output,
    ],
    options,
  );
  const measured = await measure(sample.output);
  const { stdout } = await run(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size:stream=codec_name,sample_rate,channels',
      '-of',
      'json',
      sample.output,
    ],
    options,
  );
  const audio = JSON.parse(stdout);
  if (!(Number(audio.format?.duration) > 0) || measured.truePeakDb > -1.5)
    throw new Error(`Invalid preview: ${sample.id}`);
  const record = {
    id: sample.id,
    sourceSha256: await sha256(sample.source),
    previewSha256: await sha256(sample.output),
    targetLufs,
    filter,
    sourceMeasurement: sample.measured,
    previewMeasurement: measured,
    audio,
    generatedAt: new Date().toISOString(),
    reviewed: false,
  };
  await writeFile(
    path.join(sample.dir, 'preview.json'),
    JSON.stringify(record, null, 2) + '\n',
  );
  console.log(
    `${sample.id}: ${audio.format.duration}s, ${measured.integratedLufs} LUFS, peak ${measured.truePeakDb} dBTP`,
  );
}
