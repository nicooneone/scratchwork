// Owner: B. Group ink strokes into handwritten lines, top to bottom.
//
// 1. Ignore highlighter, eraser and lasso strokes. Bounding box per stroke.
// 2. Sort by vertical center. Greedy clustering: a stroke joins the current line if their
//    vertical ranges overlap by >= 40% of the smaller height.
// 3. Merge pass: a cluster merges into its nearest neighbor when it is short (< 0.6 x typical
//    line height, e.g. an exponent or integral limit) or when it sits inside the neighbor's
//    x-range with a small gap (< 0.35 x typical height, e.g. a fraction's numerator).
//    Real lines written close together have bigger gaps, so they stay apart.
// 4. Pad boxes by 8 units. Index is 1-based to match the "L1:" labels in the exported PNG.
import type { Box, LineBox, Stroke } from "../types";

const PAD = 8;
const MIN_H = 4; // a "-" or "=" stroke is nearly flat; give it some height

interface Cluster {
  top: number;
  bottom: number;
  left: number;
  right: number;
  ids: string[];
}

function bounds(s: Stroke): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of s.points) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const r = s.size / 2;
  return { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: Math.max(MIN_H, y1 - y0 + 2 * r) };
}

const height = (c: Cluster) => Math.max(MIN_H, c.bottom - c.top);
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
const gapBetween = (a: Cluster, b: Cluster) => Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
const absorb = (into: Cluster, c: Cluster) => {
  into.top = Math.min(into.top, c.top);
  into.bottom = Math.max(into.bottom, c.bottom);
  into.left = Math.min(into.left, c.left);
  into.right = Math.max(into.right, c.right);
  into.ids.push(...c.ids);
};

/** Typical line height: median of the taller half (so a few exponents don't drag it down). */
function typicalHeight(cs: Cluster[]): number {
  const hs = cs.map(height).sort((a, b) => b - a);
  const top = hs.slice(0, Math.ceil(hs.length / 2));
  return top[Math.floor((top.length - 1) / 2)] ?? MIN_H;
}

export function segmentLines(strokes: Stroke[]): LineBox[] {
  const ink = strokes.filter(
    (s) => s.points.length > 0 && s.tool !== "highlighter" && s.tool !== "lasso" && !s.tool.startsWith("eraser"),
  );
  if (ink.length === 0) return [];

  const items = ink
    .map((s) => ({ id: s.id, b: bounds(s) }))
    .sort((a, b) => a.b.y + a.b.h / 2 - (b.b.y + b.b.h / 2));

  // Greedy clustering by vertical overlap.
  const clusters: Cluster[] = [];
  for (const { id, b } of items) {
    const cur = clusters[clusters.length - 1];
    if (cur && overlap(cur.top, cur.bottom, b.y, b.y + b.h) >= 0.4 * Math.min(height(cur), b.h)) {
      absorb(cur, { top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w, ids: [id] });
    } else {
      clusters.push({ top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w, ids: [id] });
    }
  }

  // Merge small fragments (exponents, limits, fraction parts) into their nearest line.
  const H = typicalHeight(clusters);
  let changed = true;
  while (changed && clusters.length > 1) {
    changed = false;
    clusters.sort((a, b) => a.top - b.top);
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const neighbors = [clusters[i - 1], clusters[i + 1]].filter(Boolean) as Cluster[];
      const best = neighbors
        .map((n) => ({ n, gap: gapBetween(c, n) }))
        .sort((a, b) => a.gap - b.gap)[0];
      if (!best) continue;
      // A fragment that sits entirely under its neighbor with a real gap is the first glyph of the
      // NEXT line (e.g. a lone "x" or "=" the student just started), not an exponent or a limit.
      // Merging it would corrupt the line above until the new line grows. Denominators and lower
      // limits still merge: they sit tight under their line (gap well under 0.2 H) and inside its width.
      const below = c.top >= best.n.bottom;
      const newLine = below && best.gap >= 0.2 * H;
      const short = !below && height(c) < 0.6 * H && best.gap < H;
      const inside = !newLine && c.left >= best.n.left - PAD && c.right <= best.n.right + PAD && best.gap < 0.35 * H;
      if ((short || inside) && height(c) <= height(best.n)) {
        absorb(best.n, c);
        clusters.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return clusters
    .sort((a, b) => a.top - b.top)
    .map((c, i) => ({
      index: i + 1,
      box: { x: c.left - PAD, y: c.top - PAD, w: c.right - c.left + 2 * PAD, h: c.bottom - c.top + 2 * PAD },
      strokeIds: c.ids,
    }));
}
