import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  chapterOneStops,
  chapterTwoStops,
  journeyChapters,
  stopStatus,
} from '../domain/journey';
import { episodes, type EpisodeId } from '../domain/episodes';
import type { SessionSnapshot } from '../game/session';
import './journey.css';

// Wide scenery uses a 1536 × 700 window starting at y=160 in the original.
// Portrait is a separate painting; the lesson order and state remain identical.
const wideAnchors = [
  [25, 70],
  [40, 67],
  [55, 68],
  [70, 67],
  [89, 59],
  [81, 47],
  [64, 45],
  [47, 44],
  [28, 43],
  [38, 31],
  [55, 31],
  [73, 29],
] as const;
const portraitAnchors = [
  [33, 83],
  [56, 82],
  [80, 78],
  [79, 57],
  [53, 57],
  [25, 56],
  [24, 40],
  [51, 40],
  [79, 39],
  [79, 24],
  [53, 23],
  [27, 23],
] as const;
const stationAnchors = [
  [8, 90, 14, 87],
  [17, 86, 32, 81],
  [26, 82, 53, 80],
  [35, 79, 75, 79],
  [44, 76, 90, 72],
  [53, 73, 82, 64],
  [62, 70, 61, 63],
  [71, 66, 40, 63],
  [80, 62, 19, 62],
  [89, 56, 13, 54],
  [92, 43, 33, 52],
  [83, 41, 54, 52],
  [74, 41, 75, 52],
  [65, 41, 89, 48],
  [56, 41, 76, 42],
  [47, 41, 56, 42],
  [38, 39, 36, 41],
  [29, 36, 16, 39],
  [57, 20, 30, 34],
  [65, 23, 52, 34],
] as const;
const drops = Array.from(
  { length: 42 },
  (_, i) =>
    ({
      '--drop-x': `${(i * 37) % 105}%`,
      '--drop-y': `${(i * 23) % 100}%`,
      '--fall-time': `${0.85 + (i % 7) * 0.13}s`,
      '--fall-delay': `-${i * 0.37}s`,
    }) as CSSProperties,
);

function RoadLantern({ lit }: { lit: boolean }) {
  return (
    <img
      className="road-lamp"
      src={`${import.meta.env.BASE_URL}art/journey/road-lantern-${lit ? 'lit' : 'unlit'}-v1.webp`}
      alt=""
      draggable={false}
    />
  );
}

// This nested native dialog owns focus, not the session's pause reason. The map
// already owns that reason; closing a preview must never resume the puzzle.
function EpisodePreview({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="episode-preview"
      aria-labelledby="episode-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      {children}
    </dialog>
  );
}

export function JourneyMap({
  snapshot,
  onEnter,
  onDevEnter,
  onClose,
  onBack,
  fromTitle = false,
}: {
  snapshot: SessionSnapshot;
  onEnter: (id: EpisodeId) => void;
  onDevEnter?: (id: EpisodeId) => void;
  onClose: () => void;
  onBack?: () => void;
  fromTitle?: boolean;
}) {
  const [chapter, setChapter] = useState(
    snapshot.room.definition.message ? 1 : 0,
  );
  const current = (chapter === 1 ? chapterTwoStops : chapterOneStops).findIndex(
    (stop) => stop.ids.includes(snapshot.room.episode),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const location = journeyChapters[chapter]!;
  const stop =
    selected === null
      ? null
      : chapter === 1
        ? chapterTwoStops[selected]!
        : chapterOneStops[selected]!;
  const status = stop
    ? stopStatus(stop, snapshot.unlockedEpisodes, snapshot.completedEpisodes)
    : null;
  const playable =
    stop?.ids.filter((id) => snapshot.unlockedEpisodes.includes(id)) ?? [];
  const completed = chapterOneStops.filter(
    (item) =>
      stopStatus(
        item,
        snapshot.unlockedEpisodes,
        snapshot.completedEpisodes,
      ) === 'completed',
  ).length;
  const weather =
    snapshot.closed || snapshot.externallyPaused
      ? 'paused'
      : !snapshot.view.animations || snapshot.view.reducedMotion
        ? 'still'
        : 'rain';

  return (
    <div className="journey-overview" data-weather={weather}>
      <header className="overview-heading">
        <div>
          <h2>Карта фонарей</h2>
          <p>
            Глава {chapter + 1} · {location.topic}
          </p>
        </div>
        <label>
          <span className="sr-only">Глава путешествия</span>
          <select
            value={chapter}
            onChange={(event) => {
              setChapter(Number(event.target.value));
              setSelected(null);
            }}
          >
            {journeyChapters.map((item, i) => (
              <option key={item.title} value={i}>
                {i + 1}. {item.title}
              </option>
            ))}
          </select>
        </label>
        {onBack && (
          <button
            className="journey-back"
            aria-label="Назад в меню"
            onClick={onBack}
          >
            ← Меню
          </button>
        )}
        <button className={onBack ? 'journey-dismiss' : ''} onClick={onClose}>
          {fromTitle ? 'В главное меню' : 'Вернуться к игре'}
        </button>
      </header>
      {chapter === 1 ? (
        <div className="station-map" aria-label="Эпизоды второй главы">
          <div className="rain-layer" aria-hidden="true">
            {drops.map((style, i) => (
              <i key={i} style={style} />
            ))}
          </div>
          <div className="station-map-title">
            <span className="eyebrow">ГЛАВА II</span>
            <h3>Станция встреч</h3>
            <p>
              {snapshot.unlockedEpisodes.includes('chapter-02-01')
                ? 'Группы, готовность и первые вопросы'
                : 'Путь откроется после финала мастерской'}
            </p>
          </div>
          {chapterTwoStops.map((item, i) => {
            const [x, y, px, py] = stationAnchors[i]!;
            const state = stopStatus(
              item,
              snapshot.unlockedEpisodes,
              snapshot.completedEpisodes,
            );
            return (
              <button
                key={item.title}
                className={`lantern-stop ${state}`}
                data-stop={i + 1}
                style={
                  {
                    '--x': `${x}%`,
                    '--y': `${y}%`,
                    '--px': `${px}%`,
                    '--py': `${py}%`,
                    '--compact-y': `${i === 9 ? 65 : i >= 18 ? 19 : y}%`,
                  } as CSSProperties
                }
                data-side={x > 60 || px > 70 ? 'left' : 'right'}
                aria-label={`Эпизод ${i + 1}: ${item.title}. ${state === 'completed' ? 'Завершён' : state === 'available' ? 'Доступен' : 'Закрыт'}`}
                aria-current={
                  item.ids.includes(snapshot.room.episode) ? 'step' : undefined
                }
                aria-haspopup="dialog"
                aria-expanded={selected === i}
                onClick={() => setSelected(i)}
              >
                <RoadLantern lit={state === 'completed'} />
                <span className="road-number">
                  {state === 'completed' ? '✓ ' : ''}
                  {i + 1}
                </span>
                {item.ids.includes(snapshot.room.episode) && (
                  <span className="road-lumi" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      ) : location.available ? (
        <div className="overview-scene" aria-label="Эпизоды первой главы">
          <div className="rain-layer" aria-hidden="true">
            {drops.map((style, i) => (
              <i key={i} style={style} />
            ))}
          </div>
          {chapterOneStops.map((item, i) => {
            const state = stopStatus(
              item,
              snapshot.unlockedEpisodes,
              snapshot.completedEpisodes,
            );
            const [x, y] = wideAnchors[i]!;
            const [px, py] = portraitAnchors[i]!;
            const style = {
              '--x': `${x}%`,
              '--y': `${(y * 10.24 - 160) / 7}%`,
              '--px': `${px}%`,
              '--py': `${py}%`,
            } as CSSProperties;
            return (
              <button
                key={item.title}
                className={`lantern-stop ${state}`}
                style={style}
                data-side={x > 70 || px > 70 ? 'left' : 'right'}
                aria-haspopup="dialog"
                aria-expanded={selected === i}
                aria-current={i === current ? 'step' : undefined}
                aria-label={`Эпизод ${i + 1}: ${item.title}. ${state === 'completed' ? 'Завершён' : state === 'available' ? 'Доступен' : 'Закрыт'}`}
                onClick={() => setSelected(i)}
              >
                <RoadLantern lit={state === 'completed'} />
                <span className="road-number" aria-hidden="true">
                  {state === 'completed' ? '✓ ' : ''}
                  {i + 1}
                </span>
                {i === current && (
                  <>
                    <span className="road-lumi" aria-hidden="true" />
                    <span className="road-here" aria-hidden="true">
                      Люми здесь
                    </span>
                  </>
                )}
              </button>
            );
          })}
          <button
            className="overview-gate"
            onClick={() => {
              setChapter(1);
              setSelected(null);
            }}
          >
            Станция встреч →
          </button>
        </div>
      ) : (
        <section className="overview-future">
          <p className="eyebrow">ГЛАВА {chapter + 1} · ГОТОВИТСЯ</p>
          <h3>{location.title}</h3>
          <p className="journey-topic">{location.topic}</p>
          <p>{location.description}</p>
          <p>Этот огонь ещё впереди</p>
          <button onClick={() => setChapter(0)}>К первой главе</button>
        </section>
      )}
      <footer className="overview-footer">
        <p>
          {chapter === 1
            ? `${chapterTwoStops.filter((item) => item.ids.every((id) => snapshot.completedEpisodes.includes(id))).length} из ${chapterTwoStops.length} эпизодов завершено · следующая глава готовится`
            : location.available
              ? `${completed} из 12 эпизодов завершено`
              : 'Задания главы ещё готовятся'}
        </p>
        <p className="overview-tip">Нажми фонарь — узнай тему</p>
        {chapter === 0 && current >= 0 && (
          <button onClick={() => setSelected(current)}>К фонарю Люми</button>
        )}
        <button
          className="overview-info"
          aria-label="О карте и сохранении прогресса"
          onClick={() => setShowInfo(true)}
        >
          ?
        </button>
      </footer>
      {stop && selected !== null && (
        <EpisodePreview onClose={() => setSelected(null)}>
          <div className="preview-heading">
            <p>
              {chapter === 1
                ? `ГЛАВА II · ЭПИЗОД ${selected + 1}`
                : `ЭПИЗОД ${selected + 1} / 12`}
            </p>
            <button
              onClick={() => setSelected(null)}
              aria-label="Закрыть описание эпизода"
            >
              ×
            </button>
          </div>
          <h3 id="episode-preview-title" tabIndex={-1}>
            {stop.title}
          </h3>
          <p className="journey-topic">{stop.topic}</p>
          <p className="road-state">
            {status === 'locked'
              ? chapter === 1 && selected === 0
                ? 'Заверши финальный эпизод мастерской и объясни выбор артиклей — откроется дорога к станции.'
                : 'Пока погас. Откроется после предыдущего эпизода и объяснения смысла.'
              : status === 'completed'
                ? '✦ Фонарь зажжён. Можно вернуться и повторить.'
                : selected === current
                  ? 'Люми ждёт здесь. Зажжём этот фонарь?'
                  : 'Путь открыт. Этот фонарь ещё предстоит зажечь.'}
          </p>
          <div className="preview-actions">
            {playable.length ? (
              playable.map((id) => (
                <button
                  key={id}
                  className="primary"
                  disabled={snapshot.closed || snapshot.externallyPaused}
                  onClick={() => onEnter(id)}
                >
                  {stop.ids.length > 1
                    ? id === 'choiceKey'
                      ? 'Просьба о ключе'
                      : 'Просьба о яблоке'
                    : id === snapshot.room.episode
                      ? 'Продолжить эпизод'
                      : 'Перейти к эпизоду'}
                </button>
              ))
            ) : (
              <button disabled>Эпизод пока закрыт</button>
            )}
          </div>
          {onDevEnter && (
            <div className="development-preview">
              <p>
                Разработка · прямой вход без прохождения предыдущих эпизодов.
              </p>
              <div className="preview-actions">
                {stop.ids.map((id) => (
                  <button
                    key={id}
                    disabled={snapshot.closed || snapshot.externallyPaused}
                    onClick={() => onDevEnter(id)}
                  >
                    {stop.ids.length > 1
                      ? id === 'choiceKey'
                        ? 'DEV · Открыть просьбу о ключе'
                        : 'DEV · Открыть просьбу о яблоке'
                      : 'DEV · Открыть эпизод'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <details>
            <summary>Что будет в эпизоде</summary>
            <p>{stop.ids.map((id) => episodes[id].quest).join(' ')}</p>
          </details>
        </EpisodePreview>
      )}
      {showInfo && (
        <EpisodePreview onClose={() => setShowInfo(false)}>
          <div className="preview-heading">
            <p>ДОРОГА ОГНЕЙ</p>
            <button
              onClick={() => setShowInfo(false)}
              aria-label="Закрыть справку карты"
            >
              ×
            </button>
          </div>
          <h3 id="episode-preview-title" tabIndex={-1}>
            О карте
          </h3>
          <p>
            Свет и галочка отмечают завершённые эпизоды. Люми стоит у текущего
            фонаря. Нажми любой фонарь, чтобы посмотреть тему.
          </p>
          <p>
            В этой версии прогресс хранится до перезагрузки страницы. Просмотр
            карты не меняет расстановку слов.
          </p>
        </EpisodePreview>
      )}
    </div>
  );
}
