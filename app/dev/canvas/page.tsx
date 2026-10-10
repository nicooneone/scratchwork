"use client";
// Owner: A. Test bench for the ink engine until C's toolbar lands.
// Also exercises the Live Check plumbing end to end: segment -> PNG -> /api/check -> overlay.

import { useCallback, useEffect, useRef, useState } from "react";
import PageCanvas, { type PageCanvasHandle } from "@/components/canvas/PageCanvas";
import { db, savePage } from "@/lib/db";
import { TEMPLATES } from "@/lib/ink/templates";
import { segmentLines } from "@/lib/ink/segment";
import { renderToPng } from "@/lib/ink/export";
import { DEFAULT_SIZES } from "@/lib/ink/tools";
import type { Box, CheckResult, Page, Stroke, TemplateId, ToolKind, ToolState } from "@/lib/types";

const blankPage: Page = { id: "dev-page", notebookId: "dev", index: 0, template: "grid", strokes: [], updatedAt: 0 };

const DEV_PAGE_ID = "dev-page";
const TOOLS: ToolKind[] = ["pen", "fineliner", "pencil", "highlighter", "eraser-stroke", "eraser-precise", "lasso"];
const COLORS = ["#1b1b1b", "#1d2a44", "#c8322b", "#2f7d4f", "#f5d90a"];

export default function DevCanvas() {
  const [page, setPage] = useState<Page | null>(null);
  const [tool, setTool] = useState<ToolState>({ tool: "pen", color: "#1b1b1b", size: DEFAULT_SIZES.pen, drawWithFinger: false, tutorMode: false });
  const [result, setResult] = useState<CheckResult | null>(null);
  const [lasso, setLasso] = useState<Box | null>(null);
  const [status, setStatus] = useState("");
  const canvas = useRef<PageCanvasHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const existing = await db().pages.get(DEV_PAGE_ID);
      setPage(existing ?? blankPage);
    })();
  }, []);

  const onChange = useCallback((strokes: Stroke[]) => {
    setPage((p) => {
      if (!p) return p;
      const next = { ...p, strokes };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => savePage(next).catch(console.error), 500);
      return next;
    });
  }, []);

  const pickTool = (t: ToolKind) => setTool((s) => ({ ...s, tool: t, size: DEFAULT_SIZES[t], color: t === "highlighter" ? "#f5d90a" : s.color === "#f5d90a" ? "#1b1b1b" : s.color }));

  const check = async (mock: "" | "correct" = "") => {
    if (!page) return;
    const lines = segmentLines(page.strokes);
    if (!lines.length) return setStatus("Write something first.");
    setStatus("Reading…");
    const t = performance.now();
    const region = lines.reduce((u, l) => union(u, l.box), lines[0].box);
    const png = await renderToPng(page.strokes, region, { lineNumbers: lines });
    const res = await fetch(`/api/check${mock ? `?mock=${mock}` : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId: page.id, png, lines }),
    });
    const data = await res.json();
    setStatus(res.ok ? `Checked in ${Math.round(performance.now() - t)} ms · PNG ${Math.round(png.length / 1024)} KB` : `Error: ${data.error}`);
    if (res.ok) setResult(data);
  };

  if (!page) return <main className="p-8">Loading…</main>;

  return (
    <main className="flex h-dvh flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-paper px-3 py-2 text-sm">
        {TOOLS.map((t) => (
          <button key={t} onClick={() => pickTool(t)} className={`rounded px-2 py-2 ${tool.tool === t ? "bg-ink text-paper" : "bg-desk"}`}>
            {t}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-rule" />
        {COLORS.map((c) => (
          <button key={c} aria-label={c} onClick={() => setTool((s) => ({ ...s, color: c }))} className={`h-8 w-8 rounded-full border-2 ${tool.color === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} />
        ))}
        <input type="range" min={1} max={40} value={tool.size} onChange={(e) => setTool((s) => ({ ...s, size: +e.target.value }))} className="w-28" />
        <button onClick={() => canvas.current?.undo()} className="rounded bg-desk px-3 py-2">Undo</button>
        <button onClick={() => canvas.current?.redo()} className="rounded bg-desk px-3 py-2">Redo</button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={tool.drawWithFinger} onChange={(e) => setTool((s) => ({ ...s, drawWithFinger: e.target.checked }))} />
          finger
        </label>
        <select value={page.template} onChange={(e) => { const next = { ...page, template: e.target.value as TemplateId }; setPage(next); savePage(next); }} className="rounded bg-desk px-2 py-2">
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="mx-1 h-6 w-px bg-rule" />
        <button onClick={() => check()} className="rounded bg-pen px-3 py-2 text-white">Check</button>
        <button onClick={() => check("correct")} className="rounded bg-ok px-3 py-2 text-white">Check (mock ok)</button>
        <button onClick={() => { setResult(null); setLasso(null); }} className="rounded bg-desk px-3 py-2">Clear marks</button>
        <span className="text-ink-soft">{status}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] p-4">
          <PageCanvas ref={canvas} page={page} toolState={tool} onChange={onChange} onLassoSelect={setLasso}>
            {segmentLines(page.strokes).map((l) => (
              <rect key={l.index} x={l.box.x} y={l.box.y} width={l.box.w} height={l.box.h} fill="none" stroke="#1d2a44" strokeOpacity={0.25} strokeDasharray="6 6" />
            ))}
            {lasso && <rect x={lasso.x} y={lasso.y} width={lasso.w} height={lasso.h} fill="#1d2a44" fillOpacity={0.06} stroke="#1d2a44" strokeDasharray="8 8" />}
            {result?.lines.map((l) => (
              <rect key={l.index} x={l.box.x} y={l.box.y} width={l.box.w} height={l.box.h} rx={18} fill="none" strokeWidth={4}
                stroke={l.verdict === "error" ? "#c8322b" : l.verdict === "correct" ? "#2f7d4f" : "#999"} />
            ))}
          </PageCanvas>
        </div>
      </div>
    </main>
  );
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
