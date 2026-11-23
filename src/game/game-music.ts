import files from './game-music.json';

export type MusicTrack = keyof typeof files;

// One streaming player: menu/map share time; a track change fades out before
// swapping the file. Long music is never decoded wholesale into Web Audio RAM.
export function createGameMusic() {
  let player: HTMLAudioElement | undefined;
  let context: AudioContext | undefined;
  let source: MediaElementAudioSourceNode | undefined;
  let gain: GainNode | undefined;
  let live = false;
  let unlocked = false;
  let enabled = true;
  let blocked = false;
  let speechActive = false;
  let target: MusicTrack | null = null;
  let current: MusicTrack | null = null;
  let transition: ReturnType<typeof setTimeout> | undefined;
  const positions: Partial<Record<MusicTrack, number>> = {};
  const allowed = () =>
    live &&
    unlocked &&
    enabled &&
    !blocked &&
    !document.hidden &&
    target !== null;
  const volume = () => 0.65 * (speechActive ? 0.25 : 1);
  function level(value: number, seconds = 0.5) {
    if (!gain || !context) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + seconds);
  }
  function stop() {
    clearTimeout(transition);
    transition = undefined;
    if (player) {
      if (current && Number.isFinite(player.currentTime))
        positions[current] = player.currentTime;
      player.pause();
    }
    level(0, 0);
  }
  function play() {
    if (!player || !allowed()) return;
    if (player.paused) void player.play().catch(() => {});
    // Rejected autoplay is retried by the next user gesture, never by a timer.
  }
  function loadTarget() {
    if (!player || !allowed() || !target) return;
    stop();
    current = target;
    player.src = `${import.meta.env.BASE_URL}${files[current]}`;
    play();
  }
  function sync() {
    if (!allowed()) {
      stop();
      return;
    }
    if (current === target) {
      clearTimeout(transition);
      transition = undefined;
      level(volume());
      play();
    } else if (!transition) {
      if (!current || player?.paused) loadTarget();
      else {
        level(0, 0.25);
        transition = setTimeout(() => {
          transition = undefined;
          loadTarget();
        }, 260);
      }
    }
  }
  return {
    mount() {
      live = true;
      player = new Audio();
      player.loop = true;
      player.preload = 'none';
      player.onloadedmetadata = () => {
        if (player && current)
          player.currentTime = Math.min(
            positions[current] ?? 0,
            Math.max(0, player.duration - 0.1),
          );
      };
      player.onplaying = () => {
        if (!allowed()) stop();
        // A late playing event from the outgoing file must not cancel the
        // scheduled switch to the requested track.
        else if (current !== target) sync();
        else level(volume(), 0.8);
      };
      document.addEventListener('visibilitychange', sync);
      return () => {
        live = false;
        unlocked = false;
        stop();
        document.removeEventListener('visibilitychange', sync);
        if (player) {
          player.onplaying = null;
          player.onloadedmetadata = null;
          player.removeAttribute('src');
          player.load();
        }
        source?.disconnect();
        gain?.disconnect();
        if (context) void context.close().catch(() => {});
        context = undefined;
        source = undefined;
        gain = undefined;
        player = undefined;
        current = null;
      };
    },
    unlock() {
      if (!live || !player || blocked || document.hidden || !enabled || !target)
        return;
      if (!context) {
        try {
          context = new AudioContext({ latencyHint: 'playback' });
          source = context.createMediaElementSource(player);
          gain = context.createGain();
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(context.destination);
        } catch {
          return;
        }
      }
      if (!source || !gain) return;
      unlocked = true;
      void context.resume().catch(() => {});
      // Both resume and play run in the input gesture, including on touch devices.
      sync();
    },
    setTrack(value: MusicTrack | null) {
      target = value;
      sync();
    },
    setEnabled(value: boolean) {
      enabled = value;
      sync();
    },
    setBlocked(value: boolean) {
      blocked = value;
      sync();
    },
    setSpeechActive(value: boolean) {
      speechActive = value;
      if (allowed() && current === target) level(volume(), value ? 0.15 : 0.7);
    },
  };
}
