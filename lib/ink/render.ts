// Owner: A. Draws strokes onto a 2D canvas context that is already scaled to page units.
import { getStroke } from "perfect-freehand";
import type { Stroke } from "../types";
import { TOOL_PRESETS } from "./tools";

/** perfect-freehand outline → SVG path data (quadratic curves through midpoints). */
function outlineToPath(outline: number[][]): string {
  if (outline.length < 4) return "";
  const avg = (a: number, b: number) => (a + b) / 2;
  let a = outline[0];
  let b = outline[1];
  const c = outline[2];
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2; i < outline.length - 1; i++) {
    a = outline[i];
    b = outline[i + 1];
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return d + "Z";
}

/** Outline path for pen / fineliner / pencil strokes. */
export function strokePath(stroke: Stroke, last = true): Path2D | null {
  const preset = TOOL_PRESETS[stroke.tool];
  if (!preset.freehand) return null;
  const outline = getStroke(stroke.points, {
    ...preset.freehand,
    size: stroke.size,
    simulatePressure: stroke.simulated ?? false,
    last,
  });
  const d = outlineToPath(outline);
  return d ? new Path2D(d) : null;
}

// Pencil grain: a small tile of the ink color with random transparency, cached per color.
const grainCache = new Map<string, CanvasPattern | null>();
function pencilGrain(ctx: CanvasRenderingContext2D, color: string): CanvasPattern | string {
  if (!grainCache.has(color)) {
    const tile = document.createElement("canvas");
    tile.width = tile.height = 48;
    const t = tile.getContext("2d")!;
    t.fillStyle = color;
    t.fillRect(0, 0, 48, 48);
    const img = t.getImageData(0, 0, 48, 48);
    let seed = 7;
    for (let i = 3; i < img.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      img.data[i] = 120 + (seed % 136); // alpha 120–255
    }
    t.putImageData(img, 0, 0);
    grainCache.set(color, ctx.createPattern(tile, "repeat"));
  }
  return grainCache.get(color) ?? color;
}

/** Smooth polyline through the points (used by the highlighter and the precise eraser). */
function polyline(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  if (pts.length > 1) ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

export interface DrawOptions {
  /** Draw the pencil as plain solid ink (used for the AI export, where grain hurts reading). */
  plainPencil?: boolean;
  /** The stroke is still being drawn. */
  live?: boolean;
}

/** Draw one stroke. Highlighter strokes are drawn opaque: the highlighter layer itself is translucent. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, opts: DrawOptions = {}) {
  if (stroke.points.length === 0) return;
  ctx.save();
  switch (stroke.tool) {
    case "highlighter":
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      polyline(ctx, stroke);
      ctx.stroke();
      break;
    case "eraser-precise":
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      polyline(ctx, stroke);
      ctx.stroke();
      break;
    case "eraser-stroke":
    case "lasso":
      break; // never saved
    default: {
      const path = strokePath(stroke, !opts.live);
      if (!path) break;
      if (stroke.tool === "pencil" && !opts.plainPencil) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = pencilGrain(ctx, stroke.color);
      } else {
        ctx.fillStyle = stroke.color;
      }
      ctx.fill(path);
    }
  }
  ctx.restore();
}

/** Clear and redraw both committed layers from scratch (page switch, undo/redo, stroke erase). */
export function redrawAll(ink: CanvasRenderingContext2D, highlight: CanvasRenderingContext2D, strokes: Stroke[]) {
  clear(ink);
  clear(highlight);
  for (const s of strokes) drawStroke(s.tool === "highlighter" ? highlight : ink, s);
}

export function clear(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
