import { describe, expect, it } from "vitest";
import type { Stroke, ToolKind } from "../types";
import { segmentLines } from "./segment";

let n = 0;
/** A stroke drawn as a zigzag inside the box (x, y, w, h). */
const s = (x: number, y: number, w: number, h: number, tool: ToolKind = "pen"): Stroke => ({
  id: `s${++n}`, tool, color: "#000", size: 3, createdAt: 0,
  points: [[x, y, 0.5], [x + w / 2, y + h, 0.5], [x + w, y, 0.5]],
});

describe("segmentLines", () => {
  it("three written lines -> three boxes, top to bottom, 1-based", () => {
    const strokes = [
      s(100, 300, 60, 40), s(180, 302, 80, 38), // line 3
      s(100, 100, 50, 40), s(170, 105, 120, 35), s(310, 98, 40, 42), // line 1
      s(100, 200, 70, 40), s(190, 198, 90, 44), // line 2
    ];
    const lines = segmentLines(strokes);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.index)).toEqual([1, 2, 3]);
    expect(lines[0].strokeIds).toHaveLength(3);
    expect(lines[0].box.y).toBeLessThan(lines[1].box.y);
  });

  it("a fraction (numerator / bar / denominator) stays one line with what's next to it", () => {
    const lines = segmentLines([
      s(100, 100, 40, 30), // numerator
      s(95, 136, 55, 2), // fraction bar
      s(100, 145, 40, 30), // denominator
      s(170, 122, 30, 25), // "="
      s(220, 118, 40, 34), // "5"
      s(100, 260, 200, 40), // a real second line below
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].strokeIds).toHaveLength(5);
  });

  it("an exponent stays with its base", () => {
    const lines = segmentLines([s(100, 120, 40, 40), s(145, 100, 15, 18), s(180, 125, 60, 35), s(100, 240, 150, 40)]);
    expect(lines).toHaveLength(2);
    expect(lines[0].strokeIds).toHaveLength(3);
  });

  it("two real lines written close together stay apart", () => {
    // ~32-unit handwriting on 48-unit ruled paper: the gap between lines is about half a line height
    const lines = segmentLines([s(100, 100, 200, 32), s(100, 150, 120, 32)]);
    expect(lines).toHaveLength(2);
  });

  it("ignores highlighter, erasers and lasso", () => {
    expect(segmentLines([s(0, 0, 100, 20, "highlighter"), s(0, 0, 10, 10, "eraser-stroke"), s(0, 0, 10, 10, "lasso")])).toEqual([]);
  });

  it("pads boxes by 8 units", () => {
    const [l] = segmentLines([s(100, 100, 50, 40)]);
    expect(l.box.x).toBeCloseTo(100 - 1.5 - 8);
    expect(l.box.y).toBeCloseTo(100 - 1.5 - 8);
  });
});
