/**
 * The hold-diamond enclosure: a stroked, transparent elongated diamond
 * stretched over the chord text. Stroke-only so section tints and
 * anything beneath show through; absolutely positioned so layout and
 * monospace columns are untouched.
 */
export function DiamondOutline() {
  return (
    <svg className="diamond-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polygon
        points="14,2 86,2 98,50 86,98 14,98 2,50"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
