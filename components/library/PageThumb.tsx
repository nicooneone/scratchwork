"use client";
// Owner: C. Small live preview of a page: template background + ink on one canvas.
import { memo, useEffect, useRef } from "react";
import { drawStroke } from "@/lib/ink/render";
import { highlighterOpacity } from "@/lib/ink/tools";
import { useTheme } from "@/lib/useTheme";
import { templateStyle } from "@/lib/ink/templates";
import { PAGE_H, PAGE_W, type Page } from "@/lib/types";

const THUMB_W = 104;

export const PageThumb = memo(
  function PageThumb({ page }: { page: Page }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const theme = useTheme(); // ink colors adapt to the paper, so redraw when it flips

    useEffect(() => {
      const c = ref.current;
      if (!c) return;
      // Redraw a beat later so a burst of strokes doesn't redraw every thumbnail every time.
      const t = setTimeout(() => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.round(THUMB_W * dpr);
        c.height = Math.round(THUMB_W * (PAGE_H / PAGE_W) * dpr);
        const ctx = c.getContext("2d");
        if (!ctx) return;
        const k = (THUMB_W * dpr) / PAGE_W;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        for (const s of page.strokes) {
          ctx.globalAlpha = s.tool === "highlighter" ? highlighterOpacity(theme) : 1;
          drawStroke(ctx, s, { plainPencil: true, theme });
        }
        ctx.globalAlpha = 1;
      }, 250);
      return () => clearTimeout(t);
    }, [page.strokes, theme]);

    useEffect(() => {
      const c = ref.current;
      return () => {
        if (c) c.width = 0; // free canvas memory on iPad
      };
    }, []);

    return (
      <div className="relative w-full overflow-hidden rounded-[3px] bg-paper" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}>
        <div className="absolute inset-0" style={{ ["--u" as string]: `${THUMB_W / PAGE_W}px`, ...templateStyle(page.template) }} />
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      </div>
    );
  },
  (a, b) => a.page.strokes === b.page.strokes && a.page.template === b.page.template,
);
