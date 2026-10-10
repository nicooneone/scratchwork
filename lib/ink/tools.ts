// Owner: A. Tool presets for perfect-freehand.
import type { StrokeOptions } from "perfect-freehand";
import type { ToolKind } from "../types";

export function strokeOptions(tool: ToolKind, size: number, realPressure: boolean, last = false): StrokeOptions {
  const base: StrokeOptions = { size, last, simulatePressure: !realPressure };
  switch (tool) {
    case "fineliner":
      return { ...base, thinning: 0, smoothing: 0.5, streamline: 0.4 };
    case "pencil":
      return { ...base, thinning: 0.3, smoothing: 0.5, streamline: 0.4 };
    case "eraser-precise":
      return { ...base, thinning: 0, smoothing: 0.5, streamline: 0.3 };
    case "pen":
    default:
      return { ...base, thinning: 0.6, smoothing: 0.5, streamline: 0.5 };
  }
}

export const DEFAULT_SIZES: Record<ToolKind, number> = {
  pen: 4,
  fineliner: 3,
  pencil: 3,
  highlighter: 22,
  "eraser-stroke": 18,
  "eraser-precise": 14,
  lasso: 2,
};
