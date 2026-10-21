/** Serif-italic section title with an optional text link on the far side. */
export function SectionHeading({
  title,
  linkLabel,
  onLink,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-serif-display text-serif-section text-text-title">{title}</h2>
      {linkLabel && (
        <button type="button" onClick={onLink} className="font-wide text-eyebrow text-brand">
          {linkLabel}
        </button>
      )}
    </div>
  );
}
