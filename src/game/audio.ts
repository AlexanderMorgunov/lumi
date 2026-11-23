import { pronunciationRecording } from '../domain/pronunciation';
import { catMouthAt, type CatMouth } from './cat-mouth';

export type SpeechState = {
  playing: string | null;
  message: string;
  voice: string;
  effects: boolean;
  catEnabled: boolean;
  catPlaying: string | null;
  catMessage: string;
};
export function selectEnglishVoice(voices: readonly SpeechSynthesisVoice[]) {
  const english = voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang));
  return (
    english.find(
      (voice) => voice.localService && /^en-GB$/i.test(voice.lang),
    ) ??
    english.find((voice) => voice.localService) ??
    english.find((voice) => /^en-GB$/i.test(voice.lang)) ??
    english[0]
  );
}
// One foreground voice: manual English pronunciation interrupts the cat.
export function createGameAudio() {
  let state: SpeechState = {
    playing: null,
    message: '',
    voice: '',
    effects: true,
    catEnabled: true,
    catPlaying: null,
    catMessage: '',
  };
  const listeners = new Set<() => void>();
  const speech =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  let generation = 0;
  let active = false;
  let utterance: SpeechSynthesisUtterance | null = null;
  let recording: HTMLAudioElement | null = null;
  let catFile: string | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function publish(update: Partial<SpeechState>) {
    state = { ...state, ...update };
    listeners.forEach((listener) => listener());
  }
  function stop() {
    generation++;
    catFile = null;
    clearTimeout(timeout);
    if (recording) {
      recording.onended = null;
      recording.onerror = null;
      recording.pause();
      recording.removeAttribute('src');
      recording.load();
      recording = null;
    }
    if (utterance) {
      utterance.onend = null;
      utterance.onerror = null;
      utterance.onstart = null;
      utterance = null;
      speech?.cancel();
    }
    if (state.playing)
      publish({ playing: null, message: 'Воспроизведение остановлено.' });
    if (state.catPlaying) publish({ catPlaying: null, catMessage: '' });
  }
  function voicesChanged() {
    if (!active) return;
    if (recording) return;
    publish({ voice: 'en-US · Lessac, синтезированная запись Piper' });
  }
  return {
    getSnapshot: () => state,
    getCatMouth(): CatMouth {
      if (
        !active ||
        !state.catEnabled ||
        !state.catPlaying ||
        !catFile ||
        !recording ||
        recording.paused ||
        recording.ended ||
        recording.seeking ||
        recording.muted ||
        recording.volume === 0 ||
        recording.readyState < 3
      )
        return 'rest';
      return catMouthAt(catFile, recording.currentTime);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    mount() {
      active = true;
      speech?.addEventListener('voiceschanged', voicesChanged);
      voicesChanged();
      return () => {
        active = false;
        stop();
        speech?.removeEventListener('voiceschanged', voicesChanged);
      };
    },
    stop,
    resetSpeech() {
      if (recording || utterance || state.playing || state.catPlaying) stop();
      publish({ playing: null, message: '', catMessage: '' });
    },
    setCatEnabled(value: boolean) {
      if (!value && state.catPlaying) stop();
      publish({ catEnabled: value, catMessage: '' });
    },
    playCat(clip: { id: string; file: string; duration: number }) {
      if (!active || !state.catEnabled) return;
      stop();
      const token = generation;
      const player = new Audio(`${import.meta.env.BASE_URL}${clip.file}`);
      recording = player;
      catFile = clip.file;
      const finish = (message: string) => {
        if (token !== generation || !active) return;
        clearTimeout(timeout);
        player.onended = null;
        player.onerror = null;
        player.pause();
        player.removeAttribute('src');
        player.load();
        recording = null;
        catFile = null;
        publish({ catPlaying: null, catMessage: message });
      };
      player.onended = () => finish('');
      player.onerror = () =>
        finish('Запись недоступна. Можно читать или повторить.');
      publish({ catPlaying: clip.id, catMessage: '' });
      // Lessons can be much longer than the 15-second vocabulary timeout.
      timeout = setTimeout(
        () => finish('Запись не ответила. Попробуй повторить.'),
        Math.max(30000, (clip.duration + 20) * 1000),
      );
      void player
        .play()
        .catch(() => finish('Нажми «Повторить реплику», чтобы включить звук.'));
    },
    setEffects(value: boolean) {
      publish({ effects: value });
    },
    speak(text: string, slow = false) {
      stop();
      const clip = pronunciationRecording(text);
      if (active && clip) {
        const token = generation;
        const player = new Audio(`${import.meta.env.BASE_URL}${clip.file}`);
        recording = player;
        player.playbackRate = slow ? 0.75 : 1;
        player.preservesPitch = true;
        const finish = (message: string) => {
          if (token !== generation || !active) return;
          clearTimeout(timeout);
          player.onended = null;
          player.onerror = null;
          recording = null;
          publish({ playing: null, message });
        };
        player.onended = () => finish('Можно послушать ещё раз.');
        player.onerror = () =>
          finish(
            'Не удалось загрузить произношение. Проверь соединение и попробуй ещё раз.',
          );
        publish({
          playing: text,
          message: `Слушаем: ${text}${slow ? ' · медленно' : ''}`,
          voice: clip.voice,
        });
        timeout = setTimeout(() => {
          if (token === generation) {
            stop();
            publish({ message: 'Запись не ответила. Попробуй ещё раз.' });
          }
        }, 15000);
        void player
          .play()
          .catch(() =>
            finish('Браузер не запустил звук. Нажми «Послушать» ещё раз.'),
          );
        return;
      }
      if (
        !active ||
        !speech ||
        typeof SpeechSynthesisUtterance === 'undefined'
      ) {
        publish({
          message:
            'В этом браузере произношение недоступно. Перевод и правило можно прочитать.',
        });
        return;
      }
      const voice = selectEnglishVoice(speech.getVoices());
      if (!voice) {
        publish({
          message:
            'Английский голос пока недоступен. Включи английский голос в настройках устройства и повтори.',
        });
        return;
      }
      const token = generation;
      utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = slow ? 0.7 : 0.95;
      const finish = (message: string) => {
        if (token !== generation || !active) return;
        clearTimeout(timeout);
        utterance = null;
        publish({ playing: null, message });
      };
      utterance.onend = () => finish('Можно послушать ещё раз.');
      utterance.onerror = () =>
        finish(
          'Не удалось воспроизвести. Попробуй ещё раз или проверь английский голос устройства.',
        );
      publish({
        playing: text,
        message: `Слушаем: ${text}${slow ? ' · медленно' : ''}`,
        voice: `${voice.lang} · ${voice.name}`,
      });
      timeout = setTimeout(() => {
        if (token === generation) {
          stop();
          publish({ message: 'Голос не ответил. Попробуй ещё раз.' });
        }
      }, 15000);
      try {
        speech.speak(utterance);
      } catch {
        stop();
        publish({
          message: 'Браузер не запустил произношение. Попробуй ещё раз.',
        });
      }
    },
  };
}
export type GameAudio = ReturnType<typeof createGameAudio>;
