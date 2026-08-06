import { describe, expect, it } from "vitest";
import { voicingFor } from "./shapes";

const X = -1;

describe("voicingFor", () => {
  it("returns open-position chords from the table", () => {
    expect(voicingFor("C")!.voicing).toEqual({ frets: [X, 3, 2, 0, 1, 0], baseFret: 1 });
    expect(voicingFor("Em")!.voicing.frets).toEqual([0, 2, 2, 0, 0, 0]);
    expect(voicingFor("B7")!.voicing.frets).toEqual([X, 2, 1, 2, 0, 2]);
    expect(voicingFor("C")!.approximated).toBe(false);
  });

  it("builds movable barre shapes for roots without open forms", () => {
    const fsharpm = voicingFor("F#m")!;
    expect(fsharpm.voicing.frets).toEqual([2, 4, 4, 2, 2, 2]);
    expect(fsharpm.voicing.baseFret).toBe(1);
    const eb = voicingFor("Eb")!;
    expect(eb.voicing.frets).toEqual([X, 6, 8, 8, 8, 6]);
    expect(eb.voicing.baseFret).toBe(6);
    expect(eb.approximated).toBe(false);
  });

  it("treats 2-chords as sus2 without calling it an approximation", () => {
    const a2 = voicingFor("A2")!;
    expect(a2.voicing.frets).toEqual([X, 0, 2, 2, 0, 0]);
    expect(a2.approximated).toBe(false);
  });

  it("voices Csus as the one-finger move from open C", () => {
    const csus = voicingFor("Csus")!;
    expect(csus.voicing.frets).toEqual([X, 3, 3, 0, 1, 0]);
    expect(csus.approximated).toBe(false);
  });

  it("simplifies extended chords to the closest reasonable shape", () => {
    const cmaj9 = voicingFor("Cmaj9")!;
    expect(cmaj9.playedAs).toBe("Cmaj7");
    expect(cmaj9.approximated).toBe(true);
    const g13 = voicingFor("G13")!;
    expect(g13.playedAs).toBe("G7");
    expect(g13.approximated).toBe(true);
    const em11 = voicingFor("Em11")!;
    expect(em11.playedAs).toBe("Em7");
    expect(em11.approximated).toBe(true);
  });

  it("uses known slash voicings and drops unknown basses", () => {
    const gOverB = voicingFor("G/B")!;
    expect(gOverB.voicing.frets).toEqual([X, 2, 0, 0, 3, 3]);
    expect(gOverB.approximated).toBe(false);
    const fOverA = voicingFor("F/A")!;
    expect(fOverA.voicing.frets).toEqual([X, 0, 3, 2, 1, 0]);
    expect(fOverA.approximated).toBe(false);
    const ebOverBb = voicingFor("Eb/Bb")!;
    expect(ebOverBb.approximated).toBe(true);
    expect(ebOverBb.playedAs).toBe("Eb");
  });

  it("handles diminished and power chords", () => {
    expect(voicingFor("Bm7b5")!.voicing.frets).toEqual([X, 2, 3, 2, 3, X]);
    expect(voicingFor("A5")!.voicing.frets).toEqual([5, 7, 7, X, X, X]);
  });

  it("keeps every root coverable for core qualities", () => {
    const roots = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
    for (const root of roots) {
      for (const quality of ["", "m", "7", "m7", "maj7", "sus4", "dim", "aug"]) {
        expect(voicingFor(root + quality), root + quality).not.toBeNull();
      }
    }
  });

  it("returns null only for unparseable symbols", () => {
    expect(voicingFor("???")).toBeNull();
    expect(voicingFor("N.C.")).toBeNull();
  });
});
