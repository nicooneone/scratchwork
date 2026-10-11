import { describe, expect, it } from "vitest";
import type { Stroke } from "../types";
import { visibleInk } from "./crossout";

let n = 0;
/** A stroke through the given points, densified so segments are short like real Pencil samples. */
function stroke(pts: [number, number][]): Stroke {
  const dense: [number, number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let t = 0; t < 1; t += 0.1) dense.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, 0.5]);
  }
  dense.push([...pts[pts.length - 1], 0.5]);
  return { id: `s${++n}`, tool: "pen", color: "#000", size: 3, createdAt: n, points: dense };
}

// Glyphs in a 40 x 50 cell whose top-left is (x, y).
const glyph = {
  two: (x: number, y: number) => [stroke([[x + 6, y + 12], [x + 14, y + 2], [x + 28, y], [x + 36, y + 12], [x + 32, y + 24], [x + 4, y + 50], [x + 38, y + 50]])],
  seven: (x: number, y: number) => [stroke([[x + 4, y], [x + 36, y], [x + 14, y + 50]])],
  x: (x: number, y: number) => [stroke([[x + 4, y + 18], [x + 36, y + 50]]), stroke([[x + 36, y + 18], [x + 4, y + 50]])],
  plus: (x: number, y: number) => [stroke([[x + 20, y + 14], [x + 20, y + 46]]), stroke([[x + 6, y + 30], [x + 34, y + 30]])],
  minus: (x: number, y: number) => [stroke([[x + 6, y + 30], [x + 34, y + 30]])],
  five: (x: number, y: number) => [stroke([[x + 34, y], [x + 8, y], [x + 6, y + 22], [x + 22, y + 20], [x + 34, y + 32], [x + 24, y + 50], [x + 6, y + 46]])],
  t: (x: number, y: number) => [stroke([[x + 18, y], [x + 18, y + 44], [x + 28, y + 50]]), stroke([[x + 8, y + 16], [x + 30, y + 16]])],
  g: (x: number, y: number) => [stroke([[x + 32, y + 22], [x + 18, y + 18], [x + 8, y + 30], [x + 20, y + 40], [x + 32, y + 30], [x + 32, y + 62], [x + 18, y + 72], [x + 6, y + 66]])],
};

/** "2x+5" written at (x, y). */
const twoXPlusFive = (x: number, y: number) => [...glyph.two(x, y), ...glyph.x(x + 44, y), ...glyph.plus(x + 88, y), ...glyph.five(x + 132, y)];

const hidden = (strokes: Stroke[]) => visibleInk(strokes).crossed;

describe("visibleInk: cross-outs", () => {
  it("a line struck through the middle of an expression hides the expression and the strike", () => {
    const ink = twoXPlusFive(100, 100);
    const strike = stroke([[92, 126], [184, 124], [280, 127]]);
    const { visible, crossed } = visibleInk([...ink, strike]);
    expect(visible).toHaveLength(0);
    expect(crossed.size).toBe(ink.length + 1);
  });

  it("striking through part of a line hides only that part", () => {
    const keep = glyph.two(100, 100);
    const gone = glyph.seven(160, 100);
    const strike = stroke([[154, 124], [206, 126]]);
    const { visible } = visibleInk([...keep, ...gone, strike]);
    expect(visible.map((s) => s.id)).toEqual(keep.map((s) => s.id));
  });

  it("a scribble over a digit hides it", () => {
    const seven = glyph.seven(100, 100);
    const scribble = stroke([[96, 110], [144, 114], [98, 122], [146, 128], [96, 136], [144, 142], [98, 148]]);
    expect(hidden([...seven, scribble]).size).toBe(2);
  });

  it("new work written after a strike-through stays visible", () => {
    const old = twoXPlusFive(100, 100);
    const strike = stroke([[92, 126], [280, 126]]);
    const fresh = glyph.seven(300, 100);
    const { visible } = visibleInk([...old, strike, ...fresh]);
    expect(visible.map((s) => s.id)).toEqual(fresh.map((s) => s.id));
  });
});

describe("visibleInk: normal math is never treated as crossed out", () => {
  it("plus sign (bar drawn across the stem)", () => {
    expect(hidden(glyph.plus(100, 100)).size).toBe(0);
  });
  it("x (second stroke crosses the first)", () => {
    expect(hidden(glyph.x(100, 100)).size).toBe(0);
  });
  it("t crossbar", () => {
    expect(hidden(glyph.t(100, 100)).size).toBe(0);
  });
  it("not-equal sign (steep slash through =)", () => {
    const eq = [stroke([[100, 120], [140, 120]]), stroke([[100, 134], [140, 134]])];
    const slash = stroke([[132, 104], [108, 150]]);
    expect(hidden([...eq, slash]).size).toBe(0);
  });
  it("fraction bar drawn after the numerator and denominator", () => {
    const num = glyph.two(110, 60);
    const den = glyph.seven(110, 130);
    const bar = stroke([[100, 120], [160, 120]]);
    expect(hidden([...num, ...den, bar]).size).toBe(0);
  });
  it("underline under a word with a descender", () => {
    const word = [...glyph.t(100, 100), ...glyph.g(140, 100)];
    const underline = stroke([[96, 164], [190, 165]]);
    expect(hidden([...word, underline]).size).toBe(0);
  });
  it("a full normal line: 2x+5=7", () => {
    const line = [...twoXPlusFive(100, 100), ...glyph.minus(176, 92), ...glyph.minus(176, 104), ...glyph.seven(220, 100)];
    expect(hidden(line).size).toBe(0);
  });
});
