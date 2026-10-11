"use client";
// Owner: C. Guided tour: a spotlight on one part of the app at a time, with a card that explains it.
// Targets are elements with data-tour="<id>"; a step with no target (or a missing one) is a centered card.
// Esc or "Skip tour" closes it; arrow keys move between steps.
import { useCallback, useEffect, useRef, useState } from "react";

export interface TourStep {
  target?: string; // data-tour id
  title: string;
  body: string;
  /** Text for the last button on this step (defaults to Next / Done). */
  cta?: string;
}

const PAD = 8;
const CARD_W = 360;
const GAP = 14;

type Rect = { x: number; y: number; w: number; h: number };

function findRect(id?: string): Rect | null {
  if (!id || typeof document === "undefined") return null;
  const el = document.querySelector(`[data-tour="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

export function Tour({ steps, onFinish, onSkip }: { steps: TourStep[]; onFinish(): void; onSkip(): void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 1024, h: 768 });
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  // Follow the target while the tour is open (layout shifts, rotation, panels opening).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const r = findRect(step?.target);
      setRect((prev) => (same(prev, r) ? prev : r));
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step?.target]);

  // Measure the card so it can be placed without spilling off-screen.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => nextRef.current?.focus(), [i]);

  const next = useCallback(() => (last ? onFinish() : setI((n) => n + 1)), [last, onFinish]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onSkip]);

  if (!step) return null;
  const pos = placeCard(rect, vp, cardH);

  return (
    <div className="chrome fixed inset-0 z-[70]" onPointerDown={(e) => e.stopPropagation()}>
      {/* Spotlight: a hole in the scrim around the target. Without a target, a plain scrim. */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl transition-all duration-300 ease-out"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: "0 0 0 9999px rgba(12,18,32,0.58)", outline: "2px solid rgba(255,255,255,0.85)" }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0" style={{ background: "rgba(12,18,32,0.58)" }} />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="fixed rounded-2xl bg-paper p-5 text-ink shadow-2xl ring-1 ring-rule transition-all duration-300 ease-out"
        style={{ left: pos.x, top: pos.y, width: Math.min(CARD_W, vp.w - 32) }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mark">
            {i + 1} of {steps.length}
          </p>
          {!last && (
            <button onClick={onSkip} className="-mr-1 -mt-1 rounded-full px-2.5 py-1 text-sm font-medium text-ink-soft hover:bg-desk">
              Skip tour
            </button>
          )}
        </div>
        <h2 className="mt-1 font-hand text-[28px] font-bold leading-tight">{step.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {steps.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-ink" : "w-1.5 bg-rule"}`} />
            ))}
          </div>
          {i > 0 && (
            <button onClick={back} className="h-10 rounded-full px-4 text-sm font-medium text-ink-soft hover:bg-desk">
              Back
            </button>
          )}
          <button ref={nextRef} onClick={next} className="h-10 rounded-full bg-ink px-5 text-sm font-semibold text-paper">
            {step.cta ?? (last ? "Done" : "Next")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Put the card beside the spotlight where it fits: below, above, right, left; else centered. */
function placeCard(r: Rect | null, vp: { w: number; h: number }, h: number): { x: number; y: number } {
  const w = Math.min(CARD_W, vp.w - 32);
  const clampX = (x: number) => Math.max(16, Math.min(vp.w - w - 16, x));
  const clampY = (y: number) => Math.max(16, Math.min(vp.h - h - 16, y));
  if (!r) return { x: (vp.w - w) / 2, y: clampY((vp.h - h) / 2) };
  const cx = r.x + r.w / 2 - w / 2;
  if (r.y + r.h + GAP + h <= vp.h - 16) return { x: clampX(cx), y: r.y + r.h + GAP };
  if (r.y - GAP - h >= 16) return { x: clampX(cx), y: r.y - GAP - h };
  if (r.x + r.w + GAP + w <= vp.w - 16) return { x: r.x + r.w + GAP, y: clampY(r.y + r.h / 2 - h / 2) };
  if (r.x - GAP - w >= 16) return { x: r.x - GAP - w, y: clampY(r.y + r.h / 2 - h / 2) };
  // Target fills the screen (the page): float the card near the bottom center.
  return { x: (vp.w - w) / 2, y: clampY(vp.h - h - 32) };
}

const same = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5);
