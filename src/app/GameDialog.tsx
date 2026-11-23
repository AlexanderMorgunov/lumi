import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { GameSession } from '../game/session';

export function GameDialog({
  session,
  field,
  title,
  onClose,
  children,
  className = '',
  onBack,
}: {
  session: GameSession;
  field: RefObject<HTMLDivElement | null>;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  onBack?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const viewport = field.current;
    const target =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : viewport;
    if (!dialog) return;
    session.setPaused('overlay', true);
    dialog.showModal();
    return () => {
      dialog.close();
      session.setPaused('overlay', false);
      if (target?.isConnected && target.getClientRects().length)
        target.focus({ preventScroll: true });
      else viewport?.focus({ preventScroll: true });
    };
  }, [session, field]);
  useEffect(() => {
    const heading = ref.current?.querySelector('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [title]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={title}
      onKeyDown={(event) => {
        // A nested route is not a dismissal. Keep the native CloseWatcher from
        // force-closing after repeated cancelled Escapes (e.g. after Tab to chrome).
        // Nested native dialogs, such as an episode preview, own their Escape.
        if (
          event.key === 'Escape' &&
          onBack &&
          event.target instanceof Element &&
          event.target.closest('dialog') === event.currentTarget
        ) {
          event.preventDefault();
          event.stopPropagation();
          onBack();
        }
      }}
      onClose={() => {
        // Native/system dismissal must also release the game's overlay pause.
        if (ref.current && !ref.current.open) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        (onBack ?? onClose)();
      }}
    >
      {children}
    </dialog>
  );
}
