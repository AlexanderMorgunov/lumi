import { useState, useSyncExternalStore } from 'react';
import type { PuzzleState } from '../domain/puzzle';
import { roomTerms, wordbook, type WordId } from '../domain/wordbook';
import type { GameAudio } from '../game/audio';
import type { VocabularyAccess } from '../platform/vocabulary';
import { art } from './Prologue';
import { PanelHeader } from './PanelHeader';
import { pronunciationRecording } from '../domain/pronunciation';

export function WordPanel({
  room,
  encounteredWords,
  audio,
  vocabulary,
  blocked,
  onClose,
  onBack,
  backLabel,
}: {
  room: PuzzleState;
  encounteredWords: readonly WordId[];
  audio: GameAudio;
  vocabulary: VocabularyAccess;
  blocked: boolean;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const currentTerms = roomTerms(room);
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [query, setQuery] = useState('');
  const terms = scope === 'all' ? encounteredWords : currentTerms;
  const search = query.trim().toLocaleLowerCase();
  const matches = terms.filter((term) =>
    `${term} ${wordbook[term].translation}`
      .toLocaleLowerCase()
      .includes(search),
  );
  const [selected, setSelected] = useState<WordId>(currentTerms[0] ?? 'cat');
  function changeScope(next: 'all' | 'current') {
    audio.stop();
    setScope(next);
    setQuery('');
    const nextTerms = next === 'all' ? encounteredWords : currentTerms;
    if (!nextTerms.includes(selected)) setSelected(nextTerms[0] ?? 'cat');
  }
  const speech = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  const capture = useSyncExternalStore(
    vocabulary.subscribe,
    vocabulary.getSnapshot,
  );
  const word = wordbook[selected];
  const pluralIllustration = [
    'apples',
    'eggs',
    'robots',
    'books',
    'keys',
  ].includes(selected);
  const voice =
    pronunciationRecording(selected)?.voice ??
    (speech.playing === selected ? speech.voice : '');
  const image = 'image' in word ? word.image : undefined;
  const entry = capture.entries[selected];
  const pending = Object.values(capture.entries).some(
    (item) => item?.status === 'pending',
  );
  const saved = entry?.status === 'saved' || entry?.status === 'existing';
  return (
    <>
      <PanelHeader
        title="Словарь игры"
        eyebrow="ДОРОЖНЫЕ СЛОВА"
        closeLabel="Закрыть слова"
        onClose={onClose}
        onBack={onBack}
        backLabel={backLabel}
      />
      <div className="word-workspace">
        <section className="word-index" aria-label="Коллекция слов">
          <p className="word-library-note">
            Здесь остаются слова из заданий, которые ты уже начал.
          </p>
          <div className="word-scope" role="group" aria-label="Набор слов">
            <button
              aria-pressed={scope === 'all'}
              onClick={() => changeScope('all')}
            >
              Встреченные · {encounteredWords.length}
            </button>
            <button
              aria-pressed={scope === 'current'}
              onClick={() => changeScope('current')}
            >
              {room.definition.message?.intent === 'label-group'
                ? 'В этой подписи'
                : room.definition.message
                  ? 'В этом сообщении'
                  : 'В этой просьбе'}{' '}
              · {currentTerms.length}
            </button>
          </div>
          <label className="word-search">
            Найти слово
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="По-английски или по-русски"
            />
          </label>
          <nav className="word-tabs" aria-label="Выбрать слово">
            {matches.map((term) => (
              <button
                key={term}
                aria-pressed={selected === term}
                lang="en"
                onClick={() => {
                  audio.stop();
                  setSelected(term);
                }}
              >
                {term}
              </button>
            ))}
          </nav>
          {matches.length === 0 && (
            <p role="status" className="word-empty">
              Такого слова здесь пока нет. Попробуй другой запрос.
            </p>
          )}
        </section>
        <section
          className="word-detail panel-scroll"
          aria-label="Карточка слова"
        >
          <div className="word-heading">
            {image && (
              <span>
                <img
                  src={`${art}${image}`}
                  alt=""
                  width={pluralIllustration ? 48 : 96}
                  height={pluralIllustration ? 48 : 96}
                />
                {pluralIllustration && (
                  <img src={`${art}${image}`} alt="" width="48" height="48" />
                )}
              </span>
            )}
            <div>
              <h3 lang="en">{selected}</h3>
              <p>{word.translation}</p>
              {word && <small>{word.pronunciation}</small>}
            </div>
          </div>
          <div className="word-actions">
            <button
              disabled={blocked}
              onClick={() => audio.speak(selected)}
              aria-label={`Послушать ${selected}`}
            >
              ◖)) Послушать
            </button>
            <button
              disabled={blocked}
              onClick={() => audio.speak(selected, true)}
            >
              Медленнее
            </button>
            {speech.playing && <button onClick={audio.stop}>Остановить</button>}
          </div>
          <p className="word-audio-status" role="status">
            {speech.message || 'Нажми «Послушать», чтобы услышать слово.'}
          </p>
          <p className="word-definition">{word.note}</p>
          <details className="voice-details">
            <summary>Об озвучке</summary>
            <small className="voice-note">
              {voice
                ? `Произношение: ${voice}.`
                : 'audioPending' in word
                  ? 'Произношение голосом устройства, если он доступен.'
                  : 'Английская запись из игры.'}{' '}
              Транскрипция и выбранный акцент могут различаться.
            </small>
          </details>
          {word && (
            <section className="capture-word">
              <button
                className="primary"
                disabled={
                  blocked ||
                  capture.availability !== 'ready' ||
                  pending ||
                  saved
                }
                onClick={() => {
                  audio.stop();
                  void vocabulary.capture(
                    selected,
                    currentTerms.includes(selected)
                      ? `Люми и дорога огней · ${room.definition.id} · ${room.definition.presentation?.quest ?? 'Артикли a/an/the'}`
                      : `Люми и дорога огней · Словарь игры · ${selected}: ${word.note}`,
                  );
                }}
              >
                {saved
                  ? '✓ В словаре DayEnglish'
                  : entry?.status === 'pending'
                    ? 'Ожидаем подтверждения…'
                    : entry?.status === 'error'
                      ? 'Повторить добавление'
                      : 'Добавить в DayEnglish'}
              </button>
              <p role="status">
                {entry?.message ??
                  (capture.availability === 'standalone'
                    ? 'Добавление в личный словарь доступно при запуске игры из DayEnglish.'
                    : capture.availability === 'connecting'
                      ? 'Подключаемся к DayEnglish…'
                      : capture.availability === 'ready'
                        ? 'DayEnglish попросит подтвердить добавление. Это не влияет на решение.'
                        : 'Словарь сейчас недоступен. Можно продолжить игру.')}
              </p>
            </section>
          )}
        </section>
      </div>
      <div className="panel-footer dialog-actions">
        <button className="primary" onClick={onClose}>
          {room.definition.message
            ? room.definition.message.intent === 'label-group'
              ? 'Вернуться к подписи'
              : 'Вернуться к сообщению'
            : 'Вернуться к просьбе'}
        </button>
      </div>
    </>
  );
}
