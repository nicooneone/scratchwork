"use client";
// Light/dark toggle. Going dark, a blot of ink spills out of the button with a wobbly, liquid edge
// until it covers the screen; going light, the ink draws back into the button.
//
// How: the View Transitions API snapshots the old and new screens, and we animate the clip-path of
// one snapshot through a series of blob-shaped polygons (same point count every frame, so the
// browser interpolates between them smoothly). The canvases are redrawn synchronously inside the
// transition, so the new snapshot already shows the ink in its new colors.
// Without View Transitions it cross-fades; with "reduce motion" it switches instantly.
import { useId } from "react";
import { flushSync } from "react-dom";
import { applyTheme, getTheme, type Theme } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";

// Slow and smooth: ~1.7 s each way, and enough keyframes that the browser's linear interpolation
// between blob shapes reads as one continuous motion rather than steps.
const SPILL_MS = 1700;
const RETRACT_MS = 1500;
const FRAMES = 40;
const POINTS = 72;

let busy = false;

/**
 * Switch light ↔ dark with the ink animation, centered on `el`. `alongside` runs in the same
 * synchronous update as the theme change (e.g. closing the menu the switch lives in), so it lands
 * in the new snapshot and disappears under the ink rather than before it.
 */
export function switchTheme(el: HTMLElement, alongside?: () => void) {
  if (busy) return;
  const to: Theme = getTheme() === "dark" ? "light" : "dark";
  const change = () => {
    alongside?.();
    applyTheme(to);
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Not in every browser (iPadOS 18+), so look it up rather than trusting the DOM typings.
  const startVT = (document as unknown as { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } })
    .startViewTransition?.bind(document);

  if (reduce) return change();
  const root = document.documentElement;
  if (!startVT) {
    root.classList.add("theme-fade");
    change();
    setTimeout(() => root.classList.remove("theme-fade"), 1000);
    return;
  }

  busy = true;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const spill = to === "dark";
  if (!spill) root.classList.add("ink-retract");

  const vt = startVT(() => flushSync(change));
  vt.ready
    .then(() => {
      root.animate(
        { clipPath: inkFrames(cx, cy, spill ? "spill" : "retract") },
        {
          duration: spill ? SPILL_MS : RETRACT_MS,
          easing: "linear", // the easing is baked into the frames
          fill: "both",
          pseudoElement: spill ? "::view-transition-new(root)" : "::view-transition-old(root)",
        },
      );
    })
    .catch(() => {});
  vt.finished.finally(() => {
    root.classList.remove("ink-retract");
    busy = false;
  });
}

/** Sun that turns into a moon in dark mode (driven by <html data-theme>, see globals.css). */
export function ThemeIcon({ size = 22 }: { size?: number }) {
  const maskId = useId();
  return (
    <svg className="theme-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <mask id={maskId}>
        <rect width="24" height="24" fill="white" />
        <circle className="bite" cx="16" cy="8" r="6" fill="black" />
      </mask>
      <g className="rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${a} 12 12)`} />
        ))}
      </g>
      <circle className="core" cx="12" cy="12" r="5" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

/** Stand-alone light/dark button (library header). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const next: Theme = useTheme() === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={(e) => switchTheme(e.currentTarget)}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink transition-colors hover:bg-desk ${className}`}
    >
      <ThemeIcon />
    </button>
  );
}

/**
 * Clip-path keyframes of an ink blot centered on (cx, cy).
 *   spill:   grows from nothing until it covers the viewport (fast out, slow finish).
 *   retract: starts covering the viewport and drains back into the button, starting right away.
 * Each frame is a POINTS-sided polygon whose radius wobbles with three slow waves; the waves drift
 * from frame to frame so the edge looks liquid, and the wobble is zero whenever the blot must cover
 * the whole screen. Random phases make every switch a little different.
 */
function inkFrames(cx: number, cy: number, mode: "spill" | "retract"): string[] {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const reach = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const p = [Math.random(), Math.random(), Math.random()].map((v) => v * Math.PI * 2);
  const out: string[] = [];
  for (let k = 0; k < FRAMES; k++) {
    const t = k / (FRAMES - 1);
    let r: number;
    let amp: number;
    // Both directions ease in and out (sine), so the ink starts gently, glides, and settles.
    const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
    if (mode === "spill") {
      r = reach * 1.15 * e;
      amp = r * 0.13 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.5; // soft wobble mid-spread, none at the ends
    } else {
      r = reach * 1.02 * (1 - e);
      amp = r * 0.14 * Math.sin(Math.PI * t) ** 1.5; // none while it covers the screen, soft as it drains
    }
    const pts: string[] = [];
    for (let i = 0; i < POINTS; i++) {
      const a = (i / POINTS) * Math.PI * 2;
      const wave =
        // Slower drift and fewer high-frequency ripples: a calm, liquid edge instead of a jittery one.
        0.6 * Math.sin(3 * a + p[0] + 1.4 * t) +
        0.3 * Math.sin(5 * a + p[1] - 1.8 * t) +
        0.1 * Math.sin(8 * a + p[2] + 2.4 * t);
      const rr = Math.max(0, r + amp * wave);
      pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)}px ${(cy + rr * Math.sin(a)).toFixed(1)}px`);
    }
    out.push(`polygon(${pts.join(",")})`);
  }
  return out;
}
