"use client";
// Owner: A. Test bench for the ink engine (Step 1). Not the real UI: C's toolbar replaces this.
// Strokes autosave to IndexedDB, so a reload should bring them back.
import { useEffect, useRef, useState } from "react";
import PageCanvas, { type PageCanvasHandle } from "@/components/canvas/PageCanvas";
import { db, savePage } from "@/lib/db";
import { renderToPng, strokesBounds } from "@/lib/ink/export";
import { TEMPLATES } from "@/lib/ink/templates";
import { HIGHLIGHTER_COLORS, INK_COLORS, TOOL_PRESETS } from "@/lib/ink/tools";
import { segmentLines } from "@/lib/ink/segment";
import type { Box, Page, Stroke, ToolKind, ToolState } from "@/lib/types";

const DEV_PAGE_ID = "dev-canvas-page";
const TOOLS: ToolKind[] = ["pen", "fineliner", "pencil", "highlighter", "eraser-stroke", "eraser-precise", "lasso"];

export default function DevCanvas() {
  const [page, setPage] = useState<Page | null>(null);
  const [tool, setTool] = useState<ToolState>({ tool: "pen", color: INK_COLORS[0], size: TOOL_PRESETS.pen.defaultSize, drawWithFinger: false, tutorMode: false });
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [exported, setExported] = useState<string | null>(null);
  const [lasso, setLasso] = useState<Box | null>(null);
  const canvasRef = useRef<PageCanvasHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    db().pages.get(DEV_PAGE_ID).then((p) =>
      setPage(p ?? { id: DEV_PAGE_ID, notebookId: "dev", index: 0, template: "grid", strokes: [], updatedAt: Date.now() }),
    );
  }, []);

  if (!page) return null;

  const onChange = (strokes: Stroke[]) => {
    const next = { ...page, strokes };
    setPage(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePage(next), 500);
  };

  const pickTool = (t: ToolKind) => {
    const color = t === "highlighter" ? HIGHLIGHTER_COLORS[0] : tool.tool === "highlighter" ? INK_COLORS[0] : tool.color;
    setTool({ ...tool, tool: t, color, size: TOOL_PRESETS[t].defaultSize });
  };

  const exportPage = async () => {
    const region = lasso ?? strokesBounds(page.strokes);
    if (!region) return;
    const lines = segmentLines(page.strokes);
    setExported(await renderToPng(page.strokes, region, { lineNumbers: lines }));
  };

  const colors = tool.tool === "highlighter" ? HIGHLIGHTER_COLORS : INK_COLORS;
  const btn = "rounded-md border px-2.5 py-1.5 text-sm";
  const on = "border-ink bg-ink text-paper";
  const off = "border-rule bg-paper";

  return (
    <main className="flex h-[100dvh] flex-col bg-desk">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-rule bg-paper px-3 py-2">
        {TOOLS.map((t) => (
          <button key={t} onClick={() => pickTool(t)} className={`${btn} ${tool.tool === t ? on : off}`}>
            {TOOL_PRESETS[t].label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-rule" />
        {colors.map((c) => (
          <button
            key={c}
            aria-label={`Color ${c}`}
            onClick={() => setTool({ ...tool, color: c })}
            className={`h-7 w-7 rounded-full border-2 ${tool.color === c ? "border-ink" : "border-transparent"}`}
            style={{ background: c }}
          />
        ))}
        <label className="flex items-center gap-2 text-sm">
          Size
          <input
            id="dev-size"
            type="range"
            min={TOOL_PRESETS[tool.tool].minSize}
            max={TOOL_PRESETS[tool.tool].maxSize}
            step={0.5}
            value={tool.size}
            onChange={(e) => setTool({ ...tool, size: Number(e.target.value) })}
          />
          <span className="w-8 tabular-nums">{tool.size}</span>
        </label>
        <span className="mx-1 h-6 w-px bg-rule" />
        <button disabled={!history.canUndo} onClick={() => canvasRef.current?.undo()} className={`${btn} ${off} disabled:opacity-40`}>
          Undo
        </button>
        <button disabled={!history.canRedo} onClick={() => canvasRef.current?.redo()} className={`${btn} ${off} disabled:opacity-40`}>
          Redo
        </button>
        <label className="flex items-center gap-1.5 text-sm">
          <input id="dev-finger" type="checkbox" checked={tool.drawWithFinger} onChange={(e) => setTool({ ...tool, drawWithFinger: e.target.checked })} />
          Draw with finger
        </label>
        <select
          id="dev-template"
          value={page.template}
          onChange={(e) => {
            const next = { ...page, template: e.target.value as Page["template"] };
            setPage(next);
            savePage(next);
          }}
          className={`${btn} ${off}`}
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button onClick={exportPage} className={`${btn} ${off}`}>
          Export {lasso ? "lasso" : "page"} for AI
        </button>
        <span className="text-xs text-ink-soft tabular-nums">{page.strokes.length} strokes</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <PageCanvas
          ref={canvasRef}
          page={page}
          toolState={tool}
          onChange={onChange}
          onHistoryChange={setHistory}
          onLassoSelect={setLasso}
        >
          {lasso && <rect x={lasso.x} y={lasso.y} width={lasso.w} height={lasso.h} fill="none" stroke="#2456c9" strokeDasharray="6 5" strokeWidth={1.5} />}
        </PageCanvas>
        {exported && (
          <button
            onClick={() => setExported(null)}
            className="absolute bottom-4 right-4 max-w-[45%] rounded-md border border-rule bg-white p-2 shadow-lg"
            aria-label="Close export preview"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${exported}`} alt="What the AI will see" className="max-h-[40vh]" />
            <span className="mt-1 block text-xs text-ink-soft">What the AI sees · tap to close</span>
          </button>
        )}
      </div>
    </main>
  );
}
