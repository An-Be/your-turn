/**
 * Placeholder mark: two bars trading sides, read as "you, then me".
 * Same construction rules as Tab Math's icon: solid square, bars cut out, no radius.
 * Drawn with tokens so it inverts in dark mode (ink square, paper bars).
 */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" className="fill-ink" />
      <rect x="20" y="30" width="44" height="12" className="fill-paper" />
      <rect x="36" y="58" width="44" height="12" className="fill-paper" />
    </svg>
  );
}
