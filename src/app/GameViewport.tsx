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
  location,
  retryBlocked,
  active,
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
  location: 'workshop' | 'station';
  retryBlocked: boolean;
  active: boolean;
}) {
  const [targets, setTargets] = useState<WordTarget[]>([]);
  const relayout = useRef<(() => void) | undefined>(undefined);
  const retryScene = useRef<(() => void) | undefined>(undefined);
  const setSceneActive = useRef<((active: boolean) => void) | undefined>(
    undefined,
  );
  const activeRef = useRef(active);
  const sceneState = useRef<SceneLoadState>('loading');
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const [loadState, setLoadState] = useState<SceneLoadState>('loading');
  const [engineAttempt, setEngineAttempt] = useState(0);
  useEffect(() => {
    activeRef.current = active;
    setSceneActive.current?.(active);
    session.setPaused('assets', active && sceneState.current !== 'ready');
  }, [active, session]);
  useEffect(() => {
    const parent = container.current;
    if (!parent) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    session.setPaused('assets', activeRef.current);
    const onLoadState = (state: SceneLoadState) => {
      if (cancelled) return;
      sceneState.current = state;
      setLoadState(state);
      session.setPaused('assets', activeRef.current && state !== 'ready');
    };
    void import('../game/create-game')
      .then(({ createGame }) => {
        if (cancelled) return;
        const scene = createGame(
          parent,
          session,
          onLoadState,
          (words) => {
            if (!cancelled) setTargets(words);
          },
          getMouth,
          activeRef.current,
        );
        const { game } = scene;
        retryScene.current = scene.retry;
        setSceneActive.current = scene.setActive;
        relayout.current = () => game.events.emit('room-layout');
        const resize = new ResizeObserver((entries) => {
          const { clientWidth, clientHeight } = parent;
          if (entries.some((entry) => entry.target === parent))
            gesture.current = null;
          if (
            clientWidth !== game.scale.width ||
            clientHeight !== game.scale.height
          ) {
            game.scale.resize(clientWidth, clientHeight);
          } else {
            relayout.current?.();
          }
        });
        resize.observe(parent);
        const boardSpace = parent.parentElement?.querySelector(
          '.landscape-board-space',
        );
        if (boardSpace) resize.observe(boardSpace);
        destroy = () => {
          resize.disconnect();
          relayout.current = undefined;
          retryScene.current = undefined;
          setSceneActive.current = undefined;
          scene.destroy();
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
  }, [session, container, getMouth, engineAttempt]);
  useEffect(() => {
    relayout.current?.();
  }, [conversation, listening]);

  function retry() {
    const { externallyPaused, closed } = session.getSnapshot();
    if (externallyPaused || closed) return;
    container.current?.focus({ preventScroll: true });
    if (retryScene.current) {
      retryScene.current();
    } else {
      sceneState.current = 'loading';
      setLoadState('loading');
      setEngineAttempt((attempt) => attempt + 1);
    }
  }

  return (
    <>
      <div
        role={loadState === 'loading' ? 'status' : undefined}
        aria-live="polite"
        aria-atomic="true"
        className="session-message"
      >
        {loadState === 'loading' &&
          (location === 'station'
            ? 'Загружаем станцию…'
            : 'Загружаем мастерскую…')}
      </div>
      {loadState === 'error' && (
        <div className="session-message">
          <p role="alert">Сцена не загрузилась</p>
          <button type="button" disabled={retryBlocked} onClick={retry}>
            Повторить загрузку
          </button>
        </div>
      )}
      <div
        id="game-scene"
        className="viewport"
        ref={container}
        data-scene-state={loadState}
        data-conversation={conversation}
        data-speaker={conversation ? speaker : ''}
        data-listening={listening}
        tabIndex={loadState === 'ready' && !conversation ? 0 : -1}
        aria-busy={loadState === 'loading'}
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
