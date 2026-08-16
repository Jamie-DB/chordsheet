import { useEffect, useRef, useState } from "react";

interface Props {
  col: number;
  initial: string;
  initialHold: boolean;
  isNew: boolean;
  /** Validates a typed shape symbol; empty text is always allowed (delete/cancel). */
  validate(text: string): boolean;
  onCommit(text: string, hold: boolean): void;
  onCancel(): void;
}

export function ChordEditPopover({ col, initial, initialHold, isNew, validate, onCommit, onCancel }: Props) {
  const [text, setText] = useState(initial);
  const [hold, setHold] = useState(initialHold);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const trimmed = text.trim();
  const valid = trimmed.length === 0 || validate(trimmed);

  function commit() {
    if (!valid) return;
    onCommit(trimmed, hold);
  }

  return (
    <span className="chord-popover" style={{ left: `${col}ch` }} onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className={valid ? "" : "invalid"}
        value={text}
        size={7}
        placeholder="Am7"
        onChange={(e) => setText(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <label className="hold-toggle" title="Full-measure hold, drawn as a diamond">
        <input
          type="checkbox"
          checked={hold}
          onChange={(e) => setHold(e.target.checked)}
          onPointerDown={(e) => e.stopPropagation()}
        />
        &#9671;
      </label>
      <button className="mini" disabled={!valid} onClick={commit} title={isNew ? "Add" : "Save"}>
        {isNew ? "Add" : "Save"}
      </button>
      {!isNew && (
        <button className="mini danger" onClick={() => onCommit("", false)} title="Delete chord">
          Delete
        </button>
      )}
      <button className="mini" onClick={onCancel} title="Cancel">
        Esc
      </button>
    </span>
  );
}
