// Owner: B. STUB from Step 0 — signature is fixed; replace the body in Step 2a.
// Groups ink strokes into handwritten lines, top to bottom.
import type { LineBox, Stroke } from "../types";

export function segmentLines(strokes: Stroke[]): LineBox[] {
  const ink = strokes.filter((s) => s.tool !== "highlighter" && !s.tool.startsWith("eraser"));
  if (ink.length === 0) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of ink) for (const [x, y] of s.points) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [{ index: 1, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, strokeIds: ink.map((s) => s.id) }];
}
