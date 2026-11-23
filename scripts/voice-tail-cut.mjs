// A character timestamp is only a search hint. The actual cut must be in a
// verified quiet gap; keep the entire remaining waveform, including its tail.
export function validateTailCut({
  cut,
  requestHash,
  audioSha256,
  alignmentSha256,
  alignment,
  text,
  pcm,
  sampleRate = 24000,
}) {
  if (
    !cut ||
    cut.requestHash !== requestHash ||
    cut.audioSha256 !== audioSha256 ||
    cut.alignmentSha256 !== alignmentSha256
  )
    throw new Error('Tail cut does not match the verified source');
  if (alignment.characters.join('') !== text || !text.endsWith('... I.'))
    throw new Error('Unexpected tail carrier');
  const index = text.lastIndexOf('I');
  const prior = text.indexOf('...') - 1;
  const previousEnd = alignment.character_end_times_seconds[prior];
  const wordStart = alignment.character_start_times_seconds[index];
  const wordEnd = alignment.character_end_times_seconds[index];
  const end = pcm.length / (sampleRate * 2);
  const start = cut.start;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(previousEnd) ||
    !Number.isFinite(wordStart) ||
    !Number.isFinite(wordEnd) ||
    !(
      start > previousEnd + 0.06 &&
      start < wordStart - 0.04 &&
      end >= wordEnd &&
      end - start >= 0.3 &&
      end - start < 2
    )
  )
    throw new Error('Unsafe tail cut range');
  const first = Math.floor((start - 0.04) * sampleRate);
  const last = Math.ceil((start + 0.04) * sampleRate);
  let peak = 0;
  for (let i = first; i < last; i++)
    peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)) / 32768);
  if (peak > 10 ** (-45 / 20)) throw new Error('Tail boundary is not quiet');
  return {
    start,
    end,
    audioSha256,
    alignmentSha256,
    boundaryPeakDb: peak ? 20 * Math.log10(peak) : -120,
    method: 'quiet-gap-to-end-no-silence-trimming',
  };
}
