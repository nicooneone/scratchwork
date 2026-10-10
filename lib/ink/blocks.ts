// Owner: A. Splits a page's lines into separate problems ("blocks") at blank gaps, so Live Check
// only compares steps within one problem. Otherwise the first line of problem 2 would be judged
// against the last line of problem 1 and wrongly marked as an error.
import type { LineBox, Stroke } from "../types";


export function groupBlocks(lines: LineBox[]): LineBox[][] {
  if (lines.length === 0) return [];
  const sorted = [...lines].sort((a, b) => a.box.y - b.box.y);
  const gaps = sorted.slice(1).map((l, i) => l.box.y - (sorted[i].box.y + sorted[i].box.h));
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  // A new problem starts at a gap that is clearly bigger than this page's usual line spacing
  // (skipping a ruled line on lined paper, or leaving blank space on grid paper).
  const threshold = Math.max(0.9 * median(sorted.map((l) => l.box.h)), 2.2 * Math.max(0, median(gaps.length ? gaps : [0])));
  const blocks: LineBox[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (gaps[i - 1] > threshold) blocks.push([]);
    blocks[blocks.length - 1].push(sorted[i]);
  }
  return blocks;
}

/**
 * The problem the student is working on: the block containing their most recent ink stroke.
 * Lines are renumbered 1..n within the block (these numbers become the "L1:" labels).
 */
export function currentBlock(lines: LineBox[], strokes: Stroke[]): LineBox[] {
  const blocks = groupBlocks(lines);
  if (blocks.length === 0) return [];
  let newest: Stroke | undefined;
  for (const s of strokes) {
    if (s.tool === "highlighter" || s.tool === "lasso" || s.tool.startsWith("eraser")) continue;
    if (!newest || s.createdAt >= newest.createdAt) newest = s;
  }
  const block = (newest && blocks.find((b) => b.some((l) => l.strokeIds.includes(newest!.id)))) ?? blocks[blocks.length - 1];
  return block.map((l, i) => ({ ...l, index: i + 1 }));
}
