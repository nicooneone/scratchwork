// Owner: A. Renders a page region to a PNG for the AI to read.
// Ink only (no template, no highlighter) on white, with precise erases applied, plus gray
// "L1:", "L2:" … labels in a left margin so Gemini can say which line is which.
import type { Box, LineBox, Stroke } from "../types";
import { visibleInk } from "./crossout";
import { drawStroke } from "./render";

const MARGIN = 60; // page units added on the left for line labels
const MAX_EDGE = 1600; // px, keeps requests well under Vercel's 4.5 MB body limit
const MAX_SCALE = 4; // small crops (one short line) are upscaled so the glyphs stay big enough to read
const PAD = 12;

export async function renderToPng(
  strokes: Stroke[],
  region: Box,
  opts: { lineNumbers?: LineBox[] } = {},
): Promise<string> {
  const labels = opts.lineNumbers ?? [];
  const r = {
    x: region.x - PAD - (labels.length ? MARGIN : 0),
    y: region.y - PAD,
    w: region.w + PAD * 2 + (labels.length ? MARGIN : 0),
    h: region.h + PAD * 2,
  };
  const scale = Math.min(MAX_SCALE, MAX_EDGE / Math.max(r.w, r.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(r.w * scale));
  canvas.height = Math.max(1, Math.round(r.h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, -r.x * scale, -r.y * scale);

  // 1. Replay ink in order on a transparent canvas, so precise erases remove what's under them.
  //    Crossed-out writing (and the strike or scribble through it) is treated as deleted.
  for (const s of visibleInk(strokes).visible) {
    if (s.tool === "highlighter") continue;
    drawStroke(ctx, s, { plainPencil: true });
  }

  // 2. Line labels and a margin rule.
  if (labels.length) {
    const ruleX = r.x + MARGIN - 8;
    ctx.save();
    ctx.strokeStyle = "#c4c9d4";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ruleX, r.y);
    ctx.lineTo(ruleX, r.y + r.h);
    ctx.stroke();
    ctx.fillStyle = "#8a93a6";
    ctx.font = "600 20px ui-monospace, Menlo, monospace";
    ctx.textBaseline = "middle";
    for (const line of labels) ctx.fillText(`L${line.index}:`, r.x + 4, line.box.y + line.box.h / 2);
    ctx.restore();
  }

  // 3. White paper behind everything.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  return canvas.toDataURL("image/png").split(",")[1];
}

/** Bounding box of a set of strokes, in page units (null if empty). */
export function strokesBounds(strokes: Stroke[]): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    const half = s.size / 2;
    for (const [x, y] of s.points) {
      x0 = Math.min(x0, x - half);
      y0 = Math.min(y0, y - half);
      x1 = Math.max(x1, x + half);
      y1 = Math.max(y1, y + half);
    }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
