import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

await mkdir('public/audio/game-music', { recursive: true });
const manifestPath = 'docs/audio/game-music-manifest.json';
const only = process.argv[2];
const tracks = [
  ['menu', 'the-road-is-sleeping'],
  ['workshop', 'martas-workshop'],
  ['station', 'letters-in-the-rain'],
];
if (only && !tracks.some(([id]) => id === only))
  throw new Error(`Unknown music track: ${only}`);
const outputs = only
  ? JSON.parse(await readFile(manifestPath, 'utf8')).outputs.filter(
      (item) => item.id !== only,
    )
  : [];
const hash = (data) => createHash('sha256').update(data).digest('hex');
for (const [id, name] of tracks.filter(([id]) => !only || id === only)) {
  const source = `assets/audio/game-music/source/${name}.mp3`;
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'json',
        source,
      ],
      { windowsHide: true },
    ).toString(),
  );
  const duration = Number(probe.format.duration);
  // A cyclic edit: middle, then a six-second tail/head overlap.
  // Its end joins the beginning at the same point in the original recording.
  const overlap = 6;
  const loop = `[0:a]asplit=3[m][t][h];[m]atrim=${overlap}:${duration - overlap},asetpts=PTS-STARTPTS[mid];[t]atrim=${duration - overlap}:${duration},asetpts=PTS-STARTPTS[tail];[h]atrim=0:${overlap},asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=${overlap}:c1=tri:c2=tri[join];[mid][join]concat=n=2:v=0:a=1[loop]`;
  const measurement = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      source,
      '-filter_complex',
      loop + ';[loop]loudnorm=I=-24:TP=-3:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (measurement.status !== 0) throw new Error(measurement.stderr);
  const levels = JSON.parse(
    measurement.stderr.slice(
      measurement.stderr.lastIndexOf('{'),
      measurement.stderr.lastIndexOf('}') + 1,
    ),
  );
  const file = `audio/game-music/${name}-v1.mp3`;
  const filter =
    loop +
    `;[loop]loudnorm=I=-24:TP=-3:LRA=11:measured_I=${levels.input_i}:measured_TP=${levels.input_tp}:measured_LRA=${levels.input_lra}:measured_thresh=${levels.input_thresh}:offset=${levels.target_offset}:linear=true[out]`;
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      source,
      '-filter_complex',
      filter,
      '-map',
      '[out]',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      '-map_metadata',
      '-1',
      'public/' + file,
    ],
    { windowsHide: true },
  );
  outputs.push({
    id,
    source,
    file,
    duration,
    overlap,
    filter,
    levels,
    sourceSha256: hash(await readFile(source)),
    sha256: hash(await readFile('public/' + file)),
    provenance: 'Suno track supplied by project owner',
    review: 'Technical processing only; listening review pending',
  });
}
await writeFile(
  'src/game/game-music.json',
  JSON.stringify(
    Object.fromEntries(outputs.map((item) => [item.id, item.file])),
    null,
    2,
  ) + '\n',
);
await writeFile(
  manifestPath,
  JSON.stringify(
    { date: new Date().toISOString().slice(0, 10), outputs },
    null,
    2,
  ) + '\n',
);
console.log(`Prepared ${only ?? 'all'} looping music; no generation requests.`);
