// Owner: A. Render a region of a page to a PNG for Gemini.
// Step 0 version: simple polyline replay + gray L1:, L2: labels in a left margin.
// Step 1 replaces the polylines with perfect-freehand outlines (same signature).
import type { Box, LineBox, Stroke } from "../types";

const MARGIN = 60; // page units added on the left for line labels
const MAX_EDGE = 1600; // px

export async function renderToPng(
  strokes: Stroke[],
  region: Box,
  opts: { lineNumbers?: LineBox[] } = {},
): Promise<string> {
  const r = { x: region.x - MARGIN, y: region.y, w: region.w + MARGIN, h: region.h };
  const scale = Math.min(2, MAX_EDGE / Math.max(r.w, r.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(r.w * scale));
  canvas.height = Math.max(1, Math.round(r.h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, -r.x * scale, -r.y * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ink in order; precise erases cut through earlier ink. Highlighter is skipped.
  for (const s of strokes) {
    if (s.tool === "highlighter" || s.tool === "lasso" || s.tool === "eraser-stroke") continue;
    if (s.points.length === 0) continue;
    ctx.globalCompositeOperation = s.tool === "eraser-precise" ? "destination-out" : "source-over";
    ctx.strokeStyle = s.tool === "eraser-precise" ? "#000" : "#000"; // black ink reads best
    ctx.lineWidth = Math.max(2, s.size);
    ctx.beginPath();
    ctx.moveTo(s.points[0][0], s.points[0][1]);
    for (const [x, y] of s.points) ctx.lineTo(x, y);
    if (s.points.length === 1) ctx.lineTo(s.points[0][0] + 0.1, s.points[0][1]);
    ctx.stroke();
  }

  // White paper underneath everything drawn so far.
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = "source-over";

  // Margin rule + line labels.
  if (opts.lineNumbers?.length) {
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(region.x - 6, r.y);
    ctx.lineTo(region.x - 6, r.y + r.h);
    ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.font = "18px sans-serif";
    ctx.textBaseline = "middle";
    for (const l of opts.lineNumbers) {
      ctx.fillText(`L${l.index + 1}:`, r.x + 6, l.box.y + l.box.h / 2);
    }
  }

  const url = canvas.toDataURL("image/png");
  canvas.width = 0; // free memory on iPad
  return url.slice(url.indexOf(",") + 1);
}
