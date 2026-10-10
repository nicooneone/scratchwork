"use client";
// Owner: C. AI side panel (slides in from the right): Ask · Quiz · Insights.
//  - Ask: chat over every notebook; citations become tappable "Calc 1 · p4" chips.
//  - Quiz: questions aimed at the weakest topics; "Make quiz page" turns them into a page you answer by hand.
//  - Insights: BKT mastery per topic (weakest first, with the most common mistake) + concept map.
import { useCallback, useEffect, useRef, useState } from "react";
import { allStruggles } from "@/lib/db";
import { masteryFromEvents } from "@/lib/math/mastery";
import type { AskRequest, AskResponse, Box, MasteryState, Notebook, Page, QuizQuestion, StruggleEvent } from "@/lib/types";
import { ConceptMap } from "@/components/brain/ConceptMap";
import { Icon } from "@/components/ui/icons";
import { Squiggle } from "@/components/ui/Squiggle";
import { indexStalePages, loadAllPages, pageLabel, toContexts } from "./indexing";

type Tab = "ask" | "quiz" | "insights";
interface Msg {
  role: "user" | "ai";
  text: string;
  citations?: string[];
}

export interface AIPanelProps {
  open: boolean;
  onClose(): void;
  mock?: boolean;
  /** Region the student lassoed: Ask sends it as an image along with the question. */
  snippet?: { png: string; box: Box } | null;
  onClearSnippet?(): void;
  onNavigate(pageId: string): void;
  onMakeQuizPage(questions: QuizQuestion[]): void;
  /** Called with pages whose transcripts were just refreshed, so the open notebook keeps them. */
  onIndexed?(pages: Page[]): void;
}

export function AIPanel(props: AIPanelProps) {
  const [tab, setTab] = useState<Tab>("ask");
  const [all, setAll] = useState<{ pages: Page[]; notebooks: Map<string, Notebook> }>({ pages: [], notebooks: new Map() });
  const [struggles, setStruggles] = useState<StruggleEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [data, s] = await Promise.all([loadAllPages(), allStruggles()]);
    setAll(data);
    setStruggles(s);
    return data;
  }, []);

  useEffect(() => {
    if (!props.open) return;
    Promise.all([loadAllPages(), allStruggles()]).then(([data, s]) => {
      setAll(data);
      setStruggles(s);
    });
  }, [props.open]);

  // A new lasso selection jumps to Ask (adjusting state during render, not in an effect).
  const [prevSnippet, setPrevSnippet] = useState(props.snippet);
  if (props.snippet !== prevSnippet) {
    setPrevSnippet(props.snippet);
    if (props.snippet) setTab("ask");
  }

  /** Make sure every page with ink has a fresh transcript before asking the AI about the notebooks. */
  const ensureIndexed = useCallback(async () => {
    const data = await refresh();
    const updated = await indexStalePages(data.pages, {
      mock: props.mock,
      onProgress: (done, total) => total > 0 && setBusy(done < total ? `Reading your pages (${done + 1}/${total})…` : null),
    });
    if (updated.length) props.onIndexed?.(updated);
    return refresh();
  }, [props, refresh]);

  if (!props.open) return null;

  return (
    <aside className="chrome absolute inset-y-0 right-0 z-30 flex w-[min(380px,100%)] flex-col border-l border-rule bg-paper shadow-[-12px_0_32px_-16px_rgba(29,42,68,.35)] animate-[panel-in_.2s_ease-out]">
      <div className="flex items-center gap-1 border-b border-rule p-2">
        {(["ask", "quiz", "insights"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-10 flex-1 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-ink text-paper" : "text-ink-soft hover:bg-desk"}`}>
            {t}
          </button>
        ))}
        <button aria-label="Close panel" onClick={props.onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-desk">
          <Icon.close size={18} />
        </button>
      </div>
      {props.mock && <div className="bg-desk px-3 py-1 text-center text-[11px] text-ink-soft">Sample data (mock mode)</div>}

      {tab === "ask" && <AskTab {...props} all={all} struggles={struggles} ensureIndexed={ensureIndexed} busy={busy} />}
      {tab === "quiz" && <QuizTab {...props} struggles={struggles} ensureIndexed={ensureIndexed} busy={busy} />}
      {tab === "insights" && <InsightsTab all={all} struggles={struggles} onNavigate={props.onNavigate} />}
    </aside>
  );
}

// ---------------- Ask ----------------

function AskTab({
  all,
  struggles,
  ensureIndexed,
  busy,
  mock,
  snippet,
  onClearSnippet,
  onNavigate,
}: AIPanelProps & { all: { pages: Page[]; notebooks: Map<string, Notebook> }; struggles: StruggleEvent[]; ensureIndexed(): Promise<{ pages: Page[]; notebooks: Map<string, Notebook> }>; busy: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, thinking, busy]);

  const send = async (question: string) => {
    if (!question.trim() || thinking) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ("");
    setThinking(true);
    try {
      const data = await ensureIndexed();
      const pages = toContexts(data.pages, data.notebooks);
      if (!pages.length && !mock && !snippet) {
        setMsgs((m) => [...m, { role: "ai", text: "I haven't read any of your pages yet. Write some notes, then ask me again." }]);
        return;
      }
      const body: AskRequest = { question, pages, struggles, snippetPng: snippet?.png };
      const res = await fetch(`/api/ask${mock ? "?mock=1" : ""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ask is unavailable right now.");
      const a = json as AskResponse;
      setMsgs((m) => [...m, { role: "ai", text: a.answer, citations: a.citations }]);
      onClearSnippet?.();
    } catch (e) {
      setMsgs((m) => [...m, { role: "ai", text: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setThinking(false);
    }
  };

  const labelOf = (id: string) => {
    const p = all.pages.find((x) => x.id === id);
    return p ? pageLabel(p, all.notebooks) : null;
  };

  return (
    <>
      <div className="scroll-y flex-1 space-y-3 p-3">
        {msgs.length === 0 && (
          <div className="pt-6 text-center">
            <p className="font-hand text-2xl">Ask about your notes</p>
            <p className="mt-1 text-sm text-ink-soft">I&apos;ve read every notebook. Answers link to the page they came from.</p>
            <div className="mt-4 flex flex-col gap-2">
              {["What did I struggle with this week?", "Summarize my chain rule notes", "Where did I explain u-substitution?"].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-rule bg-white px-3 py-2 text-left text-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-ink text-paper" : "rounded-bl-sm bg-white ring-1 ring-rule"}`}>
              <CitedText text={m.text} labelOf={labelOf} onNavigate={onNavigate} />
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...new Set(m.citations)].map((id) => (
                    <button key={id} onClick={() => onNavigate(id)} className="rounded-full bg-desk px-2.5 py-1 text-xs font-medium text-ink">
                      {labelOf(id) ?? "Open page"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {(thinking || busy) && <Squiggle label={busy ?? "Thinking…"} />}
        <div ref={end} />
      </div>
      {snippet && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-desk p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${snippet.png}`} alt="Selected region" className="h-12 rounded bg-white object-contain" />
          <span className="flex-1 text-xs text-ink-soft">Asking about this selection</span>
          <button aria-label="Remove selection" onClick={onClearSnippet} className="h-8 w-8 text-ink-soft">
            <Icon.close size={16} />
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(q);
        }}
        className="flex gap-2 border-t border-rule p-2 pb-[max(env(safe-area-inset-bottom),8px)]"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={snippet ? "What about this part?" : "Ask about your notes…"} className="h-11 min-w-0 flex-1 rounded-full border border-rule bg-white px-4 outline-none focus:border-ink" />
        <button aria-label="Send" disabled={!q.trim() || thinking} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-40">
          <Icon.send size={18} />
        </button>
      </form>
    </>
  );
}

/** Inline [[pageId]] markers become chips; everything else is plain text. */
function CitedText({ text, labelOf, onNavigate }: { text: string; labelOf(id: string): string | null; onNavigate(id: string): void }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const m = part.match(/^\[\[([^\]]+)\]\]$/);
        if (!m) return part;
        const label = labelOf(m[1]);
        return label ? (
          <button key={i} onClick={() => onNavigate(m[1])} className="mx-0.5 rounded bg-desk px-1.5 py-0.5 align-baseline text-xs font-medium text-ink">
            {label}
          </button>
        ) : null;
      })}
    </span>
  );
}

// ---------------- Quiz ----------------

function QuizTab({ struggles, ensureIndexed, busy, mock, onMakeQuizPage }: AIPanelProps & { struggles: StruggleEvent[]; ensureIndexed(): Promise<{ pages: Page[]; notebooks: Map<string, Notebook> }>; busy: string | null }) {
  const [qs, setQs] = useState<QuizQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ensureIndexed();
      const pages = toContexts(data.pages, data.notebooks);
      if (!pages.length && !mock) throw new Error("Write a few pages of notes first, then I can quiz you on them.");
      const mastery: MasteryState[] = masteryFromEvents(struggles);
      const res = await fetch(`/api/quiz${mock ? "?mock=1" : ""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pages, mastery }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Quiz is unavailable right now.");
      setQs(json as QuizQuestion[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scroll-y flex-1 p-3">
      <p className="font-hand text-2xl">Quiz me</p>
      <p className="text-sm text-ink-soft">Questions from your own notes, aimed at the topics you&apos;ve found hardest.</p>
      <button onClick={make} disabled={loading} className="mt-3 h-11 w-full rounded-full bg-ink font-medium text-paper disabled:opacity-50">
        {qs ? "Make a new quiz" : "Make me a quiz"}
      </button>
      {(loading || busy) && <Squiggle className="mt-3" label={busy ?? "Writing questions…"} />}
      {error && <p className="mt-3 text-sm text-mark">{error}</p>}
      {qs && !loading && (
        <>
          <ol className="mt-4 space-y-2">
            {qs.map((q, i) => (
              <li key={q.id} className="rounded-xl bg-white p-3 ring-1 ring-rule">
                <div className="text-[15px]">
                  <span className="font-semibold">{i + 1}.</span> {q.prompt}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-soft">{q.topic.replace(/-/g, " ")}</div>
              </li>
            ))}
          </ol>
          <button onClick={() => onMakeQuizPage(qs)} className="mt-3 h-11 w-full rounded-full border-2 border-ink font-medium">
            Make quiz page
          </button>
          <p className="mt-2 text-center text-xs text-ink-soft">Answer by hand. Tutor mode grades each answer.</p>
        </>
      )}
    </div>
  );
}

// ---------------- Insights ----------------

function InsightsTab({ all, struggles, onNavigate }: { all: { pages: Page[]; notebooks: Map<string, Notebook> }; struggles: StruggleEvent[]; onNavigate(id: string): void }) {
  const mastery = masteryFromEvents(struggles);
  const topMistake = (topic: string) => {
    const counts = new Map<string, number>();
    for (const e of struggles) if (e.topic === topic && !e.correct && e.misconception) counts.set(e.misconception, (counts.get(e.misconception) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  return (
    <div className="scroll-y flex-1 space-y-5 p-3">
      <section>
        <p className="font-hand text-2xl">Where you&apos;re at</p>
        {mastery.length === 0 ? (
          <p className="text-sm text-ink-soft">Turn on Tutor mode and work some problems. Each checked line updates your mastery.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {mastery.map((m) => {
              const pct = Math.round(m.pKnown * 100);
              const mistake = topMistake(m.topic);
              return (
                <li key={m.topic}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium capitalize">{m.topic.replace(/-/g, " ")}</span>
                    <span className="tabular-nums text-ink-soft">
                      {pct}% · {m.attempts} {m.attempts === 1 ? "line" : "lines"}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-desk">
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: pct >= 95 ? "var(--ok)" : pct < 50 ? "var(--mark)" : "var(--ink)" }} />
                  </div>
                  {mistake && <div className="mt-1 text-xs text-ink-soft">Most common slip: {mistake.replace(/-/g, " ")}</div>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">Mastery is estimated with Bayesian Knowledge Tracing.</p>
      </section>
      <section>
        <p className="font-hand text-2xl">How your topics connect</p>
        <div className="mt-2">
          <ConceptMap pages={all.pages} notebooks={all.notebooks} onNavigate={onNavigate} />
        </div>
      </section>
    </div>
  );
}
