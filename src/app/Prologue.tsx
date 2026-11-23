import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import film from './prologue-film.json';
import soundscape from '../game/prologue-soundscape.json';
import { createPrologueSoundscape } from '../game/prologue-soundscape';
import './prologue.css';

export const art = `${import.meta.env.BASE_URL}art/`;
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export function LumiPortrait({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Люми — живой фонарь в кепке, с руками и ногами"
      className={'lumi-portrait ' + className}
    />
  );
}

function CutsceneMenu({
  scene,
  onDismiss,
  children,
}: {
  scene: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const target = scene.current;
    if (!dialog) return;
    dialog.showModal();
    const first = dialog.querySelector<HTMLButtonElement>(
      'button:not(:disabled)',
    );
    const heading = dialog.querySelector<HTMLHeadingElement>('h1');
    if (heading && (dialog.querySelector('.cutscene-story') || !first)) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    } else first?.focus();
    return () => {
      dialog.close();
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [scene]);
  return (
    <dialog
      ref={ref}
      className="cutscene-menu"
      aria-label="Пауза пролога"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      <div className="cutscene-menu-inner">{children}</div>
    </dialog>
  );
}

export function Prologue({
  suspended,
  onFinish,
  windowButton,
}: {
  suspended: boolean;
  onFinish: () => void;
  windowButton?: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const background = useRef<ReturnType<typeof createPrologueSoundscape>>(null);
  const scene = useRef<HTMLElement>(null);
  const allowedToPlay = useRef(false);
  const finished = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [music, setMusic] = useState(true);
  const [effects, setEffects] = useState(true);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reading, setReading] = useState(false);
  const menu = !playing || suspended || reading || failed;
  const cue = film.cues.find((item) => time >= item.start && time < item.end);

  useEffect(() => {
    const element = video.current;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    if (element) {
      background.current = createPrologueSoundscape(
        element,
        {
          music: asset(soundscape.music),
          effects: asset(soundscape.effects),
        },
        () => setAudioUnavailable(true),
      );
      element.src = asset(film.video);
    }
    allowedToPlay.current = !preference.matches;
    if (allowedToPlay.current) void element?.play().catch(() => {});
    const reduce = () => {
      if (preference.matches) {
        allowedToPlay.current = false;
        background.current?.pause();
        element?.pause();
      }
    };
    preference.addEventListener('change', reduce);
    return () => {
      preference.removeEventListener('change', reduce);
      background.current?.dispose();
      background.current = null;
      if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, []);

  useEffect(() => {
    background.current?.setSuspended(suspended);
    if (suspended) {
      allowedToPlay.current = false;
      video.current?.pause();
    }
  }, [suspended]);

  useEffect(() => {
    background.current?.setEnabled('music', music);
  }, [music]);
  useEffect(() => {
    background.current?.setEnabled('effects', effects);
  }, [effects]);

  function finish() {
    if (suspended || finished.current) return;
    finished.current = true;
    allowedToPlay.current = false;
    background.current?.pause();
    video.current?.pause();
    onFinish();
  }
  function pause() {
    allowedToPlay.current = false;
    background.current?.pause();
    video.current?.pause();
    setPlaying(false);
  }
  function resume() {
    if (suspended || failed) return;
    if (video.current?.ended) {
      finish();
      return;
    }
    allowedToPlay.current = true;
    background.current?.unlock();
    void video.current?.play().catch(() => {});
  }

  return (
    <section
      ref={scene}
      className="prologue-film"
      aria-label="Вступление"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (
          menu ||
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        if (
          event.key === 'Escape' ||
          (event.code === 'Space' && event.target === event.currentTarget)
        ) {
          event.preventDefault();
          event.stopPropagation();
          pause();
        }
      }}
    >
      <video
        ref={video}
        src={asset(film.video)}
        poster={asset(film.poster)}
        preload="metadata"
        playsInline
        muted={muted}
        aria-label="Пролог: Люми и дорога огней"
        aria-describedby="prologue-transcript"
        onPlay={(event) => {
          if (suspended || !allowedToPlay.current) {
            event.currentTarget.pause();
            return;
          }
          setStarted(true);
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onEnded={finish}
        onError={() => {
          allowedToPlay.current = false;
          background.current?.pause();
          setFailed(true);
          setPlaying(false);
        }}
      />
      {!menu && (
        <button className="cutscene-pause" aria-label="Пауза" onClick={pause}>
          <span aria-hidden="true">Ⅱ</span>
          <kbd aria-hidden="true">Esc</kbd>
        </button>
      )}
      {captions && !menu && (
        <p className="film-caption" aria-hidden="true">
          {cue?.text ?? ''}
        </p>
      )}
      <div className="sr-only" id="prologue-transcript">
        {film.story.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
      {menu && (
        <CutsceneMenu
          key={reading || failed ? 'story' : 'pause'}
          scene={scene}
          onDismiss={() => {
            if (reading) setReading(false);
            else resume();
          }}
        >
          <span className="cutscene-eyebrow">
            {started ? 'Пролог · Пауза' : 'Пролог'}
          </span>
          <div className="cutscene-title">
            <h1>Дорога огней</h1>
            {windowButton}
          </div>
          {failed && (
            <p className="cutscene-note" role="alert">
              Не удалось загрузить ролик. Историю можно прочитать здесь и
              продолжить игру.
            </p>
          )}
          {suspended && (
            <p className="cutscene-note" role="status">
              Игра приостановлена.
            </p>
          )}
          {reading || failed ? (
            <>
              <div className="cutscene-story">
                {film.story.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
              {!failed && (
                <button
                  className="cutscene-primary"
                  onClick={() => setReading(false)}
                >
                  Назад
                </button>
              )}
              <button
                className={failed ? 'cutscene-primary' : 'cutscene-link'}
                disabled={suspended}
                onClick={finish}
              >
                Продолжить игру
              </button>
            </>
          ) : (
            <>
              <button
                className="cutscene-primary"
                disabled={suspended}
                onClick={resume}
              >
                {started ? 'Продолжить' : 'Смотреть историю'}
              </button>
              <div className="cutscene-settings">
                <label>
                  Музыка
                  <input
                    type="checkbox"
                    checked={music}
                    onChange={(event) => setMusic(event.target.checked)}
                  />
                </label>
                <label>
                  Звуки окружения
                  <input
                    type="checkbox"
                    checked={effects}
                    onChange={(event) => setEffects(event.target.checked)}
                  />
                </label>
                <label>
                  Голос рассказчика
                  <input
                    type="checkbox"
                    checked={!muted}
                    onChange={(event) => setMuted(!event.target.checked)}
                  />
                </label>
                <label>
                  Субтитры
                  <input
                    type="checkbox"
                    checked={captions}
                    onChange={(event) => setCaptions(event.target.checked)}
                  />
                </label>
              </div>
              {audioUnavailable && (
                <p className="cutscene-note" role="status">
                  Часть фоновых звуков недоступна. Историю можно смотреть
                  дальше.
                </p>
              )}
              <button
                className="cutscene-link"
                onClick={() => setReading(true)}
              >
                Текст истории
              </button>
              <button
                className="cutscene-link"
                disabled={suspended}
                onClick={finish}
              >
                Пропустить пролог
              </button>
            </>
          )}
        </CutsceneMenu>
      )}
    </section>
  );
}
