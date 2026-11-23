import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rename,
  access,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { joinSpeech, joinPolicy } from './lib/speech-joins.mjs';

const mode = process.argv[2];
if (!['snapshot', 'verify'].includes(mode))
  throw Error('Use snapshot or verify');
const root = 'artifacts/voice/station-16-20-joins-v2';
const source = 'artifacts/voice/station-16-20-elevenlabs-v1';
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
const audit = await json(`${root}/audit.json`);
const changed = audit.lines.filter((line) =>
  line.joins.some((join) => join.beforeMs !== join.afterMs),
);
const ids = new Set(changed.map((line) => line.id));
if (ids.size !== 14) throw Error('Unexpected repair scope; review audit');
const manifest = await json('src/game/station-voice-manifest.json');
const cues = await json('src/game/station-mouth-cues.json');
if (mode === 'snapshot') {
  await mkdir(`${root}/previous`, { recursive: true });
  if (await exists(`${root}/previous/manifest.json`))
    throw Error('Snapshot already exists; do not overwrite');
  for (const clip of manifest.clips) {
    if (hash(await readFile('public/' + clip.file)) !== clip.audioSha256)
      throw Error('Source audio changed');
    if (!ids.has(clip.id)) continue;
    await mkdir(path.dirname(`${root}/previous/${clip.file}`), {
      recursive: true,
    });
    await copyFile('public/' + clip.file, `${root}/previous/${clip.file}`);
    await copyFile(
      `${source}/assembled/${clip.id}.json`,
      `${root}/previous/${clip.id}.json`,
    );
  }
  await save(`${root}/previous/manifest.json`, manifest);
  await save(`${root}/previous/cues.json`, cues);
  console.log({ archived: ids.size, baseline: manifest.clips.length });
  process.exit(0);
}
const previous = await json(`${root}/previous/manifest.json`);
const oldCues = await json(`${root}/previous/cues.json`);
const plan = await json('docs/voice/station-16-20-elevenlabs-plan.json');
if (
  manifest.clips.length !== previous.clips.length ||
  cues.step !== oldCues.step
)
  throw Error('Scope changed');
const decode = (file) =>
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      '-i',
      file,
      '-ac',
      '1',
      '-ar',
      '24000',
      '-f',
      's16le',
      'pipe:1',
    ],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
const cache = new Map();
let preserved = 0;
for (const old of previous.clips) {
  const clip = manifest.clips.find((item) => item.id === old.id);
  if (!clip || hash(await readFile('public/' + clip.file)) !== clip.audioSha256)
    throw Error('Missing/corrupt output');
  if (!ids.has(old.id)) {
    if (
      JSON.stringify(clip) !== JSON.stringify(old) ||
      JSON.stringify(cues.clips.find((item) => item.id === old.id)) !==
        JSON.stringify(oldCues.clips.find((item) => item.id === old.id))
    )
      throw Error('Untargeted clip changed');
    preserved++;
    continue;
  }
  for (const key of ['id', 'speaker', 'voiceId', 'sourceText', 'spokenText'])
    if (clip[key] !== old[key]) throw Error('Content changed');
  if (old.file === clip.file)
    throw Error('URL must change for cache invalidation');
  if (hash(await readFile(`${root}/previous/${old.file}`)) !== old.audioSha256)
    throw Error('Bad archive');
  const entry = plan.entries.find((line) => line.id === clip.id);
  const parts = entry.segments.map((segment) => {
    if (!cache.has(segment.jobId))
      cache.set(
        segment.jobId,
        decode(
          `${source}/raw/${segment.jobId}-${segment.requestHash.slice(0, 16)}/speech.mp3`,
        ),
      );
    return { ...segment, pcm: cache.get(segment.jobId) };
  });
  const joined = joinSpeech(parts);
  if (!joined.pcm.equals(decode(`${source}/assembled/${clip.id}.wav`)))
    throw Error('Assembled PCM differs from reviewed joins');
  parts.forEach((part, index) => {
    const range = joined.ranges[index];
    for (let n = 0; n < part.pcm.length / 2; n++) {
      if (n >= range.start && n < range.end) continue;
      if (Math.abs(part.pcm.readInt16LE(n * 2)) > joinPolicy.peakLimit)
        throw Error('Removed audible sample');
    }
  });
  const cue = cues.clips.find((item) => item.id === clip.id);
  if (
    cue.file !== clip.file ||
    cue.audioSha256 !== clip.audioSha256 ||
    Math.abs(cue.frames.length * cues.step - clip.duration) > 0.15
  )
    throw Error('Stale mouth cues');
}
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
await writeFile(
  `${root}/listen.html`,
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Паузы — до и после</title><style>body{background:#152c2c;color:#eee6d3;font:17px/1.55 system-ui;margin:0}main{max-width:850px;margin:auto;padding:20px}article{padding:16px;border:1px solid #6b7967;border-radius:14px;margin:20px 0}small{overflow-wrap:anywhere}audio{display:block;width:100%;margin:12px 0}</style><main><h1>14 реплик · паузы на стыках</h1><p>Сверху — прежняя запись, снизу — исправленный монтаж. Текст и голоса сохранены. Записи ждут слуховой оценки.</p>${changed
    .map((line) => {
      const old = previous.clips.find((clip) => clip.id === line.id),
        current = manifest.clips.find((clip) => clip.id === line.id);
      return `<article><small>${escape(line.id)} · ${escape(line.speaker)}</small><p>${escape(line.text)}</p><label>До<audio controls preload="none" src="previous/${old.file}"></audio></label><label>После<audio controls preload="none" src="../../../public/${current.file}"></audio></label></article>`;
    })
    .join(
      '',
    )}</main><script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script></html>`,
);
// Archive obsolete public files only after every checksum and sample-range check.
for (const old of previous.clips.filter((clip) => ids.has(clip.id))) {
  const from = path.resolve('public', old.file),
    to = path.resolve(root, 'retired', old.file);
  if (
    !from.startsWith(path.resolve('public/audio/station') + path.sep) ||
    !to.startsWith(path.resolve(root) + path.sep)
  )
    throw Error('Unsafe archive path');
  if (await exists(from)) {
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
  }
}
const report = {
  repaired: ids.size,
  preserved,
  removedSeconds: previous.clips.reduce(
    (sum, old) =>
      sum +
      old.duration -
      manifest.clips.find((clip) => clip.id === old.id).duration,
    0,
  ),
  pcm: 'retained ranges byte-identical; removed samples <= -60 dBFS; outer edges unchanged',
  review: 'awaiting-listening',
  apiRequests: 0,
};
await save(`${root}/verification.json`, report);
console.log(report);
