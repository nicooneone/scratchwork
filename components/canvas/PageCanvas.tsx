"use client";
// Owner: A. STUB from Step 0 — the props and handle are the contract; the ink engine lands in Step 1.
// Renders one page at a fixed 1000 × 1414 logical size, scaled to the container width.
import { useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { templateStyle } from "@/lib/ink/templates";
import { PAGE_H, PAGE_W, type Box, type Page, type Stroke, type ToolState } from "@/lib/types";

export interface PageCanvasHandle {
  undo(): void;
  redo(): void;
}

export interface PageCanvasProps {
  page: Page;
  toolState: ToolState;
  onChange(strokes: Stroke[]): void;
  onLassoSelect?(box: Box): void;
  /** SVG overlay content (Live Check marks), drawn in page units: viewBox 0 0 1000 1414. */
  children?: ReactNode;
  ref?: Ref<PageCanvasHandle>;
}

export default function PageCanvas({ page, children, ref }: PageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useImperativeHandle(ref, () => ({ undo() {}, redo() {} }), []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}>
      <div
        className="absolute inset-0 overflow-hidden rounded-sm bg-[var(--paper)] shadow-[0_1px_3px_rgba(29,42,68,.18)]"
        style={{ ["--u" as string]: `${scale}px`, ...templateStyle(page.template) }}
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}>
        {children}
      </svg>
    </div>
  );
}
