// Owner: A. Finds crossed-out writing, so Live Check, Ask and the notebook index treat it as deleted.
//
// Students rarely erase: they strike through a mistake or scribble over it and keep going. Those
// strokes are still on the page, so without this the reader would see "3x + 12" with a line through
// it and still compare the next line against it.
//
// Two kinds of cross-out, both drawn AFTER the writing they cover:
//  - Strike-through: a long, straight, mostly horizontal stroke through the middle of earlier ink.
//  - Scribble: a back-and-forth stroke (many left/right reversals) over earlier ink.
//
// Things that must NOT count, each covered by a test: the bar of "+", the strokes of "x", the slash
// of "≠", the crossbar of "t", fraction bars (they sit between ink, not through it) and underlines
// (they cut descenders near the bottom, not through the middle).
import type { Stroke } from "../types";

type P = [number, number];

const isInk = (s: Stroke) => s.tool === "pen" || s.tool === "fineliner" || s.tool === "pencil";

interface Shape {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  pts: P[];
}

const shapes = new WeakMap<Stroke, Shape>();
function shape(s: Stroke): Shape {
  let sh = shapes.get(s);
  if (!sh) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    // Every 2nd point is plenty for intersection tests and halves the work.
    const pts: P[] = s.points.filter((_, i) => i % 2 === 0 || i === s.points.length - 1).map(([x, y]) => [x, y]);
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    sh = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, pts };
    shapes.set(s, sh);
  }
  return sh;
}

function pathLength(pts: P[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Number of left/right direction changes, ignoring jitter smaller than `minStep`. */
function xReversals(pts: P[], minStep: number): number {
  let dir = 0, count = 0, anchor = pts[0]?.[0] ?? 0;
  for (const [x] of pts) {
    const d = x - anchor;
    if (Math.abs(d) < minStep) continue;
    const nd = Math.sign(d);
    if (dir !== 0 && nd !== dir) count++;
    dir = nd;
    anchor = x;
  }
  return count;
}

function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const cross = (o: P, p: P, q: P) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  // Touching counts as crossing (a sample can land exactly on the other line); fully collinear doesn't.
  if (d1 === 0 && d2 === 0) return false;
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

/** Where (y) does stroke `a` cross stroke `b`? Empty if they don't cross. */
function crossingYs(a: Shape, b: Shape): number[] {
  if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) return [];
  const ys: number[] = [];
  for (let i = 1; i < a.pts.length; i++) {
    for (let j = 1; j < b.pts.length; j++) {
      if (segmentsCross(a.pts[i - 1], a.pts[i], b.pts[j - 1], b.pts[j])) ys.push((a.pts[i - 1][1] + a.pts[i][1]) / 2);
    }
  }
  return ys;
}

const overlapArea = (a: Shape, b: Shape) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));


/** Earlier ink a strike-through stroke crosses out, or null if it isn't a strike-through. */
function strikeTargets(s: Shape, earlier: Stroke[]): Stroke[] | null {
  const chord = Math.hypot(s.pts[s.pts.length - 1][0] - s.pts[0][0], s.pts[s.pts.length - 1][1] - s.pts[0][1]);
  if (chord < 20) return null;
  const straight = chord / Math.max(1e-6, pathLength(s.pts));
  const angle = Math.atan2(s.h, s.w) * (180 / Math.PI); // bbox angle: 0 = flat
  if (straight < 0.85 || angle > 25) return null;

  const midY = (s.y0 + s.y1) / 2;
  // The strike must go through the middle of the writing it crosses, judged against that whole line
  // of writing (not each glyph: a strike through the middle of "2x+5" passes near the top of the
  // short "x"). An underline or overline grazes the line's bottom or top instead.
  const inPath = earlier.map(shape).filter((t) => t.x1 >= s.x0 && t.x0 <= s.x1 && t.y0 - 6 <= midY && t.y1 + 6 >= midY);
  if (!inPath.length) return null;
  const top = Math.min(...inPath.map((t) => t.y0));
  const bottom = Math.max(...inPath.map((t) => t.y1));
  const rel = (midY - top) / Math.max(1, bottom - top);
  if (rel < 0.2 || rel > 0.8) return null;

  const hit: Stroke[] = [];
  for (const e of earlier) {
    const t = shape(e);
    const crosses = crossingYs(s, t).length > 0;
    // A flat glyph in the strike's path (a minus sign) runs alongside it instead of crossing it.
    const runsAlong = t.h < 0.25 * Math.max(t.w, 1) && t.x0 >= s.x0 - 4 && t.x1 <= s.x1 + 4 && Math.abs((t.y0 + t.y1) / 2 - midY) < 12;
    if (crosses || runsAlong) hit.push(e);
  }
  if (hit.length === 0) return null;
  const crossed = hit.filter((e) => !(shape(e).h < 0.25 * Math.max(shape(e).w, 1)));
  if (crossed.length >= 2) return hit;
  if (crossed.length === 1) {
    // One glyph struck out (a "7"): it must be a real glyph, not a thin stem like the "|" of "+" or
    // "t", and the strike must span most of it.
    const t = shape(crossed[0]);
    if (t.w >= 0.45 * t.h && s.w >= 0.7 * t.w) return hit;
  }
  return null;
}

/** Earlier ink a scribble covers, or null if it isn't a scribble. */
function scribbleTargets(s: Shape, earlier: Stroke[]): Stroke[] | null {
  const diag = Math.hypot(s.w, s.h);
  if (diag < 15 || xReversals(s.pts, Math.max(4, s.w * 0.15)) < 4 || pathLength(s.pts) < 2.5 * diag) return null;
  const hit = earlier.filter((e) => {
    const t = shape(e);
    const area = Math.max(1, t.w * t.h);
    return overlapArea(s, t) >= 0.5 * area || crossingYs(s, t).length >= 2;
  });
  return hit.length ? hit : null;
}

/**
 * Splits a page's strokes into what counts as written and what was crossed out.
 * `crossed` holds both the cross-out strokes and the strokes they cover.
 */
export function visibleInk(strokes: Stroke[]): { visible: Stroke[]; crossed: Set<string> } {
  const crossed = new Set<string>();
  const ink = strokes.filter(isInk);
  for (let i = 1; i < ink.length; i++) {
    const s = shape(ink[i]);
    if (s.pts.length < 2) continue;
    const earlier = ink.slice(0, i).filter((e) => !crossed.has(e.id));
    if (!earlier.length) continue;
    const targets = strikeTargets(s, earlier) ?? scribbleTargets(s, earlier);
    if (targets) {
      crossed.add(ink[i].id);
      for (const t of targets) crossed.add(t.id);
    }
  }
  return { visible: crossed.size ? strokes.filter((s) => !crossed.has(s.id)) : strokes, crossed };
}
