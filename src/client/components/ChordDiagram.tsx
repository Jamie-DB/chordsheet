import type { Voicing } from "../../engine";

interface Props {
  label: string;
  voicing: Voicing;
  /** Tooltip when the shape approximates the labeled chord. */
  title?: string;
}

const STRINGS = 6;
const FRETS_SHOWN = 4;
const LEFT = 10;
const RIGHT = 50;
const TOP = 24;
const BOTTOM = 68;
const STRING_GAP = (RIGHT - LEFT) / (STRINGS - 1);
const FRET_GAP = (BOTTOM - TOP) / FRETS_SHOWN;

/** One chord grid: name above, X/O markers, dots on a 4-fret window. */
export function ChordDiagram({ label, voicing, title }: Props) {
  const { frets, baseFret } = voicing;
  const xFor = (string: number) => LEFT + string * STRING_GAP;

  return (
    <svg
      className="chord-diagram"
      viewBox="0 0 64 74"
      width="70"
      height="82"
      role="img"
      aria-label={`${label} chord diagram`}
    >
      {title && <title>{title}</title>}
      <text x="30" y="9" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="inherit" fill="currentColor">
        {label}
      </text>

      {frets.map((f, i) =>
        f > 0 ? null : (
          <text
            key={`m${i}`}
            x={xFor(i)}
            y="19"
            textAnchor="middle"
            fontSize="7"
            fontFamily="inherit"
            fill="currentColor"
          >
            {f === 0 ? "o" : "x"}
          </text>
        ),
      )}

      {baseFret === 1 ? (
        <rect x={LEFT - 0.5} y={TOP - 2.5} width={RIGHT - LEFT + 1} height="2.5" fill="currentColor" />
      ) : (
        <text x={RIGHT + 2.5} y={TOP + FRET_GAP * 0.65} fontSize="6.5" fontFamily="inherit" fill="currentColor">
          {baseFret}fr
        </text>
      )}

      {Array.from({ length: STRINGS }, (_, i) => (
        <line key={`s${i}`} x1={xFor(i)} y1={TOP} x2={xFor(i)} y2={BOTTOM} stroke="currentColor" strokeWidth="0.8" />
      ))}
      {Array.from({ length: FRETS_SHOWN + 1 }, (_, i) => (
        <line
          key={`f${i}`}
          x1={LEFT}
          y1={TOP + i * FRET_GAP}
          x2={RIGHT}
          y2={TOP + i * FRET_GAP}
          stroke="currentColor"
          strokeWidth="0.8"
        />
      ))}

      {frets.map((f, i) => {
        if (f <= 0) return null;
        const row = f - baseFret;
        if (row < 0 || row >= FRETS_SHOWN) return null;
        return (
          <circle
            key={`d${i}`}
            cx={xFor(i)}
            cy={TOP + (row + 0.5) * FRET_GAP}
            r="3.4"
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}
