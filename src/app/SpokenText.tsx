import { pronunciationParts } from '../domain/pronunciation';

export function SpokenText({
  text,
  playing,
  disabled,
  onSpeak,
}: {
  text: string;
  playing: string | null;
  disabled: boolean;
  onSpeak: (term: string) => void;
}) {
  return pronunciationParts(text).map((part, index) =>
    part.term ? (
      <button
        key={index}
        className="spoken-word"
        lang="en"
        aria-label={`Послушать ${part.text}`}
        aria-pressed={playing === part.term}
        disabled={disabled}
        onClick={() => onSpeak(part.term!)}
      >
        {part.text}
      </button>
    ) : (
      part.text
    ),
  );
}
