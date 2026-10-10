// Owner: A. Tool presets: how each tool looks and its default size/color.
import type { StrokeOptions } from "perfect-freehand";
import type { ToolKind } from "../types";

export interface ToolPreset {
  label: string;
  defaultSize: number; // page units
  minSize: number;
  maxSize: number;
  /** perfect-freehand options for filled-outline tools (pen, fineliner, pencil). */
  freehand?: StrokeOptions;
}

export const TOOL_PRESETS: Record<ToolKind, ToolPreset> = {
  pen: {
    label: "Fountain pen",
    defaultSize: 4,
    minSize: 1.5,
    maxSize: 14,
    freehand: { thinning: 0.5, smoothing: 0.5, streamline: 0.45, start: { taper: 0, cap: true }, end: { taper: 0, cap: true } },
  },
  fineliner: {
    label: "Fineliner",
    defaultSize: 3,
    minSize: 1,
    maxSize: 12,
    freehand: { thinning: 0, smoothing: 0.5, streamline: 0.45, start: { cap: true }, end: { cap: true } },
  },
  pencil: {
    label: "Pencil",
    defaultSize: 3,
    minSize: 1,
    maxSize: 10,
    freehand: { thinning: 0.3, smoothing: 0.4, streamline: 0.35, start: { cap: true }, end: { cap: true } },
  },
  highlighter: { label: "Highlighter", defaultSize: 24, minSize: 10, maxSize: 48 },
  "eraser-stroke": { label: "Stroke eraser", defaultSize: 14, minSize: 6, maxSize: 60 },
  "eraser-precise": { label: "Precise eraser", defaultSize: 12, minSize: 4, maxSize: 60 },
  lasso: { label: "Lasso", defaultSize: 2, minSize: 2, maxSize: 2 },
};

export const INK_COLORS = ["#1d2a44", "#111111", "#2456c9", "#c8322b", "#2f7d4f", "#7a3fb0"];
export const HIGHLIGHTER_COLORS = ["#ffe14d", "#7ff0a0", "#7fd3ff", "#ff9ecf", "#ffb36b"];

export function isEraser(tool: ToolKind): boolean {
  return tool === "eraser-stroke" || tool === "eraser-precise";
}

/** Tools whose strokes are saved on the page (not the stroke eraser, which only deletes, or the lasso). */
export function savesStroke(tool: ToolKind): boolean {
  return tool !== "eraser-stroke" && tool !== "lasso";
}
