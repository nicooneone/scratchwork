// Owner: A. Draw strokes onto a 2D context in page units.
import { getStroke } from "perfect-freehand";
import type { Stroke } from "../types";
import { strokeOptions } from "./tools";

/** perfect-freehand outline -> Path2D (quadratic smoothing between outline points). */
export function outlinePath(points: number[][]): Path2D {
  const p = new Path2D();
  if (points.length < 2) return p;
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    p.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  p.closePath();
  return p;
}

const hasRealPressure = (s: Stroke) => s.points.some((pt) => pt[2] !== 0.5);

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, live = false) {
  if (s.points.length === 0 || s.tool === "eraser-stroke" || s.tool === "lasso") return;

  if (s.tool === "highlighter") {
    // Flat, square-ended marker. The highlighter canvas element has CSS opacity,
    // so overlaps don't darken.
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0][0], s.points[0][1]);
    for (const [x, y] of s.points) ctx.lineTo(x, y);
    ctx.stroke();
    return;
  }

  const outline = getStroke(s.points, strokeOptions(s.tool, s.size, hasRealPressure(s), !live));
  const path = outlinePath(outline);
  ctx.globalCompositeOperation = s.tool === "eraser-precise" ? "destination-out" : "source-over";
  ctx.globalAlpha = s.tool === "pencil" ? 0.75 : 1;
  ctx.fillStyle = s.tool === "eraser-precise" ? "#000" : s.color;
  ctx.fill(path);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** Distance from point p to segment ab. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** True if a circle at (x, y) with radius r touches the stroke. */
export function hitsStroke(s: Stroke, x: number, y: number, r: number): boolean {
  const reach = r + s.size / 2;
  const pts = s.points;
  if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] - y) <= reach;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= reach) return true;
  }
  return false;
}
