interface Props {
  bpm: number;
  playing: boolean;
  onToggle(): void;
  onBpm(bpm: number): void;
}

/**
 * Floating performance control. Speed is expressed in BPM; the actual pixel
 * rate assumes one chord+lyric pair spans 8 beats (two 4/4 bars), and the
 * slider exists precisely because that assumption needs tuning by ear.
 */
export function AutoScrollBar({ bpm, playing, onToggle, onBpm }: Props) {
  return (
    <div className="autoscroll">
      <button
        className="primary"
        onClick={(e) => {
          onToggle();
          e.currentTarget.blur();
        }}
        title="Space also toggles"
      >
        {playing ? "Pause" : "Scroll"}
      </button>
      <input
        type="range"
        min={20}
        max={240}
        step={2}
        value={bpm}
        aria-label="Scroll speed in BPM"
        onChange={(e) => onBpm(Number(e.target.value))}
      />
      <span className="autoscroll-bpm">{bpm} BPM</span>
    </div>
  );
}
