export type SoundscapeLayer = 'music' | 'effects';
type Track = {
  enabled: boolean;
  buffer?: AudioBuffer;
  source?: AudioBufferSourceNode;
  startedAt: number;
  offset: number;
  rate: number;
};

// The video owns time. Background buffers never continue independently of it.
export function createPrologueSoundscape(
  video: HTMLVideoElement,
  urls: Record<SoundscapeLayer, string>,
  onUnavailable: (layer: SoundscapeLayer) => void,
) {
  const abort = new AbortController();
  let context: AudioContext | undefined;
  let live = true;
  let suspended = false;
  let waiting = true;
  const tracks: Record<SoundscapeLayer, Track> = {
    music: { enabled: true, startedAt: 0, offset: 0, rate: 1 },
    effects: { enabled: true, startedAt: 0, offset: 0, rate: 1 },
  };
  const layers: SoundscapeLayer[] = ['music', 'effects'];
  const reported = new Set<SoundscapeLayer>();
  function unavailable(layer: SoundscapeLayer) {
    if (!live || reported.has(layer)) return;
    reported.add(layer);
    onUnavailable(layer);
  }
  function stop(track: Track) {
    if (!track.source) return;
    track.source.onended = null;
    track.source.stop();
    track.source.disconnect();
    track.source = undefined;
  }
  function stopAll() {
    layers.forEach((layer) => stop(tracks[layer]));
  }
  function sync(force = false) {
    if (
      !live ||
      suspended ||
      waiting ||
      video.paused ||
      video.ended ||
      context?.state !== 'running'
    ) {
      stopAll();
      return;
    }
    for (const layer of layers) {
      const track = tracks[layer];
      if (!track.enabled || !track.buffer) {
        stop(track);
        continue;
      }
      const offset = Math.max(0, video.currentTime);
      const drift =
        track.offset +
        (context.currentTime - track.startedAt) * track.rate -
        offset;
      if (track.source && (force || Math.abs(drift) > 0.2)) stop(track);
      if (track.source || offset >= track.buffer.duration) continue;
      const source = context.createBufferSource();
      source.buffer = track.buffer;
      source.playbackRate.value = video.playbackRate;
      source.connect(context.destination);
      track.source = source;
      track.startedAt = context.currentTime;
      track.offset = offset;
      track.rate = video.playbackRate;
      source.onended = () => {
        source.disconnect();
        if (track.source === source) track.source = undefined;
      };
      source.start(0, offset);
    }
  }
  function unlock() {
    if (!live || suspended || !context) return;
    void context
      .resume()
      .then(() => sync())
      .catch(() => {
        layers.forEach(unavailable);
      });
  }
  function pause() {
    waiting = true;
    stopAll();
  }
  const playing = () => {
    waiting = false;
    unlock();
    sync();
  };
  const seeked = () => {
    waiting = video.readyState < 3;
    sync(true);
  };
  const tick = () => sync();
  const rate = () => sync(true);
  const events: [string, () => void][] = [
    ['playing', playing],
    ['pause', pause],
    ['waiting', pause],
    ['seeking', pause],
    ['seeked', seeked],
    ['ended', pause],
    ['timeupdate', tick],
    ['ratechange', rate],
  ];
  try {
    context = new AudioContext({ latencyHint: 'playback' });
  } catch {
    queueMicrotask(() => layers.forEach(unavailable));
  }
  events.forEach(([event, callback]) =>
    video.addEventListener(event, callback),
  );
  if (context) {
    const decoder = context;
    for (const layer of layers) {
      void fetch(urls[layer], { signal: abort.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Missing background audio');
          const buffer = await decoder.decodeAudioData(
            await response.arrayBuffer(),
          );
          if (!live) return;
          tracks[layer].buffer = buffer;
          sync();
        })
        .catch(() => {
          if (!abort.signal.aborted) unavailable(layer);
        });
    }
  }
  return {
    unlock,
    pause,
    setSuspended(value: boolean) {
      suspended = value;
      if (value) pause();
    },
    setEnabled(layer: SoundscapeLayer, value: boolean) {
      tracks[layer].enabled = value;
      if (!value) stop(tracks[layer]);
      else sync();
    },
    dispose() {
      live = false;
      abort.abort();
      events.forEach(([event, callback]) =>
        video.removeEventListener(event, callback),
      );
      stopAll();
      if (context) void context.close().catch(() => {});
    },
  };
}
