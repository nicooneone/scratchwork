import { describe, expect, it } from "vitest";
import type { Stroke } from "../types";
import { currentBlock } from "./blocks";
import { segmentLines } from "./segment";

let n = 0;
const s = (x: number, y: number, w: number, h: number, createdAt = 0): Stroke => ({
  id: `c${++n}`, tool: "pen", color: "#000", size: 3, createdAt,
  points: [[x, y, 0.5], [x + w / 2, y + h, 0.5], [x + w, y, 0.5]],
});
/** One handwritten "line" of a few glyph strokes starting at x. */
const row = (x: number, y: number, glyphs = 4, t = 0) => Array.from({ length: glyphs }, (_, i) => s(x + i * 45, y, 35, 40, t));

describe("side-by-side problems", () => {
  it("two columns of three lines become six lines, left column first", () => {
    const strokes = [
      ...row(80, 100), ...row(560, 104),
      ...row(80, 180), ...row(560, 176),
      ...row(80, 260), ...row(560, 262),
    ];
    const lines = segmentLines(strokes);
    expect(lines).toHaveLength(6);
    expect(lines.map((l) => l.column)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(lines.map((l) => l.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(lines[3].box.x).toBeGreaterThan(500);
  });

  it("a single line with normal word spacing is not split", () => {
    const lines = segmentLines([...row(80, 100, 3), ...row(260, 100, 3), ...row(80, 200, 5)]);
    expect(lines).toHaveLength(2);
    expect(lines[0].column).toBeUndefined();
  });

  it("starting a second problem far to the right makes a new column right away", () => {
    const lines = segmentLines([...row(80, 100), ...row(80, 180), ...row(620, 100, 3)]);
    expect(lines).toHaveLength(3);
    expect(lines.filter((l) => l.column === 1)).toHaveLength(1);
  });

  it("Live Check picks the column being written in", () => {
    const strokes = [...row(80, 100, 4, 1), ...row(80, 180, 4, 2), ...row(560, 104, 4, 3), ...row(560, 180, 4, 9)];
    const block = currentBlock(segmentLines(strokes), strokes);
    expect(block).toHaveLength(2);
    expect(block.every((l) => l.box.x > 500)).toBe(true);
    expect(block.map((l) => l.index)).toEqual([1, 2]);
  });
});
