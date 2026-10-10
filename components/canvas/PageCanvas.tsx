"use client";
// Owner: A. The ink engine: one page you can write on with an Apple Pencil.
//
// Layers, bottom to top (all inside one "content" element that we pan/zoom with a CSS transform):
//   template (CSS background) → highlighter canvas (translucent) → ink canvas → live canvas
//   (stroke in progress, eraser cursor, lasso) → SVG overlay (children, e.g. Live Check marks).
//
// Input rules (palm rejection): the Apple Pencil and the mouse draw. Fingers pan and pinch-zoom,
// unless "draw with finger" is on. Touches are ignored while the Pencil is down and for 300 ms after.
// The component fills its parent, so give the parent a height.
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { History } from "@/lib/ink/history";
import { hitsStroke } from "@/lib/ink/hit";
import { clear, drawStroke, redrawAll } from "@/lib/ink/render";
import { templateStyle } from "@/lib/ink/templates";
import { savesStroke } from "@/lib/ink/tools";
import { uid } from "@/lib/ids";
import { PAGE_H, PAGE_W, type Box, type Page, type Pt, type Stroke, type ToolState } from "@/lib/types";

export interface PageCanvasHandle {
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface PageCanvasProps {
  page: Page;
  toolState: ToolState;
  onChange(strokes: Stroke[]): void;
  onLassoSelect?(box: Box): void;
  onHistoryChange?(state: { canUndo: boolean; canRedo: boolean }): void;
  /** SVG overlay content drawn in page units (viewBox 0 0 1000 1414). Give tappable elements `data-ui`. */
  children?: ReactNode;
  ref?: Ref<PageCanvasHandle>;
}

const GUTTER = 12; // px around the page
const MAX_ZOOM = 2; // higher zoom blurs and would blow Safari's canvas memory limit on the A12
const MAX_CANVAS_PIXELS = 4_500_000; // per canvas
const PALM_GRACE_MS = 300;
const HIGHLIGHTER_OPACITY = 0.35;

interface View {
  fitW: number; // page width in CSS px at zoom 1
  z: number;
  tx: number;
  ty: number;
}

type Drawing =
  | { kind: "stroke"; pointerId: number; stroke: Stroke; byFinger?: boolean }
  | { kind: "erase"; pointerId: number; before: Stroke[] }
  | { kind: "lasso"; pointerId: number; points: [number, number][] };

export default function PageCanvas({
  page,
  toolState,
  onChange,
  onLassoSelect,
  onHistoryChange,
  children,
  ref,
}: PageCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const strokesRef = useRef<Stroke[]>(page.strokes);
  const lastEmittedRef = useRef<Stroke[]>(page.strokes);
  const historyRef = useRef(new History());
  const viewRef = useRef<View>({ fitW: 0, z: 1, tx: GUTTER, ty: GUTTER });
  const drawingRef = useRef<Drawing | null>(null);
  const touchesRef = useRef(new Map<number, { x: number; y: number }>());
  const fingerPosRef = useRef(new Map<number, { x: number; y: number }>()); // every finger currently down
  const gestureRef = useRef<{ z: number; tx: number; ty: number; cx: number; cy: number; dist: number } | null>(null);
  const penDownRef = useRef(false);
  const lastPenUpRef = useRef(0);
  const rafRef = useRef(0);
  const lassoShownRef = useRef(false);

  // Latest props for the native event listeners (attached once).
  const propsRef = useRef({ toolState, onChange, onLassoSelect, onHistoryChange });
  useEffect(() => {
    propsRef.current = { toolState, onChange, onLassoSelect, onHistoryChange };
  });

  const ctx = (c: HTMLCanvasElement | null) => c?.getContext("2d") ?? null;

  const redraw = useCallback(() => {
    const ink = ctx(inkRef.current);
    const hl = ctx(hlRef.current);
    if (ink && hl) redrawAll(ink, hl, strokesRef.current);
  }, []);

  const emit = useCallback((strokes: Stroke[]) => {
    strokesRef.current = strokes;
    lastEmittedRef.current = strokes;
    const h = historyRef.current;
    propsRef.current.onChange(strokes);
    propsRef.current.onHistoryChange?.({ canUndo: h.canUndo, canRedo: h.canRedo });
  }, []);

  // ---------- view (pan / zoom) ----------
  const applyView = useCallback(() => {
    const v = viewRef.current;
    const vp = viewportRef.current;
    const el = contentRef.current;
    if (!vp || !el) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const cw = v.fitW * v.z;
    const ch = v.fitW * (PAGE_H / PAGE_W) * v.z;
    v.tx = cw + GUTTER * 2 <= vw ? (vw - cw) / 2 : Math.min(GUTTER, Math.max(vw - cw - GUTTER, v.tx));
    v.ty = ch + GUTTER * 2 <= vh ? GUTTER : Math.min(GUTTER, Math.max(vh - ch - GUTTER, v.ty));
    el.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.z})`;
  }, []);

  /** Size the page and canvases to the viewport width. */
  const layout = useCallback(() => {
    const vp = viewportRef.current;
    const el = contentRef.current;
    if (!vp || !el) return;
    const fitW = Math.max(200, vp.clientWidth - GUTTER * 2);
    const fitH = fitW * (PAGE_H / PAGE_W);
    viewRef.current.fitW = fitW;
    el.style.width = `${fitW}px`;
    el.style.height = `${fitH}px`;
    templateRef.current?.style.setProperty("--u", `${fitW / PAGE_W}px`);

    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_CANVAS_PIXELS / (fitW * fitH)));
    const pw = Math.round(fitW * ratio);
    const ph = Math.round(fitH * ratio);
    for (const c of [hlRef.current, inkRef.current, liveRef.current]) {
      if (!c) continue;
      if (c.width !== pw || c.height !== ph) {
        c.width = pw;
        c.height = ph;
      }
      c.getContext("2d")!.setTransform(pw / PAGE_W, 0, 0, ph / PAGE_H, 0, 0);
    }
    redraw();
    applyView();
  }, [applyView, redraw]);

  useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(() => layout());
    if (viewportRef.current) ro.observe(viewportRef.current);
    const canvases = [hlRef.current, inkRef.current, liveRef.current];
    return () => {
      ro.disconnect();
      // Free canvas memory right away (Safari on older iPads is tight on it).
      for (const c of canvases) if (c) c.width = c.height = 0;
    };
  }, [layout]);

  // ---------- page switches / external stroke changes ----------
  useEffect(() => {
    strokesRef.current = page.strokes;
    lastEmittedRef.current = page.strokes;
    historyRef.current.reset();
    propsRef.current.onHistoryChange?.({ canUndo: false, canRedo: false });
    redraw();
  }, [page.id, redraw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (page.strokes !== lastEmittedRef.current) {
      strokesRef.current = page.strokes;
      lastEmittedRef.current = page.strokes;
      redraw();
    }
  }, [page.strokes, redraw]);

  // ---------- undo / redo ----------
  useImperativeHandle(
    ref,
    () => ({
      undo() {
        const next = historyRef.current.undo(strokesRef.current);
        if (next) {
          strokesRef.current = next;
          redraw();
          emit(next);
        }
      },
      redo() {
        const next = historyRef.current.redo(strokesRef.current);
        if (next) {
          strokesRef.current = next;
          redraw();
          emit(next);
        }
      },
      get canUndo() {
        return historyRef.current.canUndo;
      },
      get canRedo() {
        return historyRef.current.canRedo;
      },
    }),
    [emit, redraw],
  );

  // ---------- input ----------
  useEffect(() => {
    const vp = viewportRef.current!;

    const toPage = (clientX: number, clientY: number): [number, number] => {
      const r = contentRef.current!.getBoundingClientRect();
      return [((clientX - r.left) / r.width) * PAGE_W, ((clientY - r.top) / r.height) * PAGE_H];
    };

    const live = () => ctx(liveRef.current)!;

    const renderLive = () => {
      rafRef.current = 0;
      const d = drawingRef.current;
      const c = live();
      clear(c);
      if (!d) return;
      if (d.kind === "stroke") {
        const s = d.stroke;
        if (s.tool === "highlighter") {
          c.save();
          c.globalAlpha = HIGHLIGHTER_OPACITY;
          drawStroke(c, s, { live: true });
          c.restore();
        } else if (s.tool === "eraser-precise") {
          const p = s.points[s.points.length - 1];
          if (p) eraserCursor(c, p[0], p[1], s.size / 2);
        } else {
          drawStroke(c, s, { live: true });
        }
      } else if (d.kind === "lasso") {
        lassoPath(c, d.points);
      }
    };
    const scheduleLive = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(renderLive);
    };

    // Coalesced events give the Pencil's full sample rate; some events return an empty list, so fall back.
    const samples = (e: PointerEvent): PointerEvent[] => {
      const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      return list.length ? list : [e];
    };

    const pressureOf = (e: PointerEvent) => (e.pointerType === "pen" ? e.pressure || 0.5 : 0.5);

    const finishPen = (e: PointerEvent) => {
      if (e.pointerType === "pen") {
        penDownRef.current = false;
        lastPenUpRef.current = performance.now();
      }
    };

    // --- drawing ---
    const startDrawing = (e: PointerEvent) => {
      const { toolState: ts } = propsRef.current;
      const [x, y] = toPage(e.clientX, e.clientY);
      if (lassoShownRef.current) {
        clear(live());
        lassoShownRef.current = false;
      }
      if (ts.tool === "lasso") {
        drawingRef.current = { kind: "lasso", pointerId: e.pointerId, points: [[x, y]] };
      } else if (ts.tool === "eraser-stroke") {
        drawingRef.current = { kind: "erase", pointerId: e.pointerId, before: strokesRef.current };
        eraseAt(x, y);
      } else if (savesStroke(ts.tool)) {
        const stroke: Stroke = {
          id: uid(),
          tool: ts.tool,
          color: ts.color,
          size: ts.size,
          points: [[x, y, pressureOf(e)]],
          times: [0],
          createdAt: Date.now(),
          simulated: e.pointerType !== "pen" || undefined,
        };
        drawingRef.current = { kind: "stroke", pointerId: e.pointerId, stroke, byFinger: e.pointerType === "touch" };
      }
      scheduleLive();
    };

    const eraseAt = (x: number, y: number) => {
      const radius = propsRef.current.toolState.size;
      const keep = strokesRef.current.filter((s) => !hitsStroke(s, x, y, radius));
      if (keep.length !== strokesRef.current.length) {
        strokesRef.current = keep;
        redraw();
      }
      const c = live();
      clear(c);
      eraserCursor(c, x, y, radius);
    };

    const moveDrawing = (e: PointerEvent) => {
      const d = drawingRef.current!;
      for (const ev of samples(e)) {
        const [x, y] = toPage(ev.clientX, ev.clientY);
        if (d.kind === "erase") {
          eraseAt(x, y);
        } else if (d.kind === "lasso") {
          d.points.push([x, y]);
        } else {
          const pts = d.stroke.points;
          const last = pts[pts.length - 1];
          if (Math.hypot(x - last[0], y - last[1]) < 0.4) continue;
          const p: Pt = [x, y, pressureOf(ev)];
          pts.push(p);
          d.stroke.times?.push(Date.now() - d.stroke.createdAt);
          if (d.stroke.tool === "eraser-precise") {
            // Erase incrementally so it feels instant; the final commit redraws exactly.
            const ink = ctx(inkRef.current)!;
            ink.save();
            ink.globalCompositeOperation = "destination-out";
            ink.lineWidth = d.stroke.size;
            ink.lineCap = "round";
            ink.beginPath();
            ink.moveTo(last[0], last[1]);
            ink.lineTo(x, y);
            ink.stroke();
            ink.restore();
          }
        }
      }
      if (d.kind !== "erase") scheduleLive();
    };

    const endDrawing = () => {
      const d = drawingRef.current;
      drawingRef.current = null;
      if (!d) return;
      if (d.kind === "erase") {
        clear(live());
        const kept = new Set(strokesRef.current);
        const removed = d.before.flatMap((stroke, index) => (kept.has(stroke) ? [] : [{ stroke, index }]));
        if (removed.length) {
          historyRef.current.recordRemove(removed);
          emit(strokesRef.current);
        }
        return;
      }
      if (d.kind === "lasso") {
        lassoShownRef.current = true;
        const xs = d.points.map((p) => p[0]);
        const ys = d.points.map((p) => p[1]);
        if (xs.length > 2) {
          const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
          if (box.w > 8 && box.h > 8) propsRef.current.onLassoSelect?.(box);
        }
        return;
      }
      const stroke = d.stroke;
      const next = [...strokesRef.current, stroke];
      historyRef.current.recordAdd(stroke, next.length - 1);
      strokesRef.current = next;
      if (stroke.tool === "eraser-precise") redraw();
      else drawStroke(ctx(stroke.tool === "highlighter" ? hlRef.current : inkRef.current)!, stroke);
      clear(live());
      emit(next);
    };

    const cancelDrawing = () => {
      const d = drawingRef.current;
      drawingRef.current = null;
      if (d?.kind === "erase") strokesRef.current = d.before;
      clear(live());
      redraw();
    };

    // --- gestures (fingers) ---
    const beginGesture = () => {
      const pts = [...touchesRef.current.values()];
      if (!pts.length) {
        gestureRef.current = null;
        return;
      }
      const v = viewRef.current;
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
      gestureRef.current = { z: v.z, tx: v.tx, ty: v.ty, cx, cy, dist };
    };

    const moveGesture = () => {
      const g = gestureRef.current;
      const pts = [...touchesRef.current.values()];
      if (!g || !pts.length) return;
      const v = viewRef.current;
      const r = vp.getBoundingClientRect();
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      let z = g.z;
      if (pts.length > 1 && g.dist > 0) {
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        z = Math.min(MAX_ZOOM, Math.max(1, (g.z * dist) / g.dist));
      }
      // Keep the content point under the gesture's start center under the current center.
      const px = (g.cx - r.left - g.tx) / g.z;
      const py = (g.cy - r.top - g.ty) / g.z;
      v.z = z;
      v.tx = cx - r.left - px * z;
      v.ty = cy - r.top - py * z;
      applyView();
    };

    // --- pointer events ---
    const capture = (id: number) => {
      try {
        vp.setPointerCapture(id);
      } catch {
        // Synthetic or already-released pointers can't be captured; drawing still works.
      }
    };

    const isUi = (e: PointerEvent) => (e.target as Element | null)?.closest?.("[data-ui]") != null;

    const onDown = (e: PointerEvent) => {
      if (isUi(e)) return;
      const { toolState: ts } = propsRef.current;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const draws = e.pointerType === "pen" || e.pointerType === "mouse" || (e.pointerType === "touch" && ts.drawWithFinger);

      if (e.pointerType === "touch") {
        // Palm rejection: ignore touches while the Pencil is down or just lifted.
        if (penDownRef.current || performance.now() - lastPenUpRef.current < PALM_GRACE_MS) return;
        fingerPosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // A second finger while finger-drawing means "pinch": drop the half-started stroke
        // and turn both fingers into a gesture.
        const d = drawingRef.current;
        if (d && d.kind === "stroke" && d.byFinger && touchesRef.current.size === 0) {
          cancelDrawing();
          const first = fingerPosRef.current.get(d.pointerId);
          if (first) touchesRef.current.set(d.pointerId, first);
        }
        if (!draws || touchesRef.current.size > 0) {
          touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          capture(e.pointerId);
          beginGesture();
          return;
        }
      }
      if (!draws || drawingRef.current) return;
      if (e.pointerType === "pen") {
        penDownRef.current = true;
        // The Pencil wins: stop any finger gesture (that's a resting palm).
        touchesRef.current.clear();
        gestureRef.current = null;
      }
      capture(e.pointerId);
      startDrawing(e);
    };

    const onMove = (e: PointerEvent) => {
      if (fingerPosRef.current.has(e.pointerId)) fingerPosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = drawingRef.current;
      if (d && d.pointerId === e.pointerId) {
        moveDrawing(e);
        return;
      }
      if (touchesRef.current.has(e.pointerId)) {
        touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moveGesture();
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = drawingRef.current;
      if (d && d.pointerId === e.pointerId) {
        if (e.type === "pointercancel" && d.kind === "stroke" && d.stroke.points.length < 2) cancelDrawing();
        else endDrawing();
      }
      finishPen(e);
      fingerPosRef.current.delete(e.pointerId);
      if (touchesRef.current.delete(e.pointerId)) beginGesture();
    };

    // Desktop: wheel pans, ctrl/pinch-trackpad zooms around the cursor.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey) {
        const r = vp.getBoundingClientRect();
        const z = Math.min(MAX_ZOOM, Math.max(1, v.z * Math.exp(-e.deltaY * 0.01)));
        const px = (e.clientX - r.left - v.tx) / v.z;
        const py = (e.clientY - r.top - v.ty) / v.z;
        v.z = z;
        v.tx = e.clientX - r.left - px * z;
        v.ty = e.clientY - r.top - py * z;
      } else {
        v.tx -= e.deltaX;
        v.ty -= e.deltaY;
      }
      applyView();
    };

    // Kill Safari's own gestures over the page (magnifier, double-tap zoom, page zoom, scrolling).
    const block = (e: Event) => e.preventDefault();

    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onUp);
    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("touchstart", block, { passive: false });
    vp.addEventListener("touchmove", block, { passive: false });
    vp.addEventListener("gesturestart", block);
    vp.addEventListener("gesturechange", block);
    return () => {
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("touchstart", block);
      vp.removeEventListener("touchmove", block);
      vp.removeEventListener("gesturestart", block);
      vp.removeEventListener("gesturechange", block);
      cancelAnimationFrame(rafRef.current);
    };
  }, [applyView, emit, redraw]);

  const canvasClass = "pointer-events-none absolute inset-0 h-full w-full";

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden select-none"
      style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", cursor: "crosshair" }}
    >
      <div ref={contentRef} className="absolute left-0 top-0 origin-top-left will-change-transform">
        <div
          ref={templateRef}
          className="absolute inset-0 rounded-sm bg-paper shadow-[0_1px_4px_rgba(29,42,68,.2)]"
          style={templateStyle(page.template)}
        />
        <canvas ref={hlRef} className={canvasClass} style={{ opacity: HIGHLIGHTER_OPACITY }} />
        <canvas ref={inkRef} className={canvasClass} />
        <canvas ref={liveRef} className={canvasClass} />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}>
          {children}
        </svg>
      </div>
    </div>
  );
}

function eraserCursor(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.6)";
  c.fill();
  c.lineWidth = 1.5;
  c.strokeStyle = "#5a6680";
  c.stroke();
  c.restore();
}

function lassoPath(c: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 2) return;
  c.save();
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) c.lineTo(x, y);
  c.closePath();
  c.fillStyle = "rgba(36,86,201,0.06)";
  c.fill();
  c.setLineDash([8, 6]);
  c.lineWidth = 2;
  c.strokeStyle = "#2456c9";
  c.stroke();
  c.restore();
}
