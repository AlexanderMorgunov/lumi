import type { ReactNode } from 'react';
import type { PuzzleState } from '../domain/puzzle';
import { episodes } from '../domain/episodes';
import { PanelHeader } from './PanelHeader';
import { LumiPortrait } from './Prologue';

export function PauseMenu({
  room,
  onClose,
  onOpen,
  onTitle,
  windowButton,
}: {
  room: PuzzleState;
  onClose: () => void;
  onOpen: (
    panel: 'journey' | 'words' | 'journal' | 'settings' | 'restart',
  ) => void;
  onTitle: () => void;
  windowButton: ReactNode;
}) {
  return (
    <>
      <PanelHeader
        title="Пауза"
        eyebrow="ЛЮМИ И ДОРОГА ОГНЕЙ"
        closeLabel="Закрыть меню"
        onClose={onClose}
      />
      <div className="pause-body panel-scroll">
        <section className="pause-current">
          <div className="pause-flame" aria-hidden="true">
            <LumiPortrait />
          </div>
          <p className="eyebrow">
            {room.definition.message
              ? 'ГЛАВА 2 · СТАНЦИЯ ВСТРЕЧ'
              : 'ГЛАВА 1 · МАСТЕРСКАЯ У ЛЕСА'}
          </p>
          <h3>{episodes[room.episode].title}</h3>
          <p>Слова останутся на своих местах.</p>
          <button className="primary" onClick={onClose}>
            Продолжить <span aria-hidden="true">→</span>
          </button>
        </section>
        <nav className="pause-links" aria-label="Меню игры">
          <button
            aria-label="Карта фонарей · главы и эпизоды"
            onClick={() => onOpen('journey')}
          >
            <span>
              Карта фонарей<small>Главы и эпизоды</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
          <button onClick={() => onOpen('words')}>
            <span>
              Слова и произношение<small>Твоя дорожная коллекция</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
          <button onClick={() => onOpen('journal')}>
            <span>
              Дорожный журнал<small>Задание, правила и управление</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
          <button onClick={() => onOpen('settings')}>
            <span>
              Настройки<small>Звук, голоса и анимации</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </div>
      <footer className="panel-footer pause-footer">
        <div className="pause-secondary">
          <button onClick={() => onOpen('restart')}>
            Начать комнату заново
          </button>
        </div>
        <div className="pause-exit">
          {windowButton}
          <button onClick={onTitle}>В главное меню</button>
        </div>
      </footer>
    </>
  );
}
