import cues from './cat-mouth-cues.json';
import stationCues from './station-mouth-cues.json';

export type CatMouth = 'rest' | 'closed' | 'open';
type CueCollection = {
  step: number;
  clips: readonly { file: string; frames: string }[];
};
let catTimeline: CueCollection = cues;
let stationTimeline: CueCollection = stationCues;
const clips = new Map<string, { frames: string; step: number }>();
function refreshTimelines() {
  clips.clear();
  for (const timeline of [catTimeline, stationTimeline])
    for (const clip of timeline.clips)
      clips.set(clip.file, { frames: clip.frames, step: timeline.step });
}
refreshTimelines();

// React Fast Refresh preserves the audio service in useState, including its
// reference to this function. Update its existing map when authoring new audio.
if (import.meta.hot) {
  function readUpdate(module: unknown): CueCollection {
    const value =
      module && typeof module === 'object' && 'default' in module
        ? module.default
        : null;
    if (
      !value ||
      typeof value !== 'object' ||
      !('step' in value) ||
      typeof value.step !== 'number' ||
      !Number.isFinite(value.step) ||
      value.step <= 0 ||
      !('clips' in value) ||
      !Array.isArray(value.clips) ||
      !value.clips.every(
        (clip: unknown) =>
          clip &&
          typeof clip === 'object' &&
          'file' in clip &&
          typeof clip.file === 'string' &&
          'frames' in clip &&
          typeof clip.frames === 'string' &&
          /^[01]+$/.test(clip.frames),
      )
    )
      throw new Error('Invalid updated mouth timeline');
    return value as CueCollection;
  }
  import.meta.hot.accept(
    ['./cat-mouth-cues.json', './station-mouth-cues.json'],
    (updates: readonly unknown[]) => {
      const nextCat =
        updates[0] === undefined ? catTimeline : readUpdate(updates[0]);
      const nextStation =
        updates[1] === undefined ? stationTimeline : readUpdate(updates[1]);
      catTimeline = nextCat;
      stationTimeline = nextStation;
      refreshTimelines();
    },
  );
}

export function catMouthAt(file: string, seconds: number): CatMouth {
  if (!Number.isFinite(seconds) || seconds < 0) return 'rest';
  const clip = clips.get(file);
  const frame = clip?.frames[Math.floor(seconds / clip.step)];
  return frame === '1' ? 'open' : frame === '0' ? 'closed' : 'rest';
}
