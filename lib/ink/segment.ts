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
//
// Side-by-side problems (columns): before step 2 runs for real, a first rough row pass looks for
// big horizontal gaps inside rows (> max(2.5 x line height, 90 units)). A gap that lines up across
// at least two rows (or one very wide gap, > max(4 H, 160)) is a column gutter. Every stroke is
// assigned to a column by its center, then steps 2-3 run inside each column separately, so a line
// on the left never swallows the line next to it on the right. Lines come out sorted by column,
// then top to bottom, with LineBox.column set (0 = leftmost).
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

type Item = { id: string; b: Box };

/** Greedy clustering by vertical overlap (items sorted by vertical center). */
function roughRows(items: Item[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const { id, b } of items) {
    const cur = clusters[clusters.length - 1];
    if (cur && overlap(cur.top, cur.bottom, b.y, b.y + b.h) >= 0.4 * Math.min(height(cur), b.h)) {
      absorb(cur, { top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w, ids: [id] });
    } else {
      clusters.push({ top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w, ids: [id] });
    }
  }
  return clusters;
}

/** x positions of column gutters (sorted), found from big horizontal gaps that line up across rows. */
export function columnSeparators(items: Item[]): number[] {
  const rows = roughRows(items);
  const H = typicalHeight(rows);
  const G = Math.max(2.5 * H, 90), BIG = Math.max(4 * H, 160);
  const byId = new Map(items.map((it) => [it.id, it.b]));
  const gaps: { l: number; r: number }[] = [];
  for (const row of rows) {
    const bs = row.ids.map((id) => byId.get(id)!).sort((a, b) => a.x - b.x);
    let right = bs[0].x + bs[0].w;
    for (const b of bs.slice(1)) {
      if (b.x - right > G) gaps.push({ l: right, r: b.x });
      right = Math.max(right, b.x + b.w);
    }
  }
  // Group gaps that overlap horizontally; each group with enough support becomes one gutter.
  gaps.sort((a, b) => a.l - b.l);
  const groups: { l: number; r: number; lo: number; hi: number; n: number; widest: number }[] = [];
  for (const g of gaps) {
    const grp = groups.find((x) => overlap(x.l, x.r, g.l, g.r) > 0);
    if (grp) {
      grp.l = Math.max(grp.l, g.l); // intersection: where every row's gap agrees
      grp.r = Math.min(grp.r, g.r);
      grp.lo = Math.min(grp.lo, g.l);
      grp.hi = Math.max(grp.hi, g.r);
      grp.n++;
      grp.widest = Math.max(grp.widest, g.r - g.l);
    } else groups.push({ l: g.l, r: g.r, lo: g.l, hi: g.r, n: 1, widest: g.r - g.l });
  }
  return groups
    .filter((g) => g.n >= 2 || g.widest > BIG)
    .map((g) => (g.l < g.r ? (g.l + g.r) / 2 : (g.lo + g.hi) / 2))
    .sort((a, b) => a - b);
}

export function segmentLines(strokes: Stroke[]): LineBox[] {
  const ink = strokes.filter(
    (s) => s.points.length > 0 && s.tool !== "highlighter" && s.tool !== "lasso" && !s.tool.startsWith("eraser"),
  );
  if (ink.length === 0) return [];

  const items: Item[] = ink
    .map((s) => ({ id: s.id, b: bounds(s) }))
    .sort((a, b) => a.b.y + a.b.h / 2 - (b.b.y + b.b.h / 2));

  const seps = columnSeparators(items);
  const columns: Item[][] = Array.from({ length: seps.length + 1 }, () => []);
  for (const it of items) {
    const cx = it.b.x + it.b.w / 2;
    columns[seps.filter((x) => x < cx).length].push(it);
  }
  const out: LineBox[] = [];
  columns.forEach((col, c) => {
    if (!col.length) return;
    for (const cl of segmentColumn(col)) {
      out.push({
        index: out.length + 1,
        box: { x: cl.left - PAD, y: cl.top - PAD, w: cl.right - cl.left + 2 * PAD, h: cl.bottom - cl.top + 2 * PAD },
        strokeIds: cl.ids,
        ...(seps.length ? { column: columns.slice(0, c).filter((x) => x.length).length } : {}),
      });
    }
  });
  return out;
}

/** Steps 2-3 for one column of strokes. Returns clusters sorted top to bottom. */
function segmentColumn(items: Item[]): Cluster[] {
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

  return clusters.sort((a, b) => a.top - b.top);
}
