export function GameWindowButton({
  expanded,
  pending,
  onClick,
}: {
  expanded: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const label = expanded ? 'Свернуть игру' : 'На всё окно';
  return (
    <button
      className="title-sound game-window-button"
      aria-label={label}
      title={label}
      aria-pressed={expanded}
      disabled={pending}
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d={
            expanded
              ? 'M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5'
              : 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'
          }
        />
      </svg>
    </button>
  );
}
