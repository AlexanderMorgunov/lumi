import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GameSession } from '../game/session';
import type { Direction, PuzzleAction } from '../domain/puzzle';
import type { SceneLoadState, WordTarget } from '../game/create-game';
import type { CatMouth } from '../game/cat-mouth';

const directions: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

export function GameViewport({
  session,
  container,
  onAction,
  onMenu,
  conversation,
  listening,
  speechBlocked,
  playing,
  onSpeak,
  speaker,
  getMouth,
}: {
  session: GameSession;
  container: RefObject<HTMLDivElement | null>;
  onAction: (action: PuzzleAction) => void;
  onMenu: () => void;
  conversation: boolean;
  listening: boolean;
  speechBlocked: boolean;
  playing: string | null;
  onSpeak: (word: string) => void;
  speaker: string;
  getMouth: () => CatMouth;
}) {
  const [targets, setTargets] = useState<WordTarget[]>([]);
  const relayout = useRef<(() => void) | undefined>(undefined);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const [loadState, setLoadState] = useState<SceneLoadState>('loading');
  useEffect(() => {
    const parent = container.current;
    if (!parent) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    session.setPaused('assets', true);
    const onLoadState = (state: SceneLoadState) => {
      if (cancelled) return;
      setLoadState(state);
      session.setPaused('assets', state !== 'ready');
    };
    void import('../game/create-game')
      .then(({ createGame }) => {
        if (cancelled) return;
        const game = createGame(
          parent,
          session,
          onLoadState,
          (words) => {
            if (!cancelled) setTargets(words);
          },
          getMouth,
        );
        relayout.current = () => game.events.emit('room-layout');
        const resize = new ResizeObserver(() => {
          game.scale.resize(parent.clientWidth, parent.clientHeight);
          relayout.current?.();
        });
        resize.observe(parent);
        destroy = () => {
          resize.disconnect();
          relayout.current = undefined;
          game.destroy(true);
        };
      })
      .catch(() => {
        onLoadState('error');
      });
    return () => {
      cancelled = true;
      destroy?.();
      session.setPaused('assets', false);
    };
  }, [session, container, getMouth]);
  useEffect(() => {
    relayout.current?.();
  }, [conversation, listening]);

  return (
    <>
      {loadState === 'error' && (
        <p role="alert" className="session-message">
          Сцена не загрузилась. Перезагрузите страницу, чтобы повторить.
        </p>
      )}
      {loadState === 'loading' && (
        <p className="session-message">Загружаем сцену…</p>
      )}
      <div
        className="viewport"
        ref={container}
        data-scene-state={loadState}
        data-conversation={conversation}
        data-speaker={conversation ? speaker : ''}
        data-listening={listening}
        tabIndex={0}
        role="group"
        aria-label="Игровое поле. WASD или стрелки — ход и толкание, Z — отмена, Enter — передать фразу, Escape — меню."
        onPointerDown={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          if (
            !event.isPrimary ||
            event.button !== 0 ||
            session.getSnapshot().paused
          ) {
            gesture.current = null;
            return;
          }
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
        }}
        onPointerUp={(event) => {
          const start = gesture.current;
          gesture.current = null;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x,
            dy = event.clientY - start.y;
          const x = Math.abs(dx),
            y = Math.abs(dy);
          if (Math.max(x, y) < 28 || Math.max(x, y) < Math.min(x, y) * 1.3)
            return;
          onAction({
            type: 'move',
            direction:
              x > y ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
          });
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget && event.key !== 'Escape')
            return;
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          const direction = directions[event.code] ?? directions[event.key];
          if (direction) {
            event.preventDefault();
            if (!event.repeat) onAction({ type: 'move', direction });
          }
          if (event.code === 'KeyZ' || event.key === 'Backspace') {
            event.preventDefault();
            if (!event.repeat) onAction({ type: 'undo' });
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!event.repeat) onAction({ type: 'apply' });
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            if (!event.repeat) onMenu();
          }
        }}
      >
        {listening && loadState === 'ready' && (
          <div
            className="word-hit-layer"
            role="group"
            aria-label="Прослушивание слов на поле"
          >
            {targets.map((target) => (
              <button
                key={target.id}
                className="word-hit-target"
                style={{
                  left: target.x,
                  top: target.y,
                  width: Math.max(44, target.width),
                  height: Math.max(44, target.height),
                }}
                aria-label={`Послушать ${target.word} на поле`}
                data-sfx="none"
                aria-pressed={playing === target.word}
                disabled={speechBlocked}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={() => onSpeak(target.word)}
              >
                <span aria-hidden="true">◖))</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
