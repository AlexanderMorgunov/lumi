import { useEffect, useRef, useState, type RefObject } from 'react';
import { CatPortrait } from './CatPortrait';
import { StationPortrait } from './StationPortrait';
import { LumiPortrait } from './Prologue';
import type { CatMouth } from '../game/cat-mouth';
import { firstLesson } from '../domain/first-lesson';
import { SpokenText } from './SpokenText';
import { pronunciationParts } from '../domain/pronunciation';
import { reflectionOrder } from '../domain/reflection-order';
import {
  appleLesson,
  theLesson,
  nextEpisodes,
  reflections,
  type MeaningChoice,
} from '../domain/episodes';
import type { PuzzleState } from '../domain/puzzle';

import {
  dialogueSpeaker,
  dialogueStory,
  type Conversation,
} from '../domain/dialogue';
const speakerNames = {
  cat: 'КОТ МАСТЕРСКОЙ',
  tik: 'ТИК',
  marta: 'МАРТА',
  lumi: 'ЛЮМИ',
};
const speakerDialogueLabels = {
  cat: 'Разговор с котом',
  tik: 'Разговор с Тиком',
  marta: 'Разговор с Мартой',
  lumi: 'Реплика Люми',
};
export type { Conversation } from '../domain/dialogue';
export function CatDialogue({
  conversation,
  index,
  onIndex,
  onFinish,
  onRestart,
  onMenu,
  suspended,
  field,
  room,
  onNextEpisode,
  onExplain,
  onSpeak,
  playing,
  speechMessage,
  onStopSpeech,
  catVoice,
}: {
  conversation: Conversation;
  index: number;
  onIndex: (index: number) => void;
  onFinish: () => void;
  onRestart: () => void;
  onMenu: () => void;
  suspended: boolean;
  field: RefObject<HTMLDivElement | null>;
  room: PuzzleState;
  onNextEpisode: () => void;
  onExplain: (choice: MeaningChoice) => void;
  onSpeak: (word: string) => void;
  playing: string | null;
  speechMessage: string;
  onStopSpeech: () => void;
  catVoice: {
    available: boolean;
    enabled: boolean;
    playing: boolean;
    animate: boolean;
    getMouth: () => CatMouth;
    message: string;
    onToggle: () => void;
    onRepeat: () => void;
  };
}) {
  const ref = useRef<HTMLElement>(null);
  const answerFeedback = useRef<HTMLParagraphElement>(null);
  const replyArea = useRef<HTMLDivElement>(null);
  const [sceneShown, setSceneShown] = useState(false);
  const story = dialogueStory(room, conversation);
  const speaker = dialogueSpeaker(room, conversation, index);
  const reflection =
    room.episode === 'cat' || room.definition.continuation
      ? null
      : reflections[room.episode];
  const last = index === story.lines.length - 1;
  const meaningCheck =
    conversation === 'success' && reflection !== null && last;
  const answer = room.explanations.at(-1);
  const canContinue = !meaningCheck || answer === reflection?.correct;
  const canRetry = meaningCheck && answer !== undefined && !canContinue;
  const nextEpisode =
    conversation === 'success' &&
    last &&
    (Boolean(room.definition.continuation) ||
      nextEpisodes[room.episode] !== null ||
      room.episode === 'chapterFinale') &&
    canContinue;
  useEffect(() => {
    if (meaningCheck && !suspended)
      answerFeedback.current?.scrollIntoView({ block: 'nearest' });
  }, [meaningCheck, suspended, room.explanations.length]);
  useEffect(() => {
    if (!suspended) ref.current?.focus({ preventScroll: true });
  }, [conversation, index, suspended]);
  useEffect(() => {
    const target = field.current;
    return () => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [field]);
  function changeLine(nextIndex: number) {
    setSceneShown(false);
    replyArea.current?.scrollTo({ top: 0 });
    onIndex(nextIndex);
  }
  function next() {
    if (suspended) return;
    if (canRetry) {
      replyArea.current?.scrollTo({ top: 0 });
      replyArea.current
        ?.querySelector('button')
        ?.focus({ preventScroll: true });
      return;
    }
    if (!canContinue) return;
    if (nextEpisode) {
      onNextEpisode();
      return;
    }
    if (last) onFinish();
    else changeLine(index + 1);
  }
  return (
    <section
      ref={ref}
      className="cat-dialogue"
      data-scene-shown={sceneShown}
      data-speaker={speaker}
      aria-label={speakerDialogueLabels[speaker]}
      tabIndex={-1}
      inert={suspended}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          onMenu();
        }
        if (
          event.target === event.currentTarget &&
          ['Enter', ' '].includes(event.key)
        ) {
          event.preventDefault();
          if (!event.repeat) next();
        }
      }}
    >
      {speaker === 'marta' || speaker === 'tik' ? (
        <StationPortrait
          character={speaker}
          playing={catVoice.playing && !suspended}
          animate={catVoice.animate && !suspended}
          getMouth={catVoice.getMouth}
        />
      ) : speaker === 'lumi' ? (
        <LumiPortrait className="dialogue-lumi-portrait" />
      ) : (
        <CatPortrait
          playing={catVoice.playing && !suspended}
          animate={catVoice.animate}
          getMouth={catVoice.getMouth}
        />
      )}
      <div className="cat-heading">
        <span
          className={
            room.definition.message ? 'station-speaker-name' : 'eyebrow'
          }
        >
          {speakerNames[speaker]}
        </span>
        <h2>
          {meaningCheck && room.episode === 'chapterFinale' && canContinue
            ? 'Глава 1 завершена'
            : meaningCheck
              ? reflection && 'title' in reflection
                ? reflection.title
                : room.definition.message
                  ? room.definition.message.intent.endsWith('-recipient')
                    ? 'Кого обозначает you?'
                    : room.definition.message.intent === 'describe-object'
                      ? 'Почему здесь it?'
                      : room.definition.message.subject
                        ? 'Почему осталось he?'
                        : room.definition.message.intent === 'describe-self'
                          ? 'Имя или описание?'
                          : 'Кого обозначает I?'
                  : 'Смысл просьбы'
              : conversation === 'task' && room.episode === 'theKey'
                ? theLesson[index]?.title
                : conversation === 'task' && room.episode === 'apple'
                  ? appleLesson[index]?.title
                  : conversation === 'rule' && index > 0
                    ? firstLesson[index - 1]?.title
                    : story.title}
        </h2>
        <span className="dialogue-count">
          {index + 1} / {story.lines.length}
        </span>
        {catVoice.available && (
          <div
            className="cat-voice-controls"
            role="group"
            aria-label={
              speaker === 'cat' ? 'Озвучка кота' : 'Озвучка персонажа'
            }
            data-speaking={catVoice.playing}
          >
            <button
              type="button"
              aria-label={speaker === 'cat' ? 'Голос кота' : 'Голос персонажа'}
              aria-pressed={catVoice.enabled}
              onClick={catVoice.onToggle}
              title={catVoice.enabled ? 'Выключить речь' : 'Включить речь'}
            >
              {catVoice.enabled ? 'Голос: вкл.' : 'Голос: выкл.'}
            </button>
            <button
              type="button"
              aria-label="Повторить реплику"
              disabled={!catVoice.enabled}
              onClick={catVoice.onRepeat}
              title="Повторить реплику"
            >
              ↻
            </button>
          </div>
        )}
      </div>
      <div ref={replyArea} className="cat-line" aria-live="polite" tabIndex={0}>
        {catVoice.available && catVoice.message && (
          <small className="cat-voice-message" role="status">
            {catVoice.message}
          </small>
        )}
        {pronunciationParts(story.lines[index]!).some((part) => part.term) && (
          <small className="dialogue-listen-hint">
            ◖)) Нажми английское слово — послушай
          </small>
        )}
        <SpokenText
          text={story.lines[index]!}
          playing={playing}
          disabled={suspended}
          onSpeak={onSpeak}
        />
        {pronunciationParts(story.lines[index]!).some((part) => part.term) && (
          <div className="dialogue-listening">
            <span aria-live="polite" className="dialogue-speech-status">
              {speechMessage}
            </span>
            {playing && <button onClick={onStopSpeech}>Остановить звук</button>}
          </div>
        )}
        {meaningCheck && (
          <div
            className="meaning-check"
            role="group"
            aria-label="Смысл просьбы"
          >
            {reflection &&
              reflectionOrder<{ id: MeaningChoice; label: string }>(
                room.episode,
                reflection.choices,
                reflection.correct,
              ).map((choice) => (
                <button
                  key={choice.id}
                  aria-pressed={answer === choice.id}
                  onClick={() => onExplain(choice.id)}
                >
                  {choice.label}
                </button>
              ))}
            {answer && (
              <p ref={answerFeedback} role="status">
                <SpokenText
                  text={
                    reflection?.choices.find((choice) => choice.id === answer)
                      ?.feedback ?? ''
                  }
                  playing={playing}
                  disabled={suspended}
                  onSpeak={onSpeak}
                />
              </p>
            )}
          </div>
        )}
      </div>
      <div className="cat-actions">
        <button
          type="button"
          className="cat-scene-toggle"
          aria-controls="game-scene"
          aria-expanded={sceneShown}
          onClick={() => setSceneShown((shown) => !shown)}
        >
          {sceneShown ? 'Скрыть сцену' : 'Показать сцену'}
        </button>
        {index > 0 && !meaningCheck && (
          <button onClick={() => changeLine(index - 1)}>Назад</button>
        )}
        {conversation === 'success' && !meaningCheck && (
          <button onClick={onRestart}>Начать эпизод заново…</button>
        )}
        {nextEpisode && (
          <button className="primary" onClick={onNextEpisode}>
            {room.definition.continuation
              ? (room.definition.presentation?.continuationAction ??
                'Следующая часть')
              : room.episode === 'chapterFinale'
                ? 'Отправиться на станцию'
                : room.definition.message
                  ? 'Следующий эпизод'
                  : 'Следующая просьба'}
          </button>
        )}
        <button
          className={nextEpisode ? 'quiet' : 'primary'}
          disabled={!canContinue && !canRetry}
          onClick={nextEpisode ? onFinish : next}
        >
          {nextEpisode
            ? 'Вернуться к полю'
            : canRetry
              ? 'Выбрать другой ответ'
              : last
                ? story.action
                : 'Дальше'}
        </button>
      </div>
    </section>
  );
}
