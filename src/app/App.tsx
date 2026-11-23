import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../game/session';
import {
  attachDayEnglish,
  type GameWindowControl,
} from '../platform/dayenglish';
import { GameWindowButton } from './GameWindowButton';
import { GameViewport } from './GameViewport';
import { GameDialog } from './GameDialog';
import { Journal } from './Journal';
import { JourneyMap } from './JourneyMap';
import { WordPanel } from './WordPanel';
import { PanelHeader } from './PanelHeader';
import { PauseMenu } from './PauseMenu';
import { ChapterArrival } from './ChapterArrival';
import { createVocabularyAccess } from '../platform/vocabulary';
import { createGameAudio } from '../game/audio';
import { createGameEffects } from '../game/game-effects';
import { createGameMusic } from '../game/game-music';
import { puzzleEffect } from '../game/puzzle-sfx';
import { catVoiceClip } from '../game/cat-voice';
import { CatDialogue, type Conversation } from './CatDialogue';
import { dialogueSpeaker } from '../domain/dialogue';
import { LumiPortrait, Prologue } from './Prologue';
import { platformSettings } from './platform-settings';
import { episodes, nextEpisodes, type EpisodeId } from '../domain/episodes';
import { exchangeStatus, exchangeText } from '../domain/station-exchange';
import {
  feedbackText,
  readPhrase,
  type Direction,
  type PuzzleAction,
} from '../domain/puzzle';

const defaultSettings = platformSettings();
const controls: { direction: Direction; label: string; icon: string }[] = [
  { direction: 'up', label: 'Вверх', icon: '↑' },
  { direction: 'left', label: 'Влево', icon: '←' },
  { direction: 'down', label: 'Вниз', icon: '↓' },
  { direction: 'right', label: 'Вправо', icon: '→' },
];
type Panel =
  'journal' | 'menu' | 'journey' | 'words' | 'settings' | 'restart' | null;

export function App({
  session,
  settings = defaultSettings,
}: {
  session: GameSession;
  settings?: ReturnType<typeof platformSettings>;
}) {
  const field = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLElement>(null);
  const [windowControl, setWindowControl] = useState<GameWindowControl | null>(
    null,
  );
  const [windowPending, setWindowPending] = useState(false);
  const [nativeExpanded, setNativeExpanded] = useState(false);
  useEffect(() => {
    const changed = () => setNativeExpanded(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  const titleMapButton = useRef<HTMLButtonElement>(null);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [vocabulary] = useState(() =>
    createVocabularyAccess(
      () =>
        session.getSnapshot().externallyPaused || session.getSnapshot().closed,
    ),
  );
  const [audio] = useState(createGameAudio);
  const [effects] = useState(createGameEffects);
  const [music] = useState(createGameMusic);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const audioState = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  useEffect(() => audio.mount(), [audio]);
  useEffect(() => effects.mount(), [effects]);
  useEffect(() => music.mount(), [music]);
  useEffect(
    () => effects.setEnabled(audioState.effects),
    [effects, audioState.effects],
  );
  useEffect(
    () => effects.setBlocked(state.externallyPaused || state.closed),
    [effects, state.externallyPaused, state.closed],
  );
  useEffect(
    () => effects.setWorldPaused(state.sceneSuspended),
    [effects, state.sceneSuspended],
  );
  useEffect(
    () =>
      effects.setSpeechActive(
        Boolean(audioState.catPlaying || audioState.playing),
      ),
    [effects, audioState.catPlaying, audioState.playing],
  );
  useEffect(() => {
    if (state.sceneSuspended || state.closed) audio.stop();
  }, [audio, state.sceneSuspended, state.closed, state.externallyPaused]);
  const [screen, setScreen] = useState<
    'title' | 'prologue' | 'workshop' | 'station-road'
  >('title');
  const [entered, setEntered] = useState(false);
  const [walking, setWalking] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [journalSection, setJournalSection] = useState<'lesson' | 'controls'>(
    'lesson',
  );
  const journalScroll = useRef({ lesson: 0, controls: 0 });
  const [panelTrail, setPanelTrail] = useState<Exclude<Panel, null>[]>([]);
  function openPanel(next: Exclude<Panel, null>) {
    if (panel) setPanelTrail((trail) => [...trail, panel]);
    setPanel(next);
  }
  function backPanel() {
    audio.stop();
    setPanel(panelTrail.at(-1) ?? null);
    setPanelTrail((trail) => trail.slice(0, -1));
  }
  const panelBack = panelTrail.length ? backPanel : undefined;
  const backLabel =
    panelTrail.at(-1) === 'journal' ? 'Назад в журнал' : 'Назад в меню';
  const [listening, setListening] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [line, setLine] = useState(0);
  const [rotationHint, setRotationHint] = useState(true);
  const [fullscreenMessage, setFullscreenMessage] = useState('');
  const [status, setStatus] = useState(settings.status);
  const [hidden, setHidden] = useState(document.hidden);
  const [toast, setToast] = useState('');
  useEffect(() => {
    music.setTrack(
      screen === 'prologue'
        ? null
        : screen === 'title' ||
            screen === 'station-road' ||
            panel === 'journey' ||
            state.room.definition.message
          ? 'menu'
          : 'workshop',
    );
  }, [music, screen, panel, state.room.definition.message]);
  useEffect(
    () => music.setBlocked(hidden || state.externallyPaused || state.closed),
    [music, hidden, state.externallyPaused, state.closed],
  );
  useEffect(
    () =>
      music.setSpeechActive(
        Boolean(audioState.catPlaying || audioState.playing),
      ),
    [music, audioState.catPlaying, audioState.playing],
  );
  function toggleMusic(value: boolean) {
    setMusicEnabled(value);
    music.setEnabled(value);
    if (value) music.unlock();
  }
  function unlockMusic(target: EventTarget) {
    if (target instanceof Element && target.closest('[data-music-toggle]'))
      return;
    music.unlock();
  }
  const room = state.room;
  const catClip = catVoiceClip(room, conversation, line);
  const catPlaybackId = `${catClip?.id ?? ''}:${room.explanations.length}`;
  const catSuspended =
    screen !== 'workshop' ||
    panel !== null ||
    hidden ||
    state.sceneSuspended ||
    state.closed;
  const autoCatLine = useRef<{ id: string; started: boolean } | null>(null);
  useEffect(() => {
    audio.resetSpeech();
  }, [
    audio,
    panel,
    screen,
    conversation,
    line,
    room.definition.id,
    room.explanations.length,
  ]);
  useEffect(() => {
    if (!catClip) {
      autoCatLine.current = null;
      return;
    }
    if (autoCatLine.current?.id !== catPlaybackId)
      autoCatLine.current = { id: catPlaybackId, started: false };
    if (catSuspended || autoCatLine.current.started) return;
    // Returning from a pause or English word never resurrects a stopped line.
    autoCatLine.current.started = true;
    if (audio.getSnapshot().catEnabled) audio.playCat(catClip);
  }, [audio, catClip, catSuspended, catPlaybackId]);
  useEffect(() => () => session.setPaused('listening', false), [session]);
  function stopListening() {
    audio.stop();
    setListening(false);
    session.setPaused('listening', false);
  }
  function toggleListening() {
    if (state.externallyPaused || state.closed) return;
    audio.stop();
    setListening(!listening);
    session.setPaused('listening', !listening);
    field.current?.focus({ preventScroll: true });
  }
  function speakWord(word: string) {
    if (
      session.getSnapshot().externallyPaused ||
      session.getSnapshot().closed ||
      panel ||
      screen !== 'workshop'
    )
      return;
    audio.speak(word);
  }
  const episode = {
    ...episodes[room.episode],
    ...(room.definition.presentation
      ? {
          title: room.definition.presentation.title,
          quest: room.definition.presentation.quest,
        }
      : {}),
  };
  const words = readPhrase(room);
  const blocked = state.paused || state.closed;
  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.hidden);
      session.setPaused('hidden', document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);
  useEffect(() => {
    session.setPaused('presentation', screen !== 'workshop');
    return () => session.setPaused('presentation', false);
  }, [screen, session]);
  useEffect(() => {
    if (settings.invalid) {
      session.setPaused('platform', true);
      return;
    }
    if (!settings.options) return;
    return attachDayEnglish(
      session,
      settings.options,
      setStatus,
      undefined,
      vocabulary,
      setWindowControl,
    );
  }, [session, settings, vocabulary]);
  useEffect(() => {
    session.setView({ beacon: walking });
  }, [walking, session]);
  useEffect(() => {
    if (screen === 'workshop' && !panel && !conversation)
      field.current?.focus({ preventScroll: true });
    else if (screen === 'title' && !panel)
      titleMapButton.current?.focus({ preventScroll: true });
  }, [screen, panel, conversation]);
  useEffect(() => {
    session.setPaused('dialogue', conversation !== null);
    return () => session.setPaused('dialogue', false);
  }, [conversation, session]);
  function talk(kind: Conversation) {
    if (listening) stopListening();
    setLine(0);
    setConversation(kind);
  }
  async function fullscreen() {
    if (windowPending) return;
    setWindowPending(true);
    try {
      if (settings.options) {
        if (!windowControl) throw new Error('unavailable');
        await windowControl.setExpanded(!windowControl.expanded);
      } else if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
      setFullscreenMessage('');
    } catch {
      setFullscreenMessage(
        'Не удалось изменить размер окна. Попробуйте ещё раз. Игра продолжает работать.',
      );
    } finally {
      setWindowPending(false);
    }
  }
  const windowButton = (windowControl ||
    (!settings.options && document.fullscreenEnabled)) && (
    <GameWindowButton
      expanded={windowControl?.expanded ?? nativeExpanded}
      pending={windowPending}
      onClick={() => void fullscreen()}
    />
  );

  function enterWorkshop() {
    setScreen('workshop');
    if (!entered) {
      setEntered(true);
      talk('meet');
    } else field.current?.focus({ preventScroll: true });
  }
  function closePanel() {
    audio.stop();
    setPanel(null);
    setPanelTrail([]);
    field.current?.focus({ preventScroll: true });
  }
  function play(action: PuzzleAction) {
    if (
      conversation !== null ||
      session.getSnapshot().paused ||
      state.closed ||
      (walking && action.type === 'apply')
    )
      return;
    const before = session.getSnapshot().room;
    if (action.type === 'undo' || action.type === 'reset') audio.stop();
    session.dispatch(action);
    const next = session.getSnapshot().room;
    const sound = puzzleEffect(before, next, action);
    if (action.type === 'undo' || action.type === 'reset')
      effects.stop('world');
    if (sound) effects.play(sound);
    if (walking && next.x === 3 && next.y === 2) {
      setWalking(false);
      talk('rule');
      setToast('');
    } else if (action.type === 'apply' && next.completed) {
      talk('success');
      setToast('');
    } else {
      setToast(
        ['move', 'push', 'start'].includes(next.feedback)
          ? ''
          : feedbackText(next),
      );
    }
    field.current?.focus({ preventScroll: true });
  }
  function reset() {
    if (session.getSnapshot().externallyPaused || session.getSnapshot().closed)
      return;
    stopListening();
    // Explicit reset in the paused menu; preserve independent host/hidden pauses.
    session.setPaused('overlay', false);
    session.setPaused('dialogue', false);
    session.dispatch({ type: 'reset' });
    setConversation(null);
    setPanel(null);
    setPanelTrail([]);
    setToast('');
  }
  function enterEpisode(id: EpisodeId, developmentPreview = false) {
    if (id === session.getSnapshot().room.episode) {
      if (state.closed || state.externallyPaused) return;
      stopListening();
      setPanel(null);
      setPanelTrail([]);
      enterWorkshop();
      return;
    }
    if (!session.enterEpisode(id, { developmentPreview })) return;
    stopListening();
    setEntered(true);
    setScreen('workshop');
    setWalking(false);
    setPanel(null);
    setPanelTrail([]);
    setToast('');
    if (session.getSnapshot().room.completed) talk('success');
    else if (id !== 'cat') talk('task');
    else talk('rule');
  }
  function visitEpisode(id: EpisodeId) {
    if (id === 'chapter-02-01' && !session.hasVisitedEpisode(id)) {
      if (
        state.closed ||
        state.externallyPaused ||
        !state.unlockedEpisodes.includes(id)
      )
        return;
      stopListening();
      setPanel(null);
      setPanelTrail([]);
      setConversation(null);
      setScreen('station-road');
    } else enterEpisode(id);
  }
  const title =
    panel === 'journal'
      ? 'Дорожный журнал'
      : panel === 'journey'
        ? 'Карта фонарей'
        : panel === 'words'
          ? 'Словарь игры'
          : panel === 'settings'
            ? 'Настройки'
            : panel === 'restart'
              ? 'Начать заново?'
              : 'Пауза';

  return (
    <main
      ref={shell}
      className="game-shell"
      onPointerDownCapture={(event) => unlockMusic(event.target)}
      onKeyDownCapture={(event) => unlockMusic(event.target)}
      onClick={(event) => {
        const target = event.target;
        if (
          !(target instanceof Element) ||
          screen === 'prologue' ||
          hidden ||
          state.externallyPaused ||
          state.closed
        )
          return;
        const button = target.closest('button');
        if (
          !button ||
          button.disabled ||
          button.closest(
            '[data-sfx="none"], .spoken-word, .word-actions, .word-target, .cat-voice-controls, .direction-pad',
          )
        )
          return;
        effects.play(
          button.closest('.cat-actions, .journal-content') ? 'page' : 'ui',
          'ui',
        );
      }}
      data-animations={
        state.view.animations &&
        !state.view.reducedMotion &&
        !state.sceneSuspended
          ? 'on'
          : 'off'
      }
    >
      {fullscreenMessage && (
        <p className="game-window-error" role="status">
          {fullscreenMessage}
        </p>
      )}
      {entered && (
        <section
          className={`workshop ${conversation ? 'conversing' : ''} ${screen !== 'workshop' ? 'concealed' : ''}`}
          inert={screen !== 'workshop'}
          aria-label={
            room.definition.message
              ? 'Головоломка на станции'
              : 'Головоломка в мастерской'
          }
          data-episode={room.episode}
        >
          <GameViewport
            speaker={dialogueSpeaker(room, conversation, line)}
            getMouth={audio.getCatMouth}
            session={session}
            conversation={conversation !== null}
            container={field}
            onAction={play}
            onMenu={() => (listening ? toggleListening() : setPanel('menu'))}
            listening={listening && !panel && !conversation}
            speechBlocked={
              state.externallyPaused || state.closed || panel !== null
            }
            playing={audioState.playing}
            onSpeak={speakWord}
          />
          <header className="hud-top">
            <div className="location">
              <span className="chapter-mark" aria-hidden="true">
                {room.definition.message ? 'II' : 'I'}
              </span>
              <div>
                <span className="eyebrow">ДОРОГА ОГНЕЙ</span>
                <h1>
                  {room.episode !== 'cat' ? episode.title : 'Мастерская у леса'}
                </h1>
              </div>
            </div>
            <nav aria-label="Игровые панели">
              {windowButton}
              <button
                className="listen-toggle"
                aria-label="Слушать слова на поле"
                aria-pressed={listening}
                disabled={
                  conversation !== null ||
                  state.externallyPaused ||
                  state.closed
                }
                onClick={toggleListening}
                title="Включить прослушивание табличек"
              >
                ◖)) <span>Слушать</span>
              </button>
              <button
                onClick={() => setPanel('words')}
                title="Произношение и словарь"
              >
                Слова
              </button>
              <button
                onClick={() => setPanel('journal')}
                title="Просьба, правило и управление"
              >
                Журнал
              </button>
              <button
                className="menu-button"
                onClick={() => setPanel('menu')}
                aria-label="Меню и пауза"
              >
                ☰
              </button>
            </nav>
          </header>
          {room.definition.message && !listening && (
            <div
              className="message-context"
              role="status"
              aria-label="Автор сообщения"
            >
              <strong>
                {room.definition.message.intent === 'label-group'
                  ? 'Подпись'
                  : room.definition.message.exchange?.act === 'question'
                    ? 'Вопрос'
                    : room.definition.message.exchange?.act === 'short-answer'
                      ? 'Ответ'
                      : 'Сообщение'}
                :{' '}
                {room.definition.message.exchange?.inquiry?.authorLabel ??
                  room.definition.message.people[
                    room.definition.message.speaker
                  ].label}{' '}
                →{' '}
                {room.definition.message.exchange?.audienceLabel ??
                  room.definition.message.people[
                    room.definition.message.recipient
                  ].label}
              </strong>
              <small>
                {room.definition.message.exchange
                  ? exchangeStatus(
                      room.definition.message.exchange,
                      room.completed,
                    )
                  : room.definition.message.intent === 'label-group'
                    ? `В записи: ${room.reference?.objects.find((object) => object.id === room.reference?.indicatedId)?.label ?? 'нет выбранной записи'}${room.completed ? ' · подписано' : ''}`
                    : room.definition.message.intent === 'describe-object'
                      ? `О чём: ${room.reference?.objects.find((object) => object.id === room.reference?.indicatedId)?.label ?? 'предмет под указателем'}${room.completed ? ' · записано' : ''}`
                      : room.definition.message.subject
                        ? `О ком: ${room.definition.message.people[room.definition.message.subject].label}${room.completed ? ' · записано' : ''}`
                        : room.completed
                          ? room.definition.message.intent.endsWith(
                              '-recipient',
                            )
                            ? 'Обращение записано'
                            : room.definition.message.intent === 'describe-self'
                              ? 'Описание записано'
                              : 'Имя записано на бирке'
                          : room.definition.message.intent.endsWith(
                                '-recipient',
                              )
                            ? 'Обратиться к собеседнику'
                            : room.definition.message.intent === 'describe-self'
                              ? 'Назвать вид, а не имя'
                              : 'Назвать имя автора'}
              </small>
              {room.definition.message.exchange?.question && (
                <small className="exchange-question">
                  {room.definition.message.exchange.question}
                </small>
              )}
            </div>
          )}
          {listening && !panel && !conversation && (
            <div className="listening-bar">
              <span>Нажми слово на поле · ходы на паузе</span>
              <span role="status">{audioState.message}</span>
              {audioState.playing && (
                <button onClick={audio.stop}>Остановить звук</button>
              )}
              <button onClick={toggleListening}>К игре</button>
            </div>
          )}
          {!conversation && !listening && walking && (
            <div className="quest-chip">
              {walking
                ? 'Первый шаг · дойди до огонька справа'
                : room.completed
                  ? 'Просьба Марты выполнена'
                  : 'Просьба Марты · любая карточка с котом'}
            </div>
          )}
          {!conversation && (
            <div className="hud-bottom">
              <div className="movement-controls">
                <div
                  className="direction-pad"
                  aria-label="Направления движения"
                >
                  {controls.map(({ direction, label, icon }) => (
                    <button
                      className={`direction-${direction}`}
                      key={direction}
                      aria-label={label}
                      disabled={blocked || room.completed}
                      onClick={() => play({ type: 'move', direction })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <span className="keyboard-tip">WASD / ↑↓←→</span>
              </div>
              <div className="action-controls">
                {!walking && !room.completed && (
                  <button
                    className="primary phrase-action"
                    data-sfx="none"
                    disabled={blocked}
                    onClick={() => play({ type: 'apply' })}
                  >
                    <span lang="en" aria-label="Слова в рамке чтения">
                      {room.definition.message?.exchange
                        ? exchangeText(words.length ? words : ['']) +
                          (room.definition.message.exchange.act === 'question'
                            ? '?'
                            : '')
                        : words.map((w) => w || '…').join('  ')}
                    </span>
                    <span>
                      {room.definition.message
                        ? room.definition.message.intent === 'label-group'
                          ? 'Подписать запись'
                          : room.definition.message.exchange?.act === 'question'
                            ? 'Задать вопрос'
                            : room.definition.message.exchange?.act ===
                                'short-answer'
                              ? 'Ответить'
                              : 'Передать сообщение'
                        : 'Передать просьбу'}{' '}
                      <kbd>↵</kbd>
                    </span>
                  </button>
                )}
                {room.completed && (
                  <button
                    className="primary"
                    disabled={blocked}
                    onClick={() => talk('success')}
                  >
                    {episode.reward}
                  </button>
                )}
                <button
                  className="undo-button"
                  data-sfx="none"
                  aria-label="Отмена"
                  disabled={blocked || room.history.length === 0}
                  onClick={() => play({ type: 'undo' })}
                >
                  ↶ <span>Отмена</span>
                  <kbd>Z</kbd>
                </button>
              </div>
            </div>
          )}
          {rotationHint && (
            <aside className="rotation-hint" aria-label="Ориентация экрана">
              <span>↻ Поверни телефон — поле будет крупнее</span>
              <button
                aria-label="Скрыть подсказку поворота"
                onClick={() => setRotationHint(false)}
              >
                ×
              </button>
            </aside>
          )}
          {conversation && (
            <CatDialogue
              key={`${room.definition.id}-${conversation}`}
              room={room}
              onNextEpisode={() => {
                if (room.definition.continuation) {
                  if (session.continueEpisode()) {
                    setToast('');
                    talk('task');
                  }
                  return;
                }
                const next =
                  room.episode === 'chapterFinale'
                    ? 'chapter-02-01'
                    : nextEpisodes[room.episode];
                if (next) visitEpisode(next);
              }}
              onExplain={session.explain}
              onSpeak={speakWord}
              playing={audioState.playing}
              speechMessage={audioState.message}
              onStopSpeech={audio.stop}
              catVoice={{
                available: Boolean(catClip),
                enabled: audioState.catEnabled,
                playing: audioState.catPlaying === catClip?.id,
                animate:
                  state.view.animations &&
                  !state.view.reducedMotion &&
                  !catSuspended,
                getMouth: audio.getCatMouth,
                message: audioState.catMessage,
                onToggle: () => audio.setCatEnabled(!audioState.catEnabled),
                onRepeat: () => {
                  if (catClip && !catSuspended) audio.playCat(catClip);
                },
              }}
              conversation={conversation}
              index={line}
              onIndex={setLine}
              onFinish={() => setConversation(null)}
              onRestart={reset}
              onMenu={() => setPanel('menu')}
              suspended={
                screen !== 'workshop' ||
                panel !== null ||
                state.externallyPaused ||
                state.closed
              }
              field={field}
            />
          )}
          {toast && !conversation && (
            <div className="game-toast" role="status">
              <span>{toast}</span>
              <button
                aria-label="Скрыть сообщение"
                onClick={() => setToast('')}
              >
                ×
              </button>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            Люми: столбец {room.x + 1}, ряд {room.y + 1} · Ходов: {room.moves}.{' '}
            {blocked ? 'Пауза.' : ''}
            {room.reference?.objects
              .filter((object) => object.id === room.reference?.indicatedId)
              .map(
                (object) =>
                  ` Общий выбор: ${object.label}; ${{ bag: 'в сумке', door: 'у двери', selected: 'отложен отдельно', table: 'на столе' }[object.location]}.`,
              )}
          </p>
          {state.closed && (
            <p className="session-message" role="alert">
              Игра закрыта платформой.
            </p>
          )}
          {!panel &&
            (!conversation || state.externallyPaused) &&
            (!listening || state.externallyPaused) &&
            blocked &&
            !state.closed &&
            state.room.revision > 0 && (
              <p className="session-message">Игра на паузе</p>
            )}
        </section>
      )}

      {screen === 'station-road' && (
        <ChapterArrival
          blocked={state.closed || state.externallyPaused}
          onEnter={() => enterEpisode('chapter-02-01')}
          onBack={() => {
            setScreen(entered ? 'workshop' : 'title');
            setPanel('journey');
          }}
        />
      )}
      {screen === 'title' && (
        <section className="title-screen">
          <div className="title-art" aria-hidden="true" />
          <div className="title-audio">
            <button
              className="title-sound"
              onClick={() => setPanel('settings')}
            >
              Настройки
            </button>
            {windowButton}
            <button
              className="title-sound"
              data-sfx="none"
              data-music-toggle
              aria-label="Музыка меню и главы"
              aria-pressed={musicEnabled}
              onClick={() => toggleMusic(!musicEnabled)}
            >
              Музыка: {musicEnabled ? 'вкл.' : 'выкл.'}
            </button>
            <button
              className="title-sound"
              data-sfx="none"
              aria-label="Звуки игры и меню"
              aria-pressed={audioState.effects}
              onClick={() => audio.setEffects(!audioState.effects)}
            >
              Звуки: {audioState.effects ? 'вкл.' : 'выкл.'}
            </button>
          </div>
          <div className={`title-content ${entered ? 'returning' : ''}`}>
            <span className="eyebrow">
              МАЛЕНЬКАЯ ИСТОРИЯ О ТОМ, КАК ПОНИМАТЬ ДРУГ ДРУГА
            </span>
            <h1>
              Люми<span>и дорога огней</span>
            </h1>
            <LumiPortrait />
            <div className="title-actions">
              {entered && (
                <button className="primary" onClick={enterWorkshop}>
                  Продолжить путешествие
                </button>
              )}
              <button
                ref={titleMapButton}
                className={entered ? '' : 'primary'}
                onClick={() => setPanel('journey')}
              >
                Карта фонарей · главы и эпизоды
              </button>
              <button className="quiet" onClick={() => setScreen('prologue')}>
                {entered ? 'Пересмотреть пролог' : 'Начать путешествие'}
              </button>
              {!entered && (
                <button className="quiet" onClick={enterWorkshop}>
                  Сразу в мастерскую
                </button>
              )}
            </div>
            <p className="title-note">
              Английский начинается с маленькой просьбы
            </p>
          </div>
        </section>
      )}
      {screen === 'prologue' && (
        <Prologue
          windowButton={windowButton}
          suspended={hidden || state.externallyPaused}
          onFinish={enterWorkshop}
        />
      )}

      {panel &&
        (screen === 'workshop' ||
          (screen === 'title' &&
            (panel === 'journey' || panel === 'settings'))) && (
          <GameDialog
            session={session}
            field={field}
            title={title}
            onClose={closePanel}
            onBack={panelBack}
            className={
              panel === 'journey'
                ? 'journey-road-dialog'
                : panel === 'words'
                  ? 'folio-dialog word-dialog'
                  : `folio-dialog ${panel === 'menu' ? 'pause-dialog' : panel === 'journal' ? 'journal-dialog' : ''}`
            }
          >
            {panel === 'journey' && (
              <JourneyMap
                snapshot={state}
                onEnter={visitEpisode}
                onDevEnter={
                  import.meta.env.DEV
                    ? (id) => enterEpisode(id, true)
                    : undefined
                }
                onClose={closePanel}
                onBack={panelBack}
                fromTitle={screen === 'title'}
              />
            )}
            {panel === 'words' && (
              <WordPanel
                key={room.definition.id}
                room={room}
                encounteredWords={state.encounteredWords}
                audio={audio}
                vocabulary={vocabulary}
                blocked={state.closed || state.externallyPaused}
                onClose={closePanel}
                onBack={panelBack}
                backLabel={backLabel}
              />
            )}
            {panel === 'journal' && (
              <>
                <Journal
                  room={room}
                  walking={walking}
                  onClose={closePanel}
                  onBack={panelBack}
                  section={journalSection}
                  onSection={setJournalSection}
                  scroll={journalScroll}
                  onScroll={(section, top) => {
                    journalScroll.current[section] = top;
                  }}
                />
                <div className="panel-footer dialog-actions">
                  <button onClick={() => openPanel('words')}>
                    Послушать слова
                  </button>
                  <button
                    disabled={
                      state.closed ||
                      state.externallyPaused ||
                      conversation !== null ||
                      walking ||
                      room.completed
                    }
                    onClick={() => {
                      session.setPaused('overlay', false);
                      session.dispatch({ type: 'hint' });
                      setToast(feedbackText(session.getSnapshot().room));
                      closePanel();
                    }}
                  >
                    Подсказка
                  </button>
                  <button className="primary" onClick={closePanel}>
                    Вернуться к полю
                  </button>
                </div>
              </>
            )}
            {panel === 'menu' && (
              <PauseMenu
                room={room}
                onClose={closePanel}
                onOpen={openPanel}
                windowButton={windowButton}
                onTitle={() => {
                  stopListening();
                  closePanel();
                  setScreen('title');
                }}
              />
            )}
            {panel === 'restart' && (
              <>
                <PanelHeader
                  title="Начать заново?"
                  eyebrow="ТЕКУЩИЙ ЭПИЗОД"
                  closeLabel="Закрыть подтверждение"
                  onClose={closePanel}
                  onBack={panelBack}
                />
                <div className="panel-scroll restart-copy">
                  <h3>{episodes[room.episode].title}</h3>
                  <p>
                    Все части этого эпизода начнутся сначала. Слова, которые ты
                    уже встретил, останутся в словаре игры.
                  </p>
                </div>
                <div className="panel-footer">
                  <button onClick={backPanel}>Отмена</button>
                  <button
                    className="primary"
                    disabled={state.closed || state.externallyPaused}
                    onClick={reset}
                  >
                    Начать эпизод заново
                  </button>
                </div>
              </>
            )}
            {panel === 'settings' && (
              <>
                <PanelHeader
                  title="Настройки"
                  eyebrow="ТВОЁ ПУТЕШЕСТВИЕ"
                  closeLabel="Закрыть настройки"
                  onClose={closePanel}
                  onBack={panelBack}
                />
                <div className="panel-scroll preferences-body">
                  <fieldset className="game-preferences">
                    <legend>Звук и движение</legend>
                    <label data-music-toggle>
                      <input
                        type="checkbox"
                        checked={musicEnabled}
                        onChange={(event) => toggleMusic(event.target.checked)}
                      />{' '}
                      Музыка меню и главы
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={audioState.catEnabled}
                        onChange={(event) =>
                          audio.setCatEnabled(event.target.checked)
                        }
                      />{' '}
                      Голоса персонажей
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={audioState.effects}
                        onChange={(event) =>
                          audio.setEffects(event.target.checked)
                        }
                      />{' '}
                      Звуки игры и меню
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={state.view.animations}
                        onChange={(event) =>
                          session.setView({ animations: event.target.checked })
                        }
                      />{' '}
                      Живые анимации персонажей
                    </label>
                    <small>
                      Системное уменьшение движения имеет приоритет.
                      Произношение запускается отдельно в «Словах».
                    </small>
                  </fieldset>
                  <button
                    className="prologue-replay"
                    onClick={() => {
                      closePanel();
                      setScreen('prologue');
                    }}
                  >
                    Пересмотреть пролог
                  </button>
                  {windowButton}
                  <details>
                    <summary>Об игре</summary>
                    <p>{status}</p>
                    <p>
                      Мастерская у леса: 12 эпизодов об артиклях. Станция
                      встреч: 20 эпизодов о местоимениях, числе и глаголе be.
                      Озвучку персонажей можно выключить; учебные слова доступны
                      для прослушивания отдельно.
                    </p>
                  </details>
                </div>
                <div className="panel-footer">
                  <button className="primary" onClick={panelBack ?? closePanel}>
                    Готово
                  </button>
                </div>
              </>
            )}
          </GameDialog>
        )}
    </main>
  );
}
