// Owner: A. Hit-testing for the stroke eraser.
import type { Stroke } from "../types";

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Does a circle at (x, y) with `radius` touch the stroke? Precise-eraser strokes are never hit. */
export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  if (stroke.tool === "eraser-precise" || stroke.tool === "eraser-stroke" || stroke.tool === "lasso") return false;
  const reach = radius + stroke.size / 2;
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= reach;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= reach) return true;
  }
  return false;
}
