import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const film = JSON.parse(await readFile('src/app/prologue-film.json', 'utf8'));
const render = JSON.parse(
  await readFile('docs/design/prologue-film/render.json', 'utf8'),
);
const voice = JSON.parse(await readFile(render.voiceManifest, 'utf8'));
const duration = Math.ceil(film.duration * 30) / 30;
const root = 'assets/audio/prologue/source/';
const work = 'artifacts/prologue-soundscape';
await mkdir(work, { recursive: true });
await mkdir('public/audio/prologue', { recursive: true });
const run = (args) =>
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', ...args],
    { stdio: 'inherit', windowsHide: true },
  );
const ramp = (start, end) => `clip((t-${start})/${end - start},0,1)`;
const voiceWindows = render.shots.map((s, i) => ({
  start: s.voiceStart,
  end: s.voiceStart + voice.clips[i].duration,
}));
const activity = voiceWindows
  .map(
    ({ start, end }) =>
      `min(${ramp(start - 0.15, start)},1-${ramp(end, end + 0.45)})`,
  )
  .reduce((a, b) => `max(${a},${b})`);
const musicFilter = `atrim=0:${duration},asetpts=PTS-STARTPTS,highpass=f=65,loudnorm=I=-30:TP=-9:LRA=9,volume='1-0.37*${activity}':eval=frame,afade=t=in:d=1.5,afade=t=out:st=49:d=${duration - 49}`;
run([
  '-i',
  root + 'lumi-the-first-light.mp3',
  '-map',
  '0:a:0',
  '-vn',
  '-af',
  musicFilter,
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
  'public/audio/prologue/music-v1.mp3',
]);

const outdoors = `(0.12+0.88*${ramp(8, 11)}-0.65*${ramp(18, 22)})*(1-${ramp(25.5, 27)})+0.18*${ramp(37, 38.2)}`;
const indoors = `0.18*(${ramp(25.5, 27)}-${ramp(37, 38.2)})`;
const fxFilter = [
  `[0:a]atrim=0:${duration},asetpts=PTS-STARTPTS,highpass=f=80,loudnorm=I=-31:TP=-9:LRA=6,asplit=2[outdoor][indoor]`,
  `[outdoor]lowpass=f=5500,volume='${outdoors}':eval=frame[out]`,
  `[indoor]lowpass=f=950,volume='${indoors}':eval=frame[in]`,
  '[1:a]atrim=0:5,asetpts=PTS-STARTPTS,highpass=f=300,lowpass=f=6000,volume=0.18,afade=t=in:d=0.08,afade=t=out:st=2.5:d=2.5,adelay=27000:all=1[chime]',
  `[out][in][chime]amix=inputs=3:normalize=0,volume='1-0.25*${activity}':eval=frame,afade=t=in:d=2,afade=t=out:st=49:d=${duration - 49},apad,atrim=0:${duration}[fx]`,
].join(';');
run([
  '-stream_loop',
  '-1',
  '-i',
  root + 'rain-823093.mp3',
  '-i',
  root + 'chime-398494.mp3',
  '-filter_complex',
  fxFilter,
  '-map',
  '[fx]',
  '-ar',
  '22050',
  '-ac',
  '1',
  '-c:a',
  'libmp3lame',
  '-b:a',
  '64k',
  '-map_metadata',
  '-1',
  'public/audio/prologue/effects-v1.mp3',
]);

// Standalone review export; runtime keeps the voice and two background buses independent.
run([
  '-i',
  'public/' + film.video,
  '-i',
  'public/audio/prologue/music-v1.mp3',
  '-i',
  'public/audio/prologue/effects-v1.mp3',
  '-filter_complex',
  '[0:a]pan=stereo|c0=c0|c1=c0[voice];[2:a]pan=stereo|c0=c0|c1=c0[fx];[voice][1:a][fx]amix=inputs=3:normalize=0[mix]',
  '-map',
  '0:v',
  '-map',
  '[mix]',
  '-map',
  '0:s?',
  '-c:v',
  'copy',
  '-c:s',
  'copy',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-movflags',
  '+faststart',
  work + '/prologue-mix-v1.mp4',
]);
const sources = [
  {
    file: root + 'lumi-the-first-light.mp3',
    provider: 'Suno',
    title: 'Lumi — The First Light',
    provenance:
      'Provided by owner: C:/Users/User/Downloads/Lumi — The First Light.mp3',
    use: 'First 53.333 seconds; original retained unchanged.',
  },
  {
    file: root + 'rain-823093.mp3',
    creator: 'Filmscore',
    title: 'Rainstorm with rain and distant thunder',
    url: 'https://freesound.org/people/Filmscore/sounds/823093/',
    download: 'https://cdn.freesound.org/previews/823/823093_843915-hq.mp3',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    use: 'Public HQ MP3 preview, not the login-only original; edited, filtered, looped and mixed.',
  },
  {
    file: root + 'chime-398494.mp3',
    creator: 'Anthousai',
    title: 'wind chimes - single 01.wav',
    url: 'https://freesound.org/people/Anthousai/sounds/398494/',
    download: 'https://cdn.freesound.org/previews/398/398494_5923045-hq.mp3',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    use: 'Public HQ MP3 preview; filtered, attenuated and placed at 27 seconds.',
  },
];
const outputs = [
  'public/audio/prologue/music-v1.mp3',
  'public/audio/prologue/effects-v1.mp3',
  work + '/prologue-mix-v1.mp4',
];
const fingerprint = async (file) => {
  const b = await readFile(file);
  return {
    sha256: createHash('sha256').update(b).digest('hex'),
    bytes: b.length,
  };
};
for (const source of sources)
  Object.assign(source, await fingerprint(source.file));
const exported = [];
for (const file of outputs)
  exported.push({ file, ...(await fingerprint(file)) });
await writeFile(
  'src/game/prologue-soundscape.json',
  JSON.stringify(
    {
      duration,
      music: 'audio/prologue/music-v1.mp3',
      effects: 'audio/prologue/effects-v1.mp3',
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  'docs/design/prologue-film/soundscape-manifest.json',
  JSON.stringify(
    {
      date: '2026-11-17',
      review: 'technical-check-only; awaiting owner listening',
      sources,
      outputs: exported,
      musicFilter,
      fxFilter,
      voiceWindows,
      duration,
      voiceUnchanged: true,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Music, effects and standalone preview prepared. No synthesis requests.',
);
