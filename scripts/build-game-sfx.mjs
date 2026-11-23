import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const source = 'assets/audio/game-sfx/source/';
await mkdir(source, { recursive: true });
await mkdir('public/audio/game-sfx', { recursive: true });
await mkdir('docs/audio', { recursive: true });
async function files(dir) {
  const all = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + e.name;
    if (e.isDirectory()) all.push(...(await files(path)));
    else all.push(path);
  }
  return all;
}
const candidates = await files('artifacts/game-sfx').catch(() => []);
const definitions = [
  ['ui', 'click_001.ogg', 'interface-sounds', 0.18, 0.18],
  ['page', 'bookFlip1.ogg', 'rpg-audio', 0.5, 0.2],
  ['step0', 'footstep_wood_000.ogg', 'impact-sounds', 0.3, 0.22],
  ['step1', 'footstep_wood_001.ogg', 'impact-sounds', 0.3, 0.22],
  ['push', 'impactWood_medium_000.ogg', 'impact-sounds', 0.35, 0.28],
  ['blocked', 'impactSoft_medium_000.ogg', 'impact-sounds', 0.25, 0.16],
  ['undo', 'bookFlip2.ogg', 'rpg-audio', 0.5, 0.2],
  ['assembled', 'pluck_001.ogg', 'interface-sounds', 0.65, 0.28],
  ['success', 'chime-398494.mp3', 'freesound', 1.2, 0.32],
];
const outputs = [];
const fingerprint = (b) => createHash('sha256').update(b).digest('hex');
for (const [id, name, pack, duration, peak] of definitions) {
  const input = source + name;
  try {
    await readFile(input);
  } catch {
    const original =
      pack === 'freesound'
        ? 'assets/audio/prologue/source/' + name
        : candidates.find((p) => p.endsWith('/' + name));
    if (!original) throw new Error('Missing original ' + name);
    await copyFile(original, input);
  }
  const base = `highpass=f=80,lowpass=f=4200,silenceremove=start_periods=1:start_duration=0.005:start_threshold=-48dB,atrim=0:${duration},asetpts=PTS-STARTPTS`;
  const pcm = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      input,
      '-af',
      base,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-f',
      's16le',
      'pipe:1',
    ],
    { windowsHide: true },
  );
  let max = 0;
  for (let i = 0; i < pcm.length; i += 2)
    max = Math.max(max, Math.abs(pcm.readInt16LE(i)) / 32768);
  const actual = pcm.length / 2 / 24000;
  const filter =
    base +
    `,volume=${peak / Math.max(max, 0.001)},afade=t=in:d=0.003,afade=t=out:st=${Math.max(0, actual - 0.07)}:d=0.07`;
  const file = `audio/game-sfx/${id}-v1.wav`;
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      '-af',
      filter,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      '-map_metadata',
      '-1',
      'public/' + file,
    ],
    { windowsHide: true },
  );
  outputs.push({
    id,
    file,
    source: input,
    pack,
    license: 'CC0 1.0',
    sourceUrl:
      pack === 'freesound'
        ? 'https://freesound.org/people/Anthousai/sounds/398494/'
        : 'https://kenney.nl/assets/' + pack,
    sourceSha256: fingerprint(await readFile(input)),
    sha256: fingerprint(await readFile('public/' + file)),
    duration: actual,
    filter,
  });
}
for (const pack of ['interface-sounds', 'impact-sounds', 'rpg-audio']) {
  const license = candidates.find(
    (p) => p.includes('/' + pack + '/') && /license\.txt$/i.test(p),
  );
  if (license) await copyFile(license, source + pack + '-LICENSE.txt');
}
await writeFile(
  'src/game/game-sfx.json',
  JSON.stringify(
    Object.fromEntries(outputs.map((o) => [o.id, o.file])),
    null,
    2,
  ) + '\n',
);
await writeFile(
  'docs/audio/game-sfx-manifest.json',
  JSON.stringify(
    {
      date: '2026-11-17',
      review: 'technical-check-only; awaiting owner listening',
      source:
        'Official Kenney free downloads in anonymous browser session; existing CC0 chime from prologue',
      outputs,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Prepared ${outputs.length} sound effects. No synthesis requests.`);
