"use client";
// Owner: A. Pressure-sensitive drawing surface for one Page.
// Step 1 (first pass): pen/fineliner/pencil/highlighter, stroke + precise eraser, lasso box,
// undo/redo, palm rejection, one-finger scroll. Step 1 adds pinch-zoom and polish.
//
// Layers (bottom -> top): template (CSS), highlighter canvas, ink canvas, live canvas (input),
// overlay SVG (children, in page units: viewBox 0 0 1000 1414).

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { PAGE_H, PAGE_W, type Box, type Page, type Pt, type Stroke, type ToolState } from "@/lib/types";
import { drawStroke, hitsStroke } from "@/lib/ink/render";
import { uid } from "@/lib/ids";
import { templateStyle } from "@/lib/ink/templates";

export interface PageCanvasProps {
  page: Page;
  toolState: ToolState;
  onChange(strokes: Stroke[]): void;
  onLassoSelect?(box: Box): void;
  /** Called on every pen-down and pen-up, for idle detection (Live Check). */
  onPenActivity?(state: "down" | "up"): void;
  /** SVG overlay content (Live Check marks), drawn in page units: viewBox 0 0 1000 1414. */
  children?: ReactNode;
  ref?: Ref<PageCanvasHandle>;
}

export interface PageCanvasHandle {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

type Cmd =
  | { type: "add"; stroke: Stroke; index: number }
  | { type: "remove"; items: { stroke: Stroke; index: number }[] };


const PALM_GRACE_MS = 300;
const MAX_UNDO = 100;

export default function PageCanvas({ page, toolState, onChange, onLassoSelect, onPenActivity, children, ref }: PageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const strokes = useRef<Stroke[]>(page.strokes);
  const undoStack = useRef<Cmd[]>([]);
  const redoStack = useRef<Cmd[]>([]);
  const scale = useRef(1); // CSS px per page unit
  const [unitPx, setUnitPx] = useState(1); // for the CSS template background
  const dpr = useRef(1);

  const current = useRef<Stroke | null>(null);
  const t0 = useRef(0);
  const erased = useRef<{ stroke: Stroke; index: number }[]>([]);
  const activePen = useRef<number | null>(null);
  const lastPenUp = useRef(0);
  const finger = useRef<{ id: number; y: number; x: number } | null>(null);
  const raf = useRef<number | null>(null);

  const toolRef = useRef(toolState);
  useEffect(() => {
    toolRef.current = toolState;
  }, [toolState]);

  // ---------- drawing ----------
  const prep = (c: HTMLCanvasElement | null) => {
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const k = scale.current * dpr.current;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return ctx;
  };

  const redrawAll = useCallback(() => {
    const hl = prep(hlRef.current);
    const ink = prep(inkRef.current);
    if (!hl || !ink) return;
    for (const s of strokes.current) drawStroke(s.tool === "highlighter" ? hl : ink, s);
  }, []);

  const drawLive = useCallback(() => {
    raf.current = null;
    const ctx = prep(liveRef.current);
    const s = current.current;
    if (!ctx || !s) return;
    if (s.tool === "lasso") {
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "#1d2a44";
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (s.tool === "eraser-stroke") {
      const [x, y] = s.points[s.points.length - 1];
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, s.size / 2, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (s.tool === "eraser-precise") {
      // Preview: show what's being cut on the ink layer directly.
      redrawAll();
      const ink = inkRef.current?.getContext("2d");
      if (ink) drawStroke(ink, s, true);
      return;
    }
    if (s.tool === "highlighter") ctx.globalAlpha = 0.35;
    drawStroke(ctx, s, true);
    ctx.globalAlpha = 1;
  }, [redrawAll]);

  const schedule = () => {
    if (raf.current == null) raf.current = requestAnimationFrame(drawLive);
  };

  // ---------- sizing ----------
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const resize = () => {
      const w = wrap.clientWidth;
      scale.current = w / PAGE_W;
      setUnitPx(scale.current);
      dpr.current = Math.min(window.devicePixelRatio || 1, 2);
      const pxW = Math.round(w * dpr.current);
      const pxH = Math.round(w * (PAGE_H / PAGE_W) * dpr.current);
      for (const c of [hlRef.current, inkRef.current, liveRef.current]) {
        if (c && (c.width !== pxW || c.height !== pxH)) {
          c.width = pxW;
          c.height = pxH;
        }
      }
      redrawAll();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const canvases = [hlRef.current, inkRef.current, liveRef.current];
    return () => {
      ro.disconnect();
      // Free canvas memory on unmount (iPad Safari is tight on canvas memory).
      for (const c of canvases) if (c) c.width = 0;
    };
  }, [redrawAll]);

  // New page loaded -> reset history.
  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, [page.id]);

  // Strokes replaced from outside (page switch, import) -> redraw. Our own onChange
  // echoes back the same array, so this is a no-op while drawing.
  useEffect(() => {
    if (page.strokes !== strokes.current) {
      strokes.current = page.strokes;
      redrawAll();
    }
  }, [page.strokes, redrawAll]);

  // ---------- commands ----------
  const commit = useCallback(
    (cmd: Cmd, record = true) => {
      const next = [...strokes.current];
      if (cmd.type === "add") next.splice(cmd.index, 0, cmd.stroke);
      else {
        const ids = new Set(cmd.items.map((i) => i.stroke.id));
        for (let i = next.length - 1; i >= 0; i--) if (ids.has(next[i].id)) next.splice(i, 1);
      }
      strokes.current = next;
      if (record) {
        undoStack.current.push(cmd);
        if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
        redoStack.current = [];
      }
      onChange(next);
    },
    [onChange],
  );

  const invert = (cmd: Cmd) => {
    const next = [...strokes.current];
    if (cmd.type === "add") {
      const i = next.findIndex((s) => s.id === cmd.stroke.id);
      if (i >= 0) next.splice(i, 1);
    } else {
      // Re-insert at original indices, lowest first, so order is restored exactly.
      for (const it of [...cmd.items].sort((a, b) => a.index - b.index)) next.splice(it.index, 0, it.stroke);
    }
    strokes.current = next;
    onChange(next);
  };

  useImperativeHandle(ref, () => ({
    undo() {
      const cmd = undoStack.current.pop();
      if (!cmd) return;
      invert(cmd);
      redoStack.current.push(cmd);
      redrawAll();
    },
    redo() {
      const cmd = redoStack.current.pop();
      if (!cmd) return;
      commit(cmd, false);
      undoStack.current.push(cmd);
      redrawAll();
    },
    canUndo: () => undoStack.current.length > 0,
    canRedo: () => redoStack.current.length > 0,
  }));

  // ---------- input ----------
  const toPage = (e: PointerEvent | React.PointerEvent): Pt => {
    const r = liveRef.current!.getBoundingClientRect();
    const k = r.width / PAGE_W;
    const p = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k, p];
  };

  const canDraw = (e: React.PointerEvent) =>
    e.pointerType === "pen" || (toolRef.current.drawWithFinger && (e.pointerType === "touch" || e.pointerType === "mouse"));

  const eraseAt = (x: number, y: number, r: number) => {
    let hit = false;
    strokes.current.forEach((s, index) => {
      if (s.tool === "eraser-precise" || erased.current.some((e) => e.stroke.id === s.id)) return;
      if (hitsStroke(s, x, y, r)) {
        erased.current.push({ stroke: s, index });
        hit = true;
      }
    });
    if (hit) {
      const ids = new Set(erased.current.map((e) => e.stroke.id));
      const hl = prep(hlRef.current);
      const ink = prep(inkRef.current);
      if (hl && ink) for (const s of strokes.current) if (!ids.has(s.id)) drawStroke(s.tool === "highlighter" ? hl : ink, s);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const now = performance.now();
    if (e.pointerType === "touch" && !toolRef.current.drawWithFinger) {
      // Palm rejection: ignore touches while the pen is down or just lifted.
      if (activePen.current != null || now - lastPenUp.current < PALM_GRACE_MS) return;
      finger.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    if (!canDraw(e) || activePen.current != null) return;
    e.preventDefault();
    liveRef.current?.setPointerCapture(e.pointerId);
    activePen.current = e.pointerId;
    finger.current = null;
    const t = toolRef.current;
    t0.current = now;
    erased.current = [];
    current.current = { id: uid(), tool: t.tool, color: t.color, size: t.size, points: [toPage(e)], times: [0], createdAt: Date.now() };
    if (t.tool === "eraser-stroke") eraseAt(...(current.current.points[0].slice(0, 2) as [number, number]), t.size / 2);
    onPenActivity?.("down");
    schedule();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (finger.current && e.pointerId === finger.current.id) {
      // One-finger scroll of the nearest scrollable ancestor.
      const dy = finger.current.y - e.clientY;
      const dx = finger.current.x - e.clientX;
      finger.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      scrollParent(wrapRef.current)?.scrollBy(dx, dy);
      return;
    }
    if (e.pointerId !== activePen.current || !current.current) return;
    const s = current.current;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    const list = events.length ? events : [e.nativeEvent];
    for (const ev of list) {
      const pt = toPage(ev);
      s.points.push(pt);
      s.times!.push(Math.round(performance.now() - t0.current));
      if (s.tool === "eraser-stroke") eraseAt(pt[0], pt[1], s.size / 2);
    }
    schedule();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (finger.current?.id === e.pointerId) finger.current = null;
    if (e.pointerId !== activePen.current) return;
    activePen.current = null;
    lastPenUp.current = performance.now();
    const s = current.current;
    current.current = null;
    prep(liveRef.current);
    if (!s) return;

    if (s.tool === "eraser-stroke") {
      if (erased.current.length) commit({ type: "remove", items: erased.current });
      erased.current = [];
      redrawAll();
    } else if (s.tool === "lasso") {
      const xs = s.points.map((p) => p[0]);
      const ys = s.points.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      if (box.w > 10 && box.h > 10) onLassoSelect?.(box);
    } else {
      commit({ type: "add", stroke: s, index: strokes.current.length });
      // Incremental commit: draw just this stroke onto its layer.
      if (s.tool === "eraser-precise") redrawAll();
      else {
        const k = scale.current * dpr.current;
        const c = (s.tool === "highlighter" ? hlRef : inkRef).current?.getContext("2d");
        if (c) {
          c.setTransform(k, 0, 0, k, 0, 0);
          drawStroke(c, s);
        }
      }
    }
    onPenActivity?.("up");
  };

  // Block Safari gestures (magnifier, double-tap zoom, pinch-zoom of the page) over the canvas.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const stop = (ev: Event) => ev.preventDefault();
    el.addEventListener("touchstart", stop, { passive: false });
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("gesturestart", stop);
    el.addEventListener("dblclick", stop);
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("gesturestart", stop);
      el.removeEventListener("dblclick", stop);
    };
  }, []);

  const layer = "absolute inset-0 h-full w-full";
  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none overflow-hidden rounded-sm shadow-[0_1px_3px_rgba(29,42,68,.18)]"
      style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
    >
      <div className={`${layer} bg-[var(--paper)]`} style={{ ["--u" as string]: `${unitPx}px`, ...templateStyle(page.template) }} />
      <canvas ref={hlRef} className={layer} style={{ opacity: 0.35 }} />
      <canvas ref={inkRef} className={layer} />
      <canvas
        ref={liveRef}
        className={layer}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <svg className={`${layer} pointer-events-none`} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} preserveAspectRatio="none">
        {children}
      </svg>
    </div>
  );
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}
