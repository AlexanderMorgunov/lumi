import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { joinSpeech } from './lib/speech-joins.mjs';

const batch = process.argv[2] ?? '16-20';
if (!['06-10', '11-15', '16-20'].includes(batch))
  throw Error('Expected 06-10, 11-15 or 16-20');
const root = `artifacts/voice/station-${batch}-elevenlabs-v1`;
const out = `artifacts/voice/station-${batch}-joins-v2`;
const plan = JSON.parse(
  await readFile(`docs/voice/station-${batch}-elevenlabs-plan.json`, 'utf8'),
);
const cache = new Map();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const job of plan.jobs) {
  const dir = `${root}/raw/${job.request.id}-${job.requestHash.slice(0, 16)}`;
  const receipt = JSON.parse(await readFile(`${dir}/receipt.json`, 'utf8'));
  if (
    receipt.status !== 'complete' ||
    receipt.requestHash !== job.requestHash ||
    receipt.files[0].sha256 !== hash(await readFile(`${dir}/speech.mp3`))
  )
    throw Error('Invalid raw take');
  cache.set(
    job.request.id,
    execFileSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-nostdin',
        '-i',
        `${dir}/speech.mp3`,
        '-ac',
        '1',
        '-ar',
        '24000',
        '-f',
        's16le',
        'pipe:1',
      ],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
    ),
  );
}
const lines = plan.entries.map((entry) => {
  const joined = joinSpeech(
    entry.segments.map((segment) => ({
      ...segment,
      pcm: cache.get(segment.jobId),
    })),
  );
  return {
    id: entry.id,
    text: entry.sourceText,
    speaker: entry.speaker,
    policy: joined.policy,
    ranges: joined.ranges,
    joins: joined.joins,
  };
});
const all = lines.flatMap((line) => line.joins);
const quantile = (values, q) =>
  values.toSorted((a, b) => a - b)[Math.floor((values.length - 1) * q)];
const summary = {
  lines: lines.length,
  boundaries: all.length,
  changedLines: lines.filter((line) =>
    line.joins.some((join) => join.beforeMs !== join.afterMs),
  ).length,
  before: {
    median: quantile(
      all.map((j) => j.beforeMs),
      0.5,
    ),
    p95: quantile(
      all.map((j) => j.beforeMs),
      0.95,
    ),
    max: Math.max(...all.map((j) => j.beforeMs)),
  },
  after: {
    median: quantile(
      all.map((j) => j.afterMs),
      0.5,
    ),
    p95: quantile(
      all.map((j) => j.afterMs),
      0.95,
    ),
    max: Math.max(...all.map((j) => j.afterMs)),
  },
  removedSeconds:
    all.reduce((sum, j) => sum + j.beforeMs - j.afterMs, 0) / 1000,
};
await mkdir(out, { recursive: true });
await writeFile(
  `${out}/audit.json`,
  JSON.stringify({ summary, lines }, null, 2) + '\n',
);
console.log(JSON.stringify(summary, null, 2));
