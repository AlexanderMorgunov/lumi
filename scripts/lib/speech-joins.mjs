// PCM s16le mono, 24 kHz. Only the quiet edges of independently recorded
// language fragments may be removed; internal pauses and speech are untouched.
export const joinPolicy = {
  version: 'quiet-edges-v2',
  sampleRate: 24000,
  peakLimit: 32, // below -60 dBFS, tested per sample, not an averaged envelope
  headGuardMs: 80,
  tailGuardMs: 100,
  minimumRemovalMs: 60,
};
const frames = (ms) => Math.round((ms * joinPolicy.sampleRate) / 1000);
export function quietEdges(pcm) {
  if (!Buffer.isBuffer(pcm) || pcm.length < 2 || pcm.length % 2)
    throw Error('Expected non-empty s16le PCM');
  const count = pcm.length / 2;
  let first = 0,
    end = count;
  while (
    first < count &&
    Math.abs(pcm.readInt16LE(first * 2)) <= joinPolicy.peakLimit
  )
    first++;
  if (first === count) return { leading: 0, trailing: 0, silent: true, count };
  while (
    end > first &&
    Math.abs(pcm.readInt16LE((end - 1) * 2)) <= joinPolicy.peakLimit
  )
    end--;
  return { leading: first, trailing: count - end, silent: false, count };
}
function targetMs(previous, next) {
  // rawText preserves punctuation in the displayed sentence; TTS's extra
  // full stop for isolated English words must not become a sentence break.
  const left = previous.trim().replace(/[»”"')]+$/g, '');
  if (/[.!?]$/.test(left)) return 300;
  if (/[,;:]$/.test(left) || /^\s*[—:;,]/.test(next)) return 220;
  return 180;
}
export function joinSpeech(parts) {
  if (!parts.length) throw Error('No speech fragments');
  const edges = parts.map((part) => quietEdges(part.pcm));
  const ranges = edges.map((edge) => ({ start: 0, end: edge.count }));
  const joins = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const left = edges[i],
      right = edges[i + 1];
    const before = left.trailing + right.leading + frames(60);
    const target = frames(targetMs(parts[i].rawText, parts[i + 1].rawText));
    let tail = 0,
      head = 0,
      gap = frames(60);
    // Never touch a quiet/ambiguous take, a short natural boundary, or any
    // interior sample of a fragment. Keep breathing room around speech.
    if (!left.silent && !right.silent && before > target + frames(80)) {
      tail = Math.max(0, left.trailing - frames(joinPolicy.tailGuardMs));
      head = Math.max(0, right.leading - frames(joinPolicy.headGuardMs));
      if (tail < frames(joinPolicy.minimumRemovalMs)) tail = 0;
      if (head < frames(joinPolicy.minimumRemovalMs)) head = 0;
      gap = Math.max(0, target - (left.trailing - tail + right.leading - head));
      ranges[i].end -= tail;
      ranges[i + 1].start += head;
    }
    joins.push({
      afterSegment: i,
      beforeMs: (before * 1000) / joinPolicy.sampleRate,
      afterMs:
        ((left.trailing - tail + right.leading - head + gap) * 1000) /
        joinPolicy.sampleRate,
      removedTailSamples: tail,
      removedHeadSamples: head,
      gapSamples: gap,
    });
  }
  const chunks = [];
  parts.forEach((part, i) => {
    const range = ranges[i];
    if (range.end <= range.start) throw Error('Unsafe empty speech range');
    chunks.push(part.pcm.subarray(range.start * 2, range.end * 2));
    if (joins[i]) chunks.push(Buffer.alloc(joins[i].gapSamples * 2));
  });
  return { pcm: Buffer.concat(chunks), ranges, joins, policy: joinPolicy };
}
