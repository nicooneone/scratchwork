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
/** Dark-mode counterparts of INK_COLORS, index for index (white is the default ink in dark mode). */
export const INK_COLORS_DARK = ["#ffffff", "#d8dbe3", "#7aa5ff", "#ff6b5e", "#62cc92", "#c49cf5"];
export const HIGHLIGHTER_COLORS = ["#ffe14d", "#7ff0a0", "#7fd3ff", "#ff9ecf", "#ffb36b"];

type InkTheme = "light" | "dark";

export function inkPalette(theme: InkTheme): string[] {
  return theme === "dark" ? INK_COLORS_DARK : INK_COLORS;
}

/** The highlighter layer is translucent; on dark paper it needs more body to read as color, not mud. */
export function highlighterOpacity(theme: InkTheme): number {
  return theme === "dark" ? 0.55 : 0.35;
}

/**
 * Adaptive ink: how a stored ink color looks in a theme. Palette colors swap to their counterpart
 * (navy ↔ white, blue ↔ light blue …), so a page written in either mode stays readable in both.
 * Custom colors pass through, except near-black in dark mode and near-white in light mode, which
 * would vanish into the paper.
 */
export function themedInk(color: string, theme: InkTheme): string {
  const c = color.toLowerCase();
  const from = theme === "dark" ? INK_COLORS : INK_COLORS_DARK;
  const i = from.indexOf(c);
  if (i >= 0) return inkPalette(theme)[i];
  const l = luminance(c);
  if (l === null) return color;
  if (theme === "dark" && l < 0.03) return INK_COLORS_DARK[0];
  if (theme === "light" && l > 0.85) return INK_COLORS[0];
  return color;
}

/** WCAG relative luminance of #rgb / #rrggbb (null for anything else). */
function luminance(c: string): number | null {
  let h = c.replace("#", "");
  if (/^[0-9a-f]{3}$/.test(h)) h = [...h].map((ch) => ch + ch).join("");
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map((k) => {
    const v = parseInt(h.slice(k, k + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isEraser(tool: ToolKind): boolean {
  return tool === "eraser-stroke" || tool === "eraser-precise";
}

/** Tools whose strokes are saved on the page (not the stroke eraser, which only deletes, or the lasso). */
export function savesStroke(tool: ToolKind): boolean {
  return tool !== "eraser-stroke" && tool !== "lasso";
}
