"use client";
// Owner: C. One open notebook: toolbar, page rail, the page, tutor marks, hint card, AI panel.
//
// Live Check (Tutor mode): after a 2.5 s pause following a stroke, the page's lines are segmented,
// exported with L1:/L2: labels and sent to /api/check; Gemini reads, lib/math verifies.
// (Step 5 refines this loop: smaller regions, demo-mode replay, error states.)
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageCanvas, { type PageCanvasHandle } from "@/components/canvas/PageCanvas";
import { addPage, db, getNotebook, getPages, logStruggle, savePage } from "@/lib/db";
import { renderToPng } from "@/lib/ink/export";
import { segmentLines } from "@/lib/ink/segment";
import { INK_COLORS, TOOL_PRESETS } from "@/lib/ink/tools";
import { unlockAudio } from "@/lib/voice";
import type { Box, CheckRequest, CheckResult, CheckedLine, LineBox, Notebook, Page, PageBrain, QuizQuestion, Stroke, TemplateId, ToolState, Verdict } from "@/lib/types";
import { AIPanel } from "@/components/ai/AIPanel";
import { useBackgroundIndex } from "@/components/ai/useBackgroundIndex";
import { HintCard } from "@/components/ai/HintCard";
import { QuizOverlay, gradeQuiz, layoutQuiz } from "@/components/ai/QuizOverlay";
import { TutorMarks } from "@/components/ai/TutorMarks";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { PageRail } from "./PageRail";

const IDLE_MS = 2500;
const SAVE_MS = 500;

export default function NotebookView({ id, initialPageId, mock }: { id: string; initialPageId?: string; mock?: boolean }) {
  const router = useRouter();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [missing, setMissing] = useState(false);
  const [tool, setTool] = useState<ToolState>({ tool: "pen", color: INK_COLORS[0], size: TOOL_PRESETS.pen.defaultSize, drawWithFinger: false, tutorMode: true });
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [railOpen, setRailOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [snippet, setSnippet] = useState<{ png: string; box: Box } | null>(null);

  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [openLine, setOpenLine] = useState<CheckedLine | null>(null);
  const [grades, setGrades] = useState<Record<string, Verdict>>({});
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<PageCanvasHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const version = useRef(0); // bumps on every stroke change; stale check results are dropped
  const checkedVersion = useRef(-1);
  const inFlight = useRef(false);
  const hadError = useRef(false);

  const page = pages.find((p) => p.id === currentId) ?? null;
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      const [nb, ps] = await Promise.all([getNotebook(id), getPages(id)]);
      if (!nb) return setMissing(true);
      setNotebook(nb);
      setPages(ps);
      setCurrentId(ps.find((p) => p.id === initialPageId)?.id ?? ps[0]?.id ?? "");
    })();
  }, [id, initialPageId]);

  /** Show another page of this notebook and clear the previous page's marks. */
  const selectPage = useCallback((pageId: string) => {
    setCurrentId(pageId);
    setResult(null);
    setOpenLine(null);
    setGrades({});
    setCheckError(null);
    setSnippet(null);
    checkedVersion.current = -1;
    hadError.current = false;
  }, []);

  const updatePage = useCallback((next: Page) => {
    setPages((ps) => ps.map((p) => (p.id === next.id ? next : p)));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePage(next), SAVE_MS);
  }, []);

  /** Attach a fresh transcript without touching strokes the student wrote since it was exported. */
  const mergeBrain = useCallback((pageId: string, brain: PageBrain) => {
    setPages((ps) => ps.map((p) => (p.id === pageId ? { ...p, brain } : p)));
  }, []);

  // Notebook Brain: index changed pages after 10 s idle, in the background.
  useBackgroundIndex(pages, { mock, onIndexed: mergeBrain });

  // Flush a pending save when leaving the page.
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // ---------- Live Check ----------
  const runCheck = useCallback(
    async (force = false) => {
      const p = pageRef.current;
      if (!p || inFlight.current) return;
      if (!force && checkedVersion.current === version.current) return;
      const lines: LineBox[] = segmentLines(p.strokes);
      if (lines.length === 0) {
        setResult(null);
        return;
      }
      const v = version.current;
      inFlight.current = true;
      setChecking(true);
      setCheckError(null);
      try {
        const region = lines.reduce((u, l) => union(u, l.box), lines[0].box);
        const png = await renderToPng(p.strokes, region, { lineNumbers: lines });
        const body: CheckRequest = { pageId: p.id, png, lines, demoId: p.demoId };
        const res = await fetch(`/api/check${mock ? "?mock=1" : ""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "The tutor couldn't check this page.");
        if (version.current !== v || pageRef.current?.id !== p.id) return; // ink changed meanwhile: next idle check will redo it
        const r = json as CheckResult;
        checkedVersion.current = v;

        if (hadError.current && r.firstErrorIndex == null) setToast("Nice fix!");
        hadError.current = r.firstErrorIndex != null;
        setResult(r);
        if (r.firstErrorIndex == null) setOpenLine(null);
        if (p.quiz?.length) setGrades(gradeQuiz(p.quiz, r.lines));

        // Struggle log for mastery: one event per judged line, keyed by its strokes so re-checks don't double count.
        for (const l of r.lines) {
          if (!l.topic || l.verdict === "unclear") continue;
          const box = lines.find((b) => b.index === l.index);
          if (!box) continue;
          logStruggle({ key: hash([...box.strokeIds].sort().join(",")), pageId: p.id, topic: l.topic, misconception: l.misconception, correct: l.verdict === "correct", at: Date.now() }).catch(() => {});
        }
      } catch (e) {
        setCheckError(e instanceof Error ? e.message : "The tutor couldn't check this page.");
      } finally {
        inFlight.current = false;
        setChecking(false);
      }
    },
    [mock],
  );

  const onChange = useCallback(
    (strokes: Stroke[]) => {
      const p = pageRef.current;
      if (!p) return;
      version.current++;
      updatePage({ ...p, strokes, updatedAt: Date.now() });
      clearTimeout(idleTimer.current);
      if (tool.tutorMode) idleTimer.current = setTimeout(() => runCheck(), IDLE_MS);
    },
    [updatePage, runCheck, tool.tutorMode],
  );

  useEffect(() => () => clearTimeout(idleTimer.current), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- navigation ----------
  const navigate = useCallback(
    async (pageId: string) => {
      if (pages.some((p) => p.id === pageId)) return selectPage(pageId);
      const target = await db().pages.get(pageId);
      if (target) router.push(`/notebook/${target.notebookId}?page=${pageId}${mock ? "&mock=1" : ""}`);
    },
    [pages, router, mock, selectPage],
  );

  const makeQuizPage = async (qs: QuizQuestion[]) => {
    if (!notebook) return;
    const fresh = await addPage(notebook.id, "grid");
    const quizPage: Page = { ...fresh, quiz: layoutQuiz(qs) };
    await savePage(quizPage);
    setPages((ps) => [...ps, quizPage]);
    selectPage(quizPage.id);
    setAiOpen(false);
    setTool((t) => ({ ...t, tutorMode: true }));
  };

  if (missing)
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3">
        <p className="font-hand text-3xl">This notebook isn&apos;t on this device.</p>
        <button onClick={() => router.push("/")} className="h-11 rounded-full bg-ink px-5 text-paper">
          Back to library
        </button>
      </main>
    );
  if (!notebook || !page) return <main className="min-h-[100dvh] bg-desk" />;

  const errLine = result?.lines.find((l) => l.index === result.firstErrorIndex);

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-desk">
      <Toolbar
        title={notebook.title}
        toolState={tool}
        onToolState={(t) => {
          setTool(t);
          if (t.tutorMode && !tool.tutorMode) runCheck(true);
          if (!t.tutorMode) {
            setResult(null);
            setOpenLine(null);
          }
        }}
        history={history}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        onBack={() => router.push("/")}
        aiOpen={aiOpen}
        onToggleAI={() => setAiOpen((o) => !o)}
        onCheck={() => runCheck(true)}
        checking={checking}
        railOpen={railOpen}
        onToggleRail={() => setRailOpen((o) => !o)}
      />

      <div className="flex min-h-0 flex-1">
        {railOpen && (
          <PageRail
            pages={pages}
            currentId={currentId}
            onSelect={selectPage}
            onAdd={async (t: TemplateId) => {
              const np = await addPage(notebook.id, t);
              setPages((ps) => [...ps, np]);
              selectPage(np.id);
            }}
            onTemplate={(t) => updatePage({ ...page, template: t })}
          />
        )}

        <div className="relative min-w-0 flex-1">
          <PageCanvas
            key={page.id}
            ref={canvasRef}
            page={page}
            toolState={tool}
            onChange={onChange}
            onHistoryChange={setHistory}
            onLassoSelect={async (box) => {
              const png = await renderToPng(page.strokes, box);
              setSnippet({ png, box });
              setAiOpen(true);
            }}
          >
            {snippet && <rect x={snippet.box.x} y={snippet.box.y} width={snippet.box.w} height={snippet.box.h} rx={8} fill="rgba(36,86,201,.06)" stroke="#2456c9" strokeDasharray="8 6" strokeWidth={2} />}
            {page.quiz?.length ? <QuizOverlay questions={page.quiz} grades={grades} /> : null}
            {tool.tutorMode && result && (
              <TutorMarks
                result={result}
                onOpen={(l) => {
                  unlockAudio(); // inside the tap, so the spoken hint can play on iPad
                  setOpenLine(l);
                }}
              />
            )}
          </PageCanvas>

          {/* status chip */}
          {tool.tutorMode && (checking || checkError) && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-paper/95 px-3 py-1.5 text-sm shadow-md ring-1 ring-rule">
              {checking ? <span className="font-hand text-lg">Reading your work…</span> : <span className="text-ink-soft">{checkError}</span>}
            </div>
          )}
          {toast && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-ok px-4 py-1.5 font-hand text-xl text-white shadow-md animate-[sheet-in_.2s_ease-out]">{toast}</div>
          )}

          {openLine && errLine && tool.tutorMode && (
            <HintCard
              key={`${openLine.index}-${openLine.text}`}
              line={errLine}
              context={result?.lines ?? []}
              mock={mock}
              onClose={() => setOpenLine(null)}
              onFixed={() => runCheck(true)}
            />
          )}

          <AIPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            mock={mock}
            snippet={snippet}
            onClearSnippet={() => setSnippet(null)}
            onNavigate={navigate}
            onMakeQuizPage={makeQuizPage}
            onIndexed={(updated) => updated.forEach((u) => u.brain && mergeBrain(u.id, u.brain))}
          />
        </div>
      </div>
    </main>
  );
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Short stable hash (FNV-1a) for struggle-log keys. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
