import { useState } from "react";
import { isStaffLine, positionLabel } from "../../engine";
import type { Riff, Song } from "../../shared/types";
import { freshId } from "../lib/ids";
import {
  cleanTab,
  delayTimes,
  nextRiffName,
  parseRiffPaste,
  removeRiff,
  renameRiff,
  riffNameProblem,
  tabAsShape,
  tabFromShape,
} from "../lib/riffs";

interface Props {
  song: Song;
  onChange(song: Song): void;
}

interface Draft {
  /** null while adding a new riff. */
  id: string | null;
  name: string;
  hint: string;
  ref: string;
  /** Shown and typed in shape space under the capo. */
  tab: string;
}

/** The delay line for a tempo, or null when the chart has none set. */
export function delayLine(bpm: number | undefined): string | null {
  if (!bpm) return null;
  const d = delayTimes(bpm);
  return `Delay: dotted 8th ${d.dottedEighth} ms (quarter ${d.quarter}, 8th ${d.eighth})`;
}

/**
 * The electric part of a chart: a tone line with delay times from the tempo,
 * and named riffs in ASCII tab that the chord rows cue by name.
 */
export function RiffPanel({ song, onChange }: Props) {
  const riffs = song.riffs ?? [];
  const [open, setOpen] = useState(() => riffs.length > 0 || Boolean(song.tone));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulk, setBulk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const delay = delayLine(song.bpm);

  function startAdd() {
    setBulk(null);
    setError(null);
    setDraft({ id: null, name: nextRiffName(riffs), hint: "", ref: "", tab: "" });
  }

  function startEdit(riff: Riff) {
    setBulk(null);
    setError(null);
    setDraft({
      id: riff.id,
      name: riff.name,
      hint: riff.hint ?? "",
      ref: riff.ref ?? "",
      tab: tabAsShape(riff.tab, song.capo).join("\n"),
    });
  }

  function saveDraft() {
    if (!draft) return;
    const name = draft.name.trim();
    const problem = riffNameProblem(name, riffs, draft.id ?? undefined);
    if (problem) return setError(problem);
    const lines = cleanTab(draft.tab);
    if (!lines.some(isStaffLine)) return setError("Paste at least one tab staff line, like e|---0---|.");
    const fields = {
      tab: tabFromShape(lines, song.capo),
      hint: draft.hint.trim() || undefined,
      ref: draft.ref.trim() || undefined,
    };
    if (draft.id === null) {
      onChange({ ...song, riffs: [...riffs, { id: freshId(), name, ...fields }] });
    } else {
      const renamed = renameRiff(song, draft.id, name);
      onChange({
        ...renamed,
        riffs: (renamed.riffs ?? []).map((r) => (r.id === draft.id ? { ...r, ...fields } : r)),
      });
    }
    setDraft(null);
    setError(null);
  }

  function saveBulk() {
    if (bulk === null) return;
    const parsed = parseRiffPaste(bulk);
    if (parsed.length === 0) return setError("No tab staff lines found. Each riff needs lines like e|---0---|.");
    const added: Riff[] = [];
    for (const r of parsed) {
      const all = [...riffs, ...added];
      const name = r.name && !riffNameProblem(r.name, all) ? r.name : nextRiffName(all);
      added.push({ ...r, id: freshId(), name, tab: tabFromShape(r.tab, song.capo) });
    }
    onChange({ ...song, riffs: [...riffs, ...added] });
    setBulk(null);
    setError(null);
  }

  return (
    <details className="riff-panel" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Electric{riffs.length > 0 && <span className="muted"> ({riffs.length} riff{riffs.length === 1 ? "" : "s"})</span>}</summary>
      <div className="tone-row">
        <input
          value={song.tone ?? ""}
          placeholder="Tone: clean, light drive on the bridge, plate verb"
          onChange={(e) => onChange({ ...song, tone: e.target.value || undefined })}
          aria-label="Tone"
        />
        <span className={delay ? "delay-pill" : "muted"}>
          {delay ?? "Set a tempo on the scroll bar to see delay times."}
        </span>
      </div>

      {riffs.length > 0 && (
        <div className="riff-cards">
          {riffs.map((riff) => {
            const shown = tabAsShape(riff.tab, song.capo);
            return (
              <div className="riff-card" key={riff.id}>
                <div className="riff-head">
                  <strong>{riff.name}</strong>
                  {[positionLabel(shown), riff.ref && `ref ${riff.ref}`].filter(Boolean).map((t) => (
                    <span key={t as string} className="muted"> · {t}</span>
                  ))}
                  <span className="riff-actions">
                    <button className="mini" onClick={() => startEdit(riff)}>Edit</button>
                    <button
                      className="mini danger"
                      onClick={() => {
                        if (window.confirm(`Delete ${riff.name} and its cues?`)) onChange(removeRiff(song, riff.id));
                      }}
                    >
                      Delete
                    </button>
                  </span>
                </div>
                <pre>{shown.join("\n")}</pre>
                {riff.hint && <div className="riff-hint">{riff.hint}</div>}
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="riff-form">
          <div className="riff-form-row">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Riff name" placeholder="Riff A" />
            <input value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} aria-label="Reference time" placeholder="0:42 in the recording" />
          </div>
          <input
            className="riff-hint-input"
            value={draft.hint}
            onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
            aria-label="Riff hint"
            placeholder="Where it plays and how: Intro and turnarounds, starts on the B string, let it ring"
          />
          <textarea
            rows={8}
            value={draft.tab}
            onChange={(e) => setDraft({ ...draft, tab: e.target.value })}
            aria-label="Riff tab"
            placeholder={"e|---------------|\nB|-----------0---|\nG|-------0-2---0-|\nD|-0-2-4---------|\nA|---------------|\nE|---------------|"}
          />
          {song.capo > 0 && <p className="muted">Tab is in shape space for capo {song.capo}: frets counted from the capo.</p>}
          <div className="riff-form-row">
            <button className="primary" onClick={saveDraft}>{draft.id === null ? "Add riff" : "Save riff"}</button>
            <button onClick={() => { setDraft(null); setError(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {bulk !== null && (
        <div className="riff-form">
          <p className="muted">
            Paste one or more riffs. A line before each staff names it, as Name | hint | ref, for example
            "Intro hook | Intro and turnarounds | 0:12". Staves with no line between them stay one riff.
          </p>
          <textarea rows={12} value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Riffs to paste" />
          <div className="riff-form-row">
            <button className="primary" onClick={saveBulk}>Add riffs</button>
            <button onClick={() => { setBulk(null); setError(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="status">{error}</p>}

      {!draft && bulk === null && (
        <div className="riff-form-row">
          <button onClick={startAdd}>Add riff</button>
          <button onClick={() => { setDraft(null); setError(null); setBulk(""); }}>Paste several</button>
          {riffs.length > 0 && (
            <span className="muted">Cue a riff by clicking a spot in a chord row and picking its name.</span>
          )}
        </div>
      )}
    </details>
  );
}
