import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { PuzzleState } from '../domain/puzzle';
import { exchangeStatus } from '../domain/station-exchange';
import { art } from './Prologue';
import { PanelHeader } from './PanelHeader';
import { firstLesson } from '../domain/first-lesson';
import { pluralRule } from '../domain/plural-lesson';
import {
  episodes,
  keyIntroduction,
  appleLesson,
  eggIntroduction,
  eggRule,
  choiceStories,
  choiceRule,
  theLesson,
  theAppleRule,
} from '../domain/episodes';

export function RuleContent() {
  return (
    <>
      <div className="lesson-example">
        <img
          src={`${art}lumi/cat-v1.png`}
          alt="Рыжий кот"
          width="76"
          height="76"
        />
        <span lang="en">a cat</span>
        <span>кот / кошка</span>
      </div>
      {firstLesson.map((part) => (
        <section key={part.title}>
          <h3>{part.title}</h3>
          <p>{part.text}</p>
        </section>
      ))}
      <h3>Когда речь о конкретном предмете</h3>
      <p>
        Если собеседнику понятно, какой предмет нужен, используем{' '}
        <span lang="en">the</span> — определённый артикль. Например, кот показал
        ключ, и Люми его видит. Не обязательно сначала говорить об этом ключе:
        важно, что оба понимают, о каком речь.
      </p>
      <p>
        Артикль не нужен перед каждым английским словом. Например,{' '}
        <span lang="en">cat</span> может быть отдельной подписью к картинке. В
        первых просьбах мы называем один предмет. В конце главы сравним просьбы
        об одном и нескольких.
      </p>
      <details>
        <summary>Несколько предметов: apples и the apples</summary>
        <p>{pluralRule}</p>
      </details>
    </>
  );
}

export function Journal({
  room,
  walking,
  onClose,
  onBack,
  section,
  onSection,
  scroll,
  onScroll,
}: {
  room: PuzzleState;
  walking: boolean;
  onClose: () => void;
  onBack?: () => void;
  section: 'lesson' | 'controls';
  onSection: (section: 'lesson' | 'controls') => void;
  scroll: RefObject<Record<'lesson' | 'controls', number>>;
  onScroll: (section: 'lesson' | 'controls', top: number) => void;
}) {
  const level = room.definition;
  const reading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (reading.current) reading.current.scrollTop = scroll.current[section];
  }, [scroll, section]);
  return (
    <>
      <PanelHeader
        title="Дорожный журнал"
        eyebrow="ЗАПИСИ ЛЮМИ"
        closeLabel="Закрыть журнал"
        onClose={onClose}
        onBack={onBack}
      />
      <div className="panel-sections" role="group" aria-label="Раздел журнала">
        <button
          aria-pressed={section === 'lesson'}
          onClick={() => onSection('lesson')}
        >
          Задание и правило
        </button>
        <button
          aria-pressed={section === 'controls'}
          onClick={() => onSection('controls')}
        >
          Управление
        </button>
      </div>
      <div
        ref={reading}
        key={section}
        className="panel-scroll journal-reading"
        onScroll={(event) => {
          onScroll(section, event.currentTarget.scrollTop);
        }}
      >
        {section === 'lesson' ? (
          <>
            <section>
              <h3>{episodes[room.episode].title}</h3>
              <p>
                {walking
                  ? 'Кот мастерской зовёт к огоньку. Сделай шаг вправо, в подсвеченную клетку.'
                  : (room.definition.presentation?.quest ??
                    episodes[room.episode].quest)}
              </p>
            </section>
            {level.message && (
              <section>
                <h3>Кто кому говорит</h3>
                <p>
                  Автор:{' '}
                  {level.message.exchange?.inquiry?.authorLabel ??
                    level.message.people[level.message.speaker].label}
                  . Слушатель:{' '}
                  {level.message.exchange?.audienceLabel ??
                    level.message.people[level.message.recipient].label}
                  .
                  {level.message.subject && (
                    <>
                      {' '}
                      О ком: {level.message.people[level.message.subject].label}
                      .
                    </>
                  )}{' '}
                  {(level.message.intent === 'describe-object' ||
                    level.message.intent === 'label-group') && (
                    <>
                      О чём:{' '}
                      {room.reference?.objects.find(
                        (object) => object.id === room.reference?.indicatedId,
                      )?.label ?? 'предмет не указан'}
                      .{' '}
                    </>
                  )}
                  Люми двигает слова независимо от того, чьё сообщение собирает.
                </p>
                {level.message.exchange && (
                  <>
                    {level.message.exchange.question && (
                      <p>{level.message.exchange.question}</p>
                    )}
                    <p>
                      {exchangeStatus(level.message.exchange, room.completed)}
                    </p>
                  </>
                )}
                {room.messages.length > 0 && (
                  <>
                    <h3>
                      {level.message.intent === 'label-group'
                        ? 'Подписи к записям'
                        : 'Записанные сообщения'}
                    </h3>
                    <ul>
                      {room.messages.map((message, i) => (
                        <li key={i}>
                          {message.authorLabel ??
                            level.message!.people[message.speaker].label}{' '}
                          →{' '}
                          {message.audienceLabel ??
                            level.message!.people[message.recipient].label}
                          {message.subject &&
                            ` (о ком: ${level.message!.people[message.subject].label})`}
                          {message.object &&
                            ` (о чём: ${message.object.label})`}
                          :{' '}
                          <span lang="en">
                            {message.text}
                            {level.message!.intent === 'label-group'
                              ? ''
                              : message.question
                                ? '?'
                                : '.'}
                          </span>
                          {message.reply && (
                            <span> Ответ: {message.reply}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
            {room.definition.presentation && (
              <section>
                <h3>{room.definition.presentation.title}</h3>
                {room.definition.presentation.introduction.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <details>
                  <summary>
                    {level.message?.intent === 'label-group'
                      ? 'Правило подписи'
                      : level.message
                        ? 'Правило сообщения'
                        : 'Правило этой просьбы'}
                  </summary>
                  <p>{room.definition.presentation.rule}</p>
                </details>
                <p>
                  «Начать комнату заново» возвращает весь эпизод к первой части.
                  Отмена может вернуть и предыдущую часть; попытки и подсказки
                  сохраняются.
                </p>
              </section>
            )}
            {room.reference && !room.definition.presentation && (
              <section>
                <h3>Указанный предмет</h3>
                <p>
                  {room.episode === 'theApple'
                    ? 'Кот показал зелёное яблоко слева — подарок смотрителю первого огня. Остальные два яблока красные. Нужен именно этот плод, а не любое яблоко.'
                    : 'Кот показал средний ключ от двери мастерской. Нужен именно он; ключи от шкафа и сундука не подходят.'}
                </p>
                <ul>
                  {room.reference?.objects.map((object) => (
                    <li key={object.id}>
                      {object.label}:{' '}
                      {object.location === 'bag' ? 'в сумке Марты' : 'на столе'}
                      {object.id === room.reference?.indicatedId
                        ? '; кот указал на этот предмет, понятный обоим'
                        : ''}
                      .
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Правило the и отличие от a/an</summary>
                  {room.episode === 'theApple' ? (
                    <p>{theAppleRule}</p>
                  ) : (
                    theLesson.slice(1, 4).map((part) => (
                      <section key={part.title}>
                        <h3>{part.title}</h3>
                        <p>{part.text}</p>
                      </section>
                    ))
                  )}
                </details>
              </section>
            )}
            {room.reference && room.definition.presentation && (
              <section>
                <h3>Предметы и общий выбор</h3>
                <ul>
                  {room.reference.objects.map((object) => (
                    <li key={object.id}>
                      {object.label}:{' '}
                      {object.location === 'selected'
                        ? object.count === 2
                          ? 'выбраны, стоят отдельно'
                          : 'выбран, стоит отдельно'
                        : object.location === 'bag'
                          ? 'в сумке'
                          : object.location === 'door'
                            ? 'у двери'
                            : 'на стойке'}
                      {room.reference?.knownIds.includes(object.id)
                        ? object.count === 2
                          ? '; понятны обоим'
                          : '; понятен обоим'
                        : ''}
                      .
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(room.episode === 'choiceKey' ||
              room.episode === 'choiceApple') && (
              <section>
                <h3>
                  Перед дорогой · {room.episode === 'choiceKey' ? '1' : '2'} из
                  2
                </h3>
                {choiceStories[room.episode].lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {room.completed && (
                  <p>
                    {room.episode === 'choiceKey'
                      ? 'Один ключ уже в сумке помощника; два остались на столе.'
                      : 'Одно яблоко уже в сумке помощника рядом с ключом; два остались на столе.'}
                  </p>
                )}
                <details>
                  <summary>Вспомнить правило a/an</summary>
                  <p>{choiceRule}</p>
                </details>
              </section>
            )}
            {room.episode === 'key' && (
              <section>
                <h3>
                  <span lang="en">key</span> — ключ
                </h3>
                <p>{keyIntroduction[0]}</p>
                <p>
                  В сумку нужен один из трёх одинаковых запасных ключей; ни один
                  заранее не выделен.
                </p>
                {room.completed && (
                  <p>Один ключ уже в сумке. Остальные два остались на столе.</p>
                )}
              </section>
            )}
            {room.episode === 'apple' && (
              <section>
                <div className="lesson-example">
                  <img
                    src={`${art}props/apple-v1.png`}
                    alt="Рисованное яблоко"
                    width="76"
                    height="76"
                  />
                  <span lang="en">an apple</span>
                  <span>яблоко</span>
                </div>
                {appleLesson.map((part) => (
                  <section key={part.title}>
                    <h3>{part.title}</h3>
                    <p>{part.text}</p>
                  </section>
                ))}
                {room.completed && (
                  <p>
                    Одно яблоко уже в сумке. Остальные два остались на столе.
                  </p>
                )}
              </section>
            )}
            {room.episode === 'egg' && (
              <section>
                <div className="lesson-example">
                  <img
                    src={`${art}props/egg-v1.png`}
                    alt="Рисованное яйцо"
                    width="76"
                    height="76"
                  />
                  <span lang="en">egg</span>
                  <span>яйцо</span>
                </div>
                <p>{eggIntroduction[1]}</p>
                <p>
                  На столе три варёных яйца. Марта просит любое одно; ни одно
                  заранее не выделено.
                </p>
                {room.completed && (
                  <p>Одно яйцо уже в сумке. Остальные два остались на столе.</p>
                )}
                <details>
                  <summary>Вспомнить правило a/an</summary>
                  <p>{eggRule}</p>
                </details>
              </section>
            )}
            <details>
              <summary>Правило и слова</summary>
              <RuleContent />
            </details>
            {room.inventory.length > 0 && (
              <details>
                <summary>Собрано в этом эпизоде</summary>
                <ul>
                  {room.inventory.map((object) => (
                    <li key={object.id}>
                      {object.noun}:{' '}
                      {object.location === 'door'
                        ? 'ждёт у двери'
                        : 'в дорожной сумке'}
                      .
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <>
            <section>
              <h3>Управление</h3>
              <p>
                WASD или стрелки — шаг на одну клетку. WASD работают и при
                русской раскладке. Z или Backspace — отмена; Enter — передать
                просьбу; Escape — меню.
              </p>
              <p>
                На телефоне удобнее играть в альбомной ориентации. Крестовина
                или короткий свайп по сцене. Один жест — одна клетка.
                Диагональные и случайные короткие касания не двигают Люми. Если
                блок застрял, используй отмену.
              </p>
            </section>
            <details>
              <summary>Как устроено поле</summary>
              <p className="position">
                Люми: столбец {room.x + 1}, ряд {room.y + 1} · Ходов:{' '}
                {room.moves}
              </p>
              <p>
                Поле: {level.columns} столбцов, {level.rows} ряда. Считаем слева
                направо и сверху вниз. Деревянный ящик можно толкать.
              </p>
              <p>
                Препятствия:{' '}
                {level.walls
                  .map((p) => `столбец ${p.x + 1}, ряд ${p.y + 1}`)
                  .join('; ') || 'нет'}
                .
              </p>
              <p>
                Рамка в порядке чтения:{' '}
                {level.slots
                  .map((p, i) => `${i + 1}) столбец ${p.x + 1}, ряд ${p.y + 1}`)
                  .join('; ')}
                .
              </p>
              {level.optionalLeadingArticle && (
                <p>
                  Справа — название предметов. Слева — место для артикля; его
                  можно оставить пустым. Выбирай по смыслу просьбы.
                </p>
              )}
              {level.allowContractions && (
                <p>
                  Сокращение занимает одну клетку вместо двух слов. Начинай
                  слева без пропусков; последняя клетка остаётся пустой. Полная
                  форма заполняет всю рамку.
                </p>
              )}
              {level.message?.exchange && (
                <p>
                  Начинай слева без пропусков. Свободные клетки справа
                  допустимы: полная запись, сокращение и короткий ответ могут
                  иметь разную длину. Запятая, вопросительный знак и регистр
                  букв оформляются в записи автоматически.
                </p>
              )}
              <ul>
                {room.pieces.map((piece) => (
                  <li key={piece.id}>
                    {piece.kind === 'word' ? piece.word : 'Ящик'}: столбец{' '}
                    {piece.x + 1}, ряд {piece.y + 1}.
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </>
  );
}
