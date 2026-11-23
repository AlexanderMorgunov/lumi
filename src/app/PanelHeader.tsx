// Shared presentation only: the owning panel keeps its focus, pause and close logic.
export function PanelHeader({
  title,
  eyebrow,
  closeLabel,
  onClose,
  onBack,
  backLabel = 'Назад в меню',
}: {
  title: string;
  eyebrow: string;
  closeLabel: string;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="panel-header">
      <div>
        {onBack && (
          <button className="panel-back" onClick={onBack}>
            ← {backLabel}
          </button>
        )}
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <button type="button" aria-label={closeLabel} onClick={onClose}>
        ×
      </button>
    </header>
  );
}
