"use client";
// "Show me why": draws the graph from lib/math/why.ts.
// Equation mistakes animate: the "before" lines morph into the "after" lines, and the point where
// the two sides meet slides from the real answer (green) to the student's (red), leaving a ghost.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Tone, WhyGraph as Graph } from "@/lib/math/why";
import { niceNumber } from "@/lib/math/why";
import { speak, unlockAudio } from "@/lib/voice";

const W = 328, H = 196, PAD = { l: 30, r: 10, t: 12, b: 24 };
const COLOR: Record<Tone, string> = { ink: "var(--ink)", soft: "var(--ink-soft)", ok: "var(--ok)", mark: "var(--mark)" };
const HOLD_MS = 1300; // show "before" this long, then morph
const MORPH_MS = 1400;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function WhyGraph({ graph }: { graph: Graph }) {
  const { view, xs, frames } = graph;
  const morphs = frames.length > 1;
  const [t, setT] = useState(morphs ? 0 : 1); // 0 = before, 1 = after
  const [run, setRun] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!morphs) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, Math.max(0, (now - start - HOLD_MS) / MORPH_MS));
      setT(ease(k));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    const kick = setTimeout(() => {
      if (reduce) setT(1);
      else raf.current = requestAnimationFrame(tick);
    }, 0);
    // Animation frames pause when the page isn't on screen (and can be throttled in Low Power Mode):
    // make sure the graph always lands on its final picture.
    const land = setTimeout(() => setT(1), HOLD_MS + MORPH_MS + 300);
    return () => {
      clearTimeout(kick);
      clearTimeout(land);
      cancelAnimationFrame(raf.current);
    };
  }, [morphs, run]);

  const sx = (x: number) => PAD.l + ((x - view.x0) / (view.x1 - view.x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - view.y0) / (view.y1 - view.y0)) * (H - PAD.t - PAD.b);
  const inY = (y: number) => y >= view.y0 - (view.y1 - view.y0) && y <= view.y1 + (view.y1 - view.y0);

  /** SVG path for a sampled curve; breaks at gaps and off-chart jumps (poles). */
  const pathFor = (ys: number[]) => {
    let d = "", pen = false;
    ys.forEach((y, i) => {
      if (!Number.isFinite(y) || !inY(y)) return void (pen = false);
      d += `${pen ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(y).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const a = frames[0], b = frames[frames.length - 1];
  const curves = useMemo(
    () => b.curves.map((c, ci) => ({ ...c, ys: c.ys.map((y, i) => (morphs ? lerp(a.curves[ci]?.ys[i] ?? y, y, t) : y)) })),
    [a, b, morphs, t],
  );

  // Dots: before = green at the real answer; after = red at the new one, with a faded green ghost.
  const dots = morphs
    ? t < 0.02
      ? a.dots
      : [
          ...a.dots.map((d) => ({ ...d, ghost: true })),
          ...b.dots.filter((d) => !d.ghost).map((d, i) => {
            const from = a.dots[i] ?? d;
            return { ...d, x: lerp(from.x, d.x, t), y: lerp(from.y, d.y, t), label: t > 0.98 ? d.label : `${graph.v} = ${niceNumber(lerp(from.x, d.x, t))}` };
          }),
        ]
    : b.dots;

  const caption = morphs ? (t < 0.5 ? a.caption : b.caption) : b.caption;
  const title = morphs ? (t < 0.5 ? a.title : b.title) : b.title;
  const zeroX = view.x0 < 0 && view.x1 > 0 ? sx(0) : null;
  const zeroY = view.y0 < 0 && view.y1 > 0 ? sy(0) : null;

  return (
    <div className="mt-3 rounded-xl bg-white p-2 ring-1 ring-rule">
      <div className="flex items-baseline justify-between px-1">
        <span className="font-hand text-xl font-bold leading-none">{title}</span>
        <span className="flex gap-2 text-[11px] text-ink-soft">
          {b.curves.map((c) => (
            <span key={c.label} className="flex items-center gap-1">
              <svg width="16" height="6" aria-hidden>
                <line x1="0" y1="3" x2="16" y2="3" stroke={COLOR[c.tone]} strokeWidth="2.5" strokeDasharray={c.dashed ? "4 3" : undefined} />
              </svg>
              {c.label}
            </span>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${caption} ${graph.summary}`}>
        {/* frame + axes */}
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="none" stroke="var(--rule)" />
        {zeroY != null && <line x1={PAD.l} x2={W - PAD.r} y1={zeroY} y2={zeroY} stroke="var(--rule)" strokeWidth="1.5" />}
        {zeroX != null && <line y1={PAD.t} y2={H - PAD.b} x1={zeroX} x2={zeroX} stroke="var(--rule)" strokeWidth="1.5" />}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--ink-soft)">{axisNumber(view.x0)}</text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--ink-soft)" textAnchor="end">{axisNumber(view.x1)}</text>
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} fontSize="10" fill="var(--ink-soft)" textAnchor="middle">{graph.v}</text>

        {/* curves */}
        {curves.map((c) => (
          <path key={c.label} d={pathFor(c.ys)} fill="none" stroke={COLOR[c.tone]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={c.dashed ? "6 5" : undefined} />
        ))}

        {/* where the sides meet */}
        {dots.map((d, i) =>
          Number.isFinite(d.y) && inY(d.y) ? (
            <g key={`${i}-${d.ghost ? "g" : "d"}`} opacity={d.ghost ? 0.45 : 1}>
              <line x1={sx(d.x)} x2={sx(d.x)} y1={sy(d.y)} y2={H - PAD.b} stroke={COLOR[d.tone]} strokeDasharray="2 3" />
              <circle cx={sx(d.x)} cy={sy(d.y)} r={d.ghost ? 5 : 6.5} fill={d.ghost ? "white" : COLOR[d.tone]} stroke={COLOR[d.tone]} strokeWidth="2" />
              {d.ghost && morphs && t > 0.5 && (
                <text x={clamp(sx(d.x), PAD.l + 28, W - PAD.r - 28)} y={Math.min(H - PAD.b - 6, sy(d.y) + 22)} fontSize="11" fontWeight="600" fill={COLOR[d.tone]} textAnchor="middle" className="font-sans" stroke="white" strokeWidth={3.5} paintOrder="stroke">
                  was {d.label}
                </text>
              )}
              {!d.ghost && (
                <text x={clamp(sx(d.x), PAD.l + 24, W - PAD.r - 24)} y={Math.max(PAD.t + 12, sy(d.y) - 12)} fontSize="13" fontWeight="700" fill={COLOR[d.tone]} textAnchor="middle" className="font-sans" stroke="white" strokeWidth={3.5} paintOrder="stroke">
                  {d.label}
                </text>
              )}
            </g>
          ) : null,
        )}
      </svg>
      <p className="px-1 font-hand text-[19px] leading-snug">{caption}</p>
      {t > 0.98 && <p className="px-1 pt-1 text-sm leading-snug text-ink">{graph.summary}</p>}
      <div className="mt-2 flex gap-2 px-1 pb-1">
        {morphs && (
          <button
            onClick={() => {
              setT(0);
              setRun((r) => r + 1);
            }}
            className="h-9 rounded-full border border-rule px-3 text-sm"
          >
            Replay
          </button>
        )}
        <button
          onClick={() => {
            unlockAudio(); // inside the tap, so iPad Safari lets it play
            speak(`${a.caption} ${morphs ? b.caption : ""} ${graph.summary}`);
          }}
          className="h-9 rounded-full border border-rule px-3 text-sm"
        >
          Explain out loud
        </button>
      </div>
    </div>
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Axis ends: whole numbers stay whole, anything else gets one decimal (never fractions). */
const axisNumber = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace("-", "−");
