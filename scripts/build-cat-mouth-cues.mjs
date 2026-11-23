import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Offline amplitude cues for the existing recordings, not phoneme recognition.
const station = process.argv.includes('--station');
const prefix = station ? 'station' : 'cat';
const manifest = JSON.parse(
  await readFile(`src/game/${prefix}-voice-manifest.json`, 'utf8'),
);
const step = 0.08;
const sampleRate = 8000;
const samplesPerFrame = Math.round(step * sampleRate);
const clips = [];
for (const clip of manifest.clips) {
  const input = 'public/' + clip.file;
  const hash = createHash('sha256')
    .update(await readFile(input))
    .digest('hex');
  if (hash !== clip.audioSha256)
    throw new Error('Recording changed: ' + clip.id);
  const pcm = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      input,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(sampleRate),
      '-f',
      's16le',
      'pipe:1',
    ],
    { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
  );
  const levels = [];
  for (let start = 0; start < pcm.length / 2; start += samplesPerFrame) {
    const count = Math.min(samplesPerFrame, pcm.length / 2 - start);
    let sum = 0;
    for (let i = 0; i < count; i++)
      sum += (pcm.readInt16LE((start + i) * 2) / 32768) ** 2;
    levels.push(Math.sqrt(sum / count));
  }
  const voiced = levels.filter((level) => level > 0.008).sort((a, b) => a - b);
  const threshold = Math.max(
    0.012,
    (voiced[Math.floor(voiced.length * 0.65)] ?? 0.04) * 0.55,
  );
  let open = false;
  const frames = levels
    .map((level) => {
      open = level >= threshold * (open ? 0.8 : 1);
      return open ? '1' : '0';
    })
    .join('');
  clips.push({ id: clip.id, file: clip.file, audioSha256: hash, frames });
}
await writeFile(
  `src/game/${prefix}-mouth-cues.json`,
  JSON.stringify(
    {
      step,
      method:
        '80ms RMS with per-recording threshold and hysteresis; not phoneme alignment',
      clips,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Prepared mouth cues for ${clips.length} existing recordings. No API requests.`,
);
