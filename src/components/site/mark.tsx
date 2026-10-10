/**
 * Rally: two paddles and a ball, read as "back and forth". Drawn on a 16px
 * grid (like Tab Math's mark) so it stays crisp as a favicon. Same drawing as
 * src/app/icon.svg; keep the two in sync.
 * Same construction rules as Tab Math's icon: black square, white shapes, no radius.
 */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      <rect width="16" height="16" fill="#000" />
      <rect x="3" y="4" width="2" height="8" fill="#fff" />
      <rect x="11" y="4" width="2" height="8" fill="#fff" />
      <rect x="8" y="7" width="2" height="2" fill="#fff" />
    </svg>
  );
}
