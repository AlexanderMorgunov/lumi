import files from './game-sfx.json';

export type GameEffect = keyof typeof files;
type Bus = 'ui' | 'world';
type Voice = { source: AudioBufferSourceNode; gain: GainNode; bus: Bus };

// Optional one-shot feedback. Neither decoding nor playback can block an action.
export function createGameEffects() {
  let context: AudioContext | undefined;
  let abort: AbortController | undefined;
  let live = false;
  let enabled = true;
  let blocked = false;
  let worldPaused = true;
  let speechActive = false;
  let epoch = 0;
  const versions = { ui: 0, world: 0 };
  const last = { ui: -Infinity, world: -Infinity };
  const lastId: Partial<Record<Bus, GameEffect>> = {};
  const buffers = new Map<GameEffect, Promise<AudioBuffer | undefined>>();
  const voices = new Set<Voice>();
  function release(voice: Voice) {
    voice.source.onended = null;
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
    voices.delete(voice);
  }
  function stop(bus?: Bus) {
    if (!bus || bus === 'ui') versions.ui++;
    if (!bus || bus === 'world') versions.world++;
    for (const voice of voices) if (!bus || voice.bus === bus) release(voice);
  }
  const volume = (bus: Bus) =>
    (bus === 'ui' ? 0.65 : 0.85) * (speechActive ? 0.25 : 1);
  return {
    mount() {
      live = true;
      const run = ++epoch;
      abort = new AbortController();
      try {
        context = new AudioContext({ latencyHint: 'interactive' });
      } catch {
        context = undefined;
      }
      if (context) {
        const decoder = context;
        for (const id of Object.keys(files) as GameEffect[]) {
          buffers.set(
            id,
            fetch(`${import.meta.env.BASE_URL}${files[id]}`, {
              signal: abort.signal,
            })
              .then(async (response) => {
                if (!response.ok || !live || epoch !== run) return undefined;
                const buffer = await decoder.decodeAudioData(
                  await response.arrayBuffer(),
                );
                return live && epoch === run ? buffer : undefined;
              })
              .catch(() => undefined),
          );
        }
      }
      return () => {
        live = false;
        epoch++;
        abort?.abort();
        stop();
        buffers.clear();
        if (context) void context.close().catch(() => {});
        context = undefined;
      };
    },
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) stop();
    },
    setBlocked(value: boolean) {
      blocked = value;
      if (value) stop();
    },
    setWorldPaused(value: boolean) {
      worldPaused = value;
      if (value) stop('world');
    },
    setSpeechActive(value: boolean) {
      speechActive = value;
      if (context)
        for (const voice of voices)
          voice.gain.gain.setTargetAtTime(
            volume(voice.bus),
            context.currentTime,
            0.025,
          );
    },
    stop,
    play(id: GameEffect, bus: Bus = 'world') {
      if (
        !live ||
        !enabled ||
        blocked ||
        document.hidden ||
        (bus === 'world' && worldPaused) ||
        !context
      )
        return;
      const now = performance.now();
      const footstep = id === 'step0' || id === 'step1';
      const previousFootstep =
        lastId[bus] === 'step0' || lastId[bus] === 'step1';
      if (
        now - last[bus] < 65 &&
        (bus === 'ui' || lastId[bus] === id || (footstep && previousFootstep))
      )
        return;
      last[bus] = now;
      lastId[bus] = id;
      const token = ++versions[bus];
      const run = epoch;
      const ctx = context;
      // Resume inside the user action; do not replay an old click after a slow download.
      void Promise.all([ctx.resume(), buffers.get(id)])
        .then(([, buffer]) => {
          if (
            !buffer ||
            !live ||
            !enabled ||
            blocked ||
            document.hidden ||
            epoch !== run ||
            versions[bus] !== token ||
            (bus === 'world' && worldPaused) ||
            ctx.state !== 'running' ||
            performance.now() - now > 350
          )
            return;
          if (voices.size >= 4) release(voices.values().next().value!);
          const source = ctx.createBufferSource();
          const gain = ctx.createGain();
          source.buffer = buffer;
          gain.gain.value = volume(bus);
          source.connect(gain);
          gain.connect(ctx.destination);
          const voice = { source, gain, bus };
          voices.add(voice);
          source.onended = () => {
            source.disconnect();
            gain.disconnect();
            voices.delete(voice);
          };
          source.start();
        })
        .catch(() => {});
    },
  };
}
