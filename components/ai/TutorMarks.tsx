"use client";
// Owner: C. Live Check marks, drawn inside the page's SVG overlay (page units, 1000 x 1414):
//  - a red pen line drawn under the first wrong line, plus a margin tab to tap
//  - faint green ticks on correct lines, a gray "?" on lines the tutor couldn't read or judge
// Tappable elements carry data-ui so PageCanvas doesn't treat the tap as ink.
import type { CheckResult, CheckedLine } from "@/lib/types";

export function TutorMarks({ result, onOpen }: { result: CheckResult; onOpen(line: CheckedLine): void }) {
  const err = result.lines.find((l) => l.index === result.firstErrorIndex);
  return (
    <g>
      {result.lines.map((l) =>
        l === err ? null : l.verdict === "correct" ? (
          <Tick key={`t${l.index}-${l.box.y}`} x={l.box.x + l.box.w + 14} y={l.box.y + l.box.h / 2} />
        ) : l.verdict === "unclear" && l.readConfidence < 0.5 ? (
          <text key={`q${l.index}`} x={l.box.x + l.box.w + 16} y={l.box.y + l.box.h / 2 + 10} fontSize={30} fill="#8b93a7" className="font-hand">
            ?
          </text>
        ) : null,
      )}
      {err && <ErrorMark key={`${err.index}-${err.box.x}-${err.box.y}-${err.text}`} line={err} onOpen={() => onOpen(err)} />}
    </g>
  );
}

function ErrorMark({ line, onOpen }: { line: CheckedLine; onOpen(): void }) {
  const { x, y, w, h } = line.box;
  // A red pen line under the wrong expression (the box has ~8 units of padding below the ink).
  const uy = y + h + 2;
  const d = wobblyUnderline(x + 4, x + w - 4, uy, line.index);
  const len = Math.round(w * 1.15 + 40);
  // Margin tab sits to the right of the line; if the line runs too far right, it goes just below
  // the underline's right end instead, so it never covers the student's writing.
  const fitsRight = x + w + 30 + 150 <= 1000;
  const tabX = fitsRight ? x + w + 30 : Math.max(20, Math.min(x + w - 150, 1000 - 160));
  const tabY = fitsRight ? y + h / 2 - 26 : uy + 14;

  return (
    <g>
      <path d={d} fill="none" stroke="var(--mark)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" className="draw-in" style={{ ["--len" as string]: len }} />
      <g data-ui="" style={{ pointerEvents: "auto", cursor: "pointer" }}
        // PageCanvas cancels touch events (so Safari can't zoom/select), which also kills "click" on iPad.
        // Pointer events still arrive, so open on pointerup.
        onPointerUp={onOpen}
        role="button" aria-label={`Hint for line ${line.index}`}>
        <rect x={tabX - 6} y={tabY - 6} width={150} height={64} fill="transparent" />
        <path d={`M ${tabX} ${tabY + 26} q 10 -26 34 -24 h 92 q 12 0 12 12 v 26 q 0 12 -12 12 h -92 q -24 2 -34 -26 z`} fill="var(--paper)" stroke="var(--mark)" strokeWidth={2.5} />
        <text x={tabX + 44} y={tabY + 36} fontSize={30} className="font-hand" fontWeight={700} fill="var(--mark)">
          Look here
        </text>
      </g>
    </g>
  );
}

/** A quick hand-drawn underline: slight waviness, a small upward drift and a little flick at the end. */
function wobblyUnderline(x0: number, x1: number, y: number, seed: number): string {
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 2;
  const steps = Math.max(6, Math.round((x1 - x0) / 40));
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([x0 + (x1 - x0) * t, y + 2.2 * Math.sin(t * 9 + seed) + 1.2 * rnd() - 4 * t]);
  }
  const [lx, ly] = pts[pts.length - 1];
  pts.push([lx + 10, ly - 7]); // flick
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    d += ` Q ${ax.toFixed(1)} ${ay.toFixed(1)} ${((ax + bx) / 2).toFixed(1)} ${((ay + by) / 2).toFixed(1)}`;
  }
  return d + ` L ${pts[pts.length - 1][0].toFixed(1)} ${pts[pts.length - 1][1].toFixed(1)}`;
}

function Tick({ x, y }: { x: number; y: number }) {
  return (
    <path d={`M ${x} ${y} l 9 10 l 18 -24`} fill="none" stroke="var(--ok)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="fade-tick" />
  );
}
