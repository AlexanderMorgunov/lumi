import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { renderFrame } from './prologue-renderer.mjs';

const manifest = JSON.parse(
  await readFile('docs/voice/prologue-george-manifest.json', 'utf8'),
);
const work = 'artifacts/prologue-film';
await mkdir(work, { recursive: true });
await mkdir('public/video', { recursive: true });
const sources = {
  valley: 'public/art/prologue/valley-v1.png',
  letters: 'public/art/prologue/letters-waiting-v1.png',
  workshop: 'public/art/prologue/workshop-awakening-v1.png',
};
let cursor = 0;
const cues = [];
const shots = [];
for (const [i, clip] of manifest.clips.entries()) {
  const duration = clip.duration + (i === 4 ? 5 : 2.4);
  const voiceStart = cursor + 1.1;
  shots.push({
    id: clip.id,
    start: cursor,
    duration,
    voiceStart,
    image: ['valley', 'valley', 'letters', 'workshop', 'valley'][i],
  });
  const a = JSON.parse(await readFile(clip.alignmentFile, 'utf8'));
  const text = a.characters.join('');
  const offset = text.indexOf(clip.sourceText);
  if (offset < 0) throw new Error(`Alignment differs from script: ${clip.id}`);
  // Prefer complete sentences; the player wraps each cue into readable lines.
  const sentences = clip.sourceText.match(/[^.!?]+[.!?](?:\s|$)/g);
  const chunks = sentences?.flatMap(
    (sentence) => sentence.match(/.{1,78}(?:\s|$)/g) ?? [],
  );
  if (!chunks || chunks.join('') !== clip.sourceText)
    throw new Error('Caption split lost text');
  let at = offset;
  for (const chunk of chunks) {
    const leading = chunk.length - chunk.trimStart().length;
    const endIndex = at + chunk.trimEnd().length - 1;
    cues.push({
      start: +(
        voiceStart + a.character_start_times_seconds[at + leading]
      ).toFixed(3),
      end: +(voiceStart + a.character_end_times_seconds[endIndex]).toFixed(3),
      text: chunk.trim(),
    });
    at += chunk.length;
  }
  cursor += duration;
}
const stamp = (n) => new Date(n * 1000).toISOString().slice(11, 23);
await writeFile(
  'public/video/prologue-ru.vtt',
  'WEBVTT\n\n' +
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`,
      )
      .join('\n'),
);
await writeFile(
  'src/app/prologue-film.json',
  JSON.stringify(
    {
      duration: +cursor.toFixed(3),
      video: 'video/prologue-v1.mp4',
      captions: 'video/prologue-ru.vtt',
      poster: 'art/prologue/workshop-awakening-v1.png',
      voice: 'George',
      cues,
      story: manifest.clips.map((c) => c.sourceText),
    },
    null,
    2,
  ) + '\n',
);
await writeFile(`${work}/timeline.json`, JSON.stringify(shots, null, 2));
if (process.argv.includes('--metadata-only')) process.exit(0);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.setContent('<canvas width="1280" height="720"></canvas>');
  await page.addScriptTag({
    content: `window.renderFrame = ${renderFrame.toString()}`,
  });
  const data = {};
  for (const [key, path] of Object.entries(sources))
    data[key] =
      'data:image/png;base64,' + (await readFile(path)).toString('base64');
  await page.evaluate(
    async ({ data, shots }) => {
      window.filmShots = shots;
      window.filmImages = {};
      for (const [key, src] of Object.entries(data)) {
        const im = new Image();
        im.src = src;
        await im.decode();
        window.filmImages[key] = im;
      }
    },
    { data, shots },
  );
  const encoder = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-framerate',
      '30',
      '-i',
      'pipe:0',
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '21',
      '-pix_fmt',
      'yuv420p',
      `${work}/silent.mp4`,
    ],
    { stdio: ['pipe', 'ignore', 'inherit'], windowsHide: true },
  );
  const encoded = once(encoder, 'close');
  encoder.stdin.on('error', () => {});
  for (let frame = 0; frame < Math.ceil(cursor * 30); frame++) {
    const png = await page.evaluate((t) => {
      const canvas = document.querySelector('canvas');
      window.renderFrame(
        canvas.getContext('2d'),
        window.filmImages,
        window.filmShots,
        t,
      );
      return canvas.toDataURL('image/png').split(',')[1];
    }, frame / 30);
    const buffer = Buffer.from(png, 'base64');
    if (!encoder.stdin.write(buffer)) await once(encoder.stdin, 'drain');
    if (frame % 300 === 0)
      console.log(`Rendered ${frame}/ ${Math.ceil(cursor * 30)} frames`);
    if ([60, 420, 720, 990, 1500].includes(frame))
      await writeFile(`${work}/frame-${frame}.png`, buffer);
  }
  encoder.stdin.end();
  if ((await encoded)[0] !== 0) throw new Error('Video encode failed');
} finally {
  await browser.close();
}
const filters = shots.map(
  (s, i) =>
    `[${i + 1}:a]adelay=${Math.round(s.voiceStart * 1000)}:all=1[a${i}]`,
);
filters.push(
  shots.map((_, i) => `[a${i}]`).join('') +
    `amix=inputs=5:normalize=0,apad,atrim=duration=${cursor}[voice]`,
);
const args = [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-i',
  `${work}/silent.mp4`,
  ...manifest.clips.flatMap((c) => ['-i', `public/${c.file}`]),
  '-i',
  'public/video/prologue-ru.vtt',
  '-filter_complex',
  filters.join(';'),
  '-map',
  '0:v',
  '-map',
  '[voice]',
  '-map',
  '6:s',
  '-c:s',
  'mov_text',
  '-metadata:s:s:0',
  'language=rus',
  '-disposition:s:0',
  'default',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-movflags',
  '+faststart',
  'public/video/prologue-v1.mp4',
];
const mux = spawn('ffmpeg', args, {
  stdio: ['ignore', 'ignore', 'inherit'],
  windowsHide: true,
});
if ((await once(mux, 'close'))[0] !== 0) throw new Error('Mux failed');
const movie = await readFile('public/video/prologue-v1.mp4');
await writeFile(
  'docs/design/prologue-film/render.json',
  JSON.stringify(
    {
      video: 'public/video/prologue-v1.mp4',
      duration: cursor,
      resolution: [1280, 720],
      fps: 30,
      sha256: createHash('sha256').update(movie).digest('hex'),
      bytes: movie.length,
      voiceManifest: 'docs/voice/prologue-george-manifest.json',
      sources,
      shots,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Film ready: ${cursor.toFixed(2)}s, ${(movie.length / 1048576).toFixed(1)} MiB`,
);
