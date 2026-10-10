// Owner: B. STUB from Step 0 — signature is fixed; replace the body in Step 2b.
// Deterministic step checker: "Gemini reads, math verifies."
import type { CheckedLine, ReadLine } from "../types";

export type LineVerdict = Pick<CheckedLine, "verdict" | "verifiedBy" | "note">;

export function verifyLines(lines: ReadLine[]): LineVerdict[] {
  return lines.map(() => ({ verdict: "unclear", verifiedBy: "ai" }));
}
