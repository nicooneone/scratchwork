// Owner: A. STUB from Step 0 — signature is fixed; replace the body in Step 1.
// Renders ink (ink only, on white) for a page region to a base64 PNG (no data: prefix).
import type { Box, LineBox, Stroke } from "../types";

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

export async function renderToPng(
  _strokes: Stroke[],
  _region: Box,
  _opts?: { lineNumbers?: LineBox[] },
): Promise<string> {
  return ONE_PIXEL_PNG;
}
