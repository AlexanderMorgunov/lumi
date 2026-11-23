import { useEffect, useRef } from 'react';
import './station.css';

export function ChapterArrival({
  onEnter,
  onBack,
  blocked,
}: {
  onEnter: () => void;
  onBack: () => void;
  blocked: boolean;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      className="chapter-arrival"
      aria-label="Дорога к станции"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !blocked) {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <div className="arrival-copy">
        <span className="eyebrow">ГЛАВА II · ДОРОГА ОГНЕЙ</span>
        <h1>Станция встреч</h1>
        <p>
          Марта заперла мастерскую. Кот остался греться у окна, а Люми и Тик
          вышли на мокрую тропу. У почтовой станции Марта догнала их.
        </p>
        <p>
          Под навесом лежали сорванные ветром бирки. Тик поднял одну: «Начнём с
          имён. Кто пришёл на станцию?»
        </p>
        <p className="arrival-topic">Первое сообщение · как представиться</p>
        <div className="arrival-actions">
          <button
            ref={button}
            className="primary"
            disabled={blocked}
            onClick={onEnter}
          >
            Подойти к станции →
          </button>
          <button disabled={blocked} onClick={onBack}>
            К карте фонарей
          </button>
        </div>
      </div>
    </section>
  );
}
