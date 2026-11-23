// Inspect the actual shipped recordings, not only their archived source segments.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const manifest = JSON.parse(
  await readFile('src/game/station-voice-manifest.json', 'utf8'),
);
const output = 'artifacts/voice/station-06-20-speech-v3/active-audit.json';
const threshold = '-50 dBFS for >= 650 ms; excludes outer padding';
let previous;
try {
  previous = JSON.parse(await readFile(output, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const lines = [];
for (const clip of manifest.clips.filter((c) =>
  /^chapter-02-(0[6-9]|1\d|20)-/.test(c.id),
)) {
  const file = 'public/' + clip.file;
  if (
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex') !== clip.audioSha256
  )
    throw Error('Changed audio: ' + clip.id);
  const cached =
    previous?.threshold === threshold &&
    previous.entries.find(
      (entry) =>
        entry.id === clip.id &&
        entry.sha256 === clip.audioSha256 &&
        entry.sourceText === clip.sourceText &&
        entry.file === clip.file,
    );
  if (cached) {
    lines.push(cached);
    continue;
  }
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      file,
      '-af',
      'silencedetect=noise=-50dB:d=0.65',
      '-f',
      'null',
      '-',
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.status !== 0) throw Error('Cannot decode ' + clip.id);
  const gaps = [];
  let start;
  for (const match of result.stderr.matchAll(
    /silence_(start|end): ([\d.]+)/g,
  )) {
    const time = Number(match[2]);
    if (match[1] === 'start') start = time;
    else if (start !== undefined) {
      // Outer padding is not a within-sentence join.
      if (start > 0.15 && time < clip.duration - 0.15)
        gaps.push({ start, end: time, seconds: time - start });
      start = undefined;
    }
  }
  lines.push({
    id: clip.id,
    file: clip.file,
    sha256: clip.audioSha256,
    sourceText: clip.sourceText,
    duration: clip.duration,
    longQuietIntervals: gaps,
    interpretation: gaps.length
      ? 'listening-priority; may be intentional sentence pause'
      : 'no long near-silent interval detected; pronunciation unreviewed',
  });
}
if (lines.length !== 246) throw Error('Unexpected audit scope');
const report = {
  lines: lines.length,
  withLongQuietIntervals: lines.filter((l) => l.longQuietIntervals.length)
    .length,
  threshold,
  auditoryReview:
    'not-performed; no conclusion about stress, phonemes or naturalness',
  entries: lines,
};
await mkdir('artifacts/voice/station-06-20-speech-v3', { recursive: true });
await writeFile(
  'artifacts/voice/station-06-20-speech-v3/active-audit.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log({
  audited: report.lines,
  withLongQuietIntervals: report.withLongQuietIntervals,
});
