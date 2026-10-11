"use client";
// Owner: C. AI side panel (slides in from the right): Ask · Quiz · Insights.
//  - Ask: chat over every notebook; citations become tappable "Calc 1 · p4" chips.
//  - Quiz: questions aimed at the weakest topics; "Make quiz page" turns them into a page you answer by hand.
//  - Insights: BKT mastery per topic (weakest first, with the most common mistake) + concept map.
import { useCallback, useEffect, useRef, useState } from "react";
import { allStruggles } from "@/lib/db";
import { masteryFromEvents } from "@/lib/math/mastery";
import type { AskRequest, AskResponse, Box, Notebook, Page, QuizQuestion, QuizSettings, StruggleEvent } from "@/lib/types";
import { ConceptMap } from "@/components/brain/ConceptMap";
import { Icon } from "@/components/ui/icons";
import { Squiggle } from "@/components/ui/Squiggle";
import { MathText } from "@/components/math/MathText";
import { indexStalePages, loadAllPages, pageLabel, toContexts } from "./indexing";
import { COUNTS, DEFAULT_SETTINGS, DIFFICULTIES, PER_PAGE, PRESETS, STYLES, TIMERS, generateQuiz, knownTopics, loadSettings, saveSettings } from "./quizApi";

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
  onMakeQuizPage(questions: QuizQuestion[], settings: QuizSettings): void;
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
      {tab === "quiz" && <QuizTab {...props} all={all} struggles={struggles} />}
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
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-rule bg-surface px-3 py-2 text-left text-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-ink text-paper" : "rounded-bl-sm bg-surface ring-1 ring-rule"}`}>
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={snippet ? "What about this part?" : "Ask about your notes…"} className="h-11 min-w-0 flex-1 rounded-full border border-rule bg-surface px-4 outline-none focus:border-ink" />
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

function QuizTab({ all, struggles, mock, onMakeQuizPage }: AIPanelProps & { all: { pages: Page[]; notebooks: Map<string, Notebook> }; struggles: StruggleEvent[] }) {
  const [settings, setSettingsState] = useState<QuizSettings>(() => loadSettings());
  const [custom, setCustom] = useState(false);
  const [qs, setQs] = useState<QuizQuestion[] | null>(null);
  const [usedSettings, setUsedSettings] = useState<QuizSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setSettings = (patch: Partial<QuizSettings>) =>
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });

  const topics = knownTopics(all.pages, struggles.map((e) => e.topic));
  const notebooks = [...all.notebooks.values()];
  const activePreset = PRESETS.find((p) => Object.entries(p.settings).every(([k, v]) => settings[k as keyof QuizSettings] === v))?.id;
  const busy = status !== null;

  const make = async () => {
    setError(null);
    setStatus("Getting ready…");
    try {
      const out = await generateQuiz(settings, { mock, onProgress: setStatus });
      setQs(out);
      setUsedSettings(settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStatus(null);
    }
  };

  const replace = async (q: QuizQuestion) => {
    if (!qs || !usedSettings) return;
    setReplacing(q.id);
    setError(null);
    try {
      const topicOnly: QuizSettings = { ...usedSettings, count: 1, focus: "topics", topics: [q.topic] };
      const [fresh] = await generateQuiz(topicOnly, { mock, exclude: qs.map((x) => x.prompt) });
      if (fresh) setQs((cur) => cur?.map((x) => (x.id === q.id ? fresh : x)) ?? cur);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't replace that one.");
    } finally {
      setReplacing(null);
    }
  };

  const pagesNeeded = qs ? Math.ceil(qs.length / PER_PAGE) : 0;
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors ${on ? "bg-ink text-paper ring-ink" : "bg-surface text-ink ring-rule"}`;
  const seg = (on: boolean) => `h-9 flex-1 rounded-lg text-[13px] font-medium ${on ? "bg-ink text-paper" : "text-ink-soft"}`;

  return (
    <div className="scroll-y flex-1 p-3">
      <p className="font-hand text-2xl">Quiz me</p>
      <p className="text-sm text-ink-soft">Questions from your own notes. Pick a preset or make it yours.</p>

      {/* presets */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSettings({ ...p.settings, topics: [], styles: [], instructions: "" })}
            className={`rounded-xl p-2.5 text-left ring-1 ${activePreset === p.id ? "bg-ink text-paper ring-ink" : "bg-surface ring-rule"}`}
          >
            <div className="text-sm font-semibold">{p.label}</div>
            <div className={`text-[11px] ${activePreset === p.id ? "text-paper/80" : "text-ink-soft"}`}>{p.blurb}</div>
          </button>
        ))}
      </div>

      <button onClick={() => setCustom((c) => !c)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-desk px-3 py-2.5 text-sm font-medium">
        <span>Customize</span>
        <span className="text-ink-soft">
          {settings.count} · {DIFFICULTIES.find((d) => d.id === settings.difficulty)?.label}
          {settings.timerMin ? ` · ${settings.timerMin} min` : ""} {custom ? "▴" : "▾"}
        </span>
      </button>

      {custom && (
        <div className="mt-2 space-y-4 rounded-xl bg-surface p-3 ring-1 ring-rule">
          <Field label="Questions">
            <div className="flex gap-1 rounded-xl bg-desk p-1">
              {COUNTS.map((n) => (
                <button key={n} onClick={() => setSettings({ count: n })} className={seg(settings.count === n)}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Difficulty">
            <div className="flex gap-1 rounded-xl bg-desk p-1">
              {DIFFICULTIES.map((d) => (
                <button key={d.id} onClick={() => setSettings({ difficulty: d.id })} className={seg(settings.difficulty === d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Focus">
            <div className="flex gap-1 rounded-xl bg-desk p-1">
              {(
                [
                  ["weak", "Weak spots"],
                  ["mixed", "Mixed"],
                  ["topics", "Pick topics"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setSettings({ focus: id })} className={seg(settings.focus === id)}>
                  {label}
                </button>
              ))}
            </div>
            {settings.focus === "topics" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topics.length === 0 && <span className="text-xs text-ink-soft">Topics show up once your pages are read.</span>}
                {topics.map((t) => (
                  <button key={t} onClick={() => setSettings({ topics: toggle(settings.topics, t) })} className={chip(settings.topics.includes(t))}>
                    {t.replace(/-/g, " ")}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Question types" note={settings.styles.length ? undefined : "any"}>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((st) => (
                <button key={st.id} onClick={() => setSettings({ styles: toggle(settings.styles, st.id) })} className={chip(settings.styles.includes(st.id))}>
                  {st.label}
                </button>
              ))}
            </div>
          </Field>
          {notebooks.length > 1 && (
            <Field label="From notebooks" note={settings.notebookIds.length ? undefined : "all"}>
              <div className="flex flex-wrap gap-1.5">
                {notebooks.map((nb) => (
                  <button key={nb.id} onClick={() => setSettings({ notebookIds: toggle(settings.notebookIds, nb.id) })} className={chip(settings.notebookIds.includes(nb.id))}>
                    {nb.title}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Timer">
            <div className="flex gap-1 rounded-xl bg-desk p-1">
              {TIMERS.map((m) => (
                <button key={m} onClick={() => setSettings({ timerMin: m })} className={seg(settings.timerMin === m)}>
                  {m ? `${m}m` : "Off"}
                </button>
              ))}
            </div>
          </Field>
          <label className="flex items-center justify-between text-sm">
            <span className="font-medium">Allow hints</span>
            <input type="checkbox" checked={settings.hints} onChange={(e) => setSettings({ hints: e.target.checked })} className="h-5 w-5 accent-[var(--ink)]" />
          </label>
          <Field label="Anything else?">
            <input
              value={settings.instructions}
              maxLength={200}
              onChange={(e) => setSettings({ instructions: e.target.value })}
              placeholder="e.g. only trig integrals, small whole numbers"
              className="h-10 w-full rounded-lg border border-rule bg-paper px-3 text-sm outline-none focus:border-ink"
            />
          </Field>
          <button onClick={() => setSettings({ ...DEFAULT_SETTINGS })} className="text-xs text-ink-soft underline">
            Reset to default
          </button>
        </div>
      )}

      <button onClick={make} disabled={busy || (settings.focus === "topics" && settings.topics.length === 0)} className="mt-3 h-11 w-full rounded-full bg-ink font-medium text-paper disabled:opacity-50">
        {qs ? "Make a new quiz" : `Make ${settings.count} question${settings.count === 1 ? "" : "s"}`}
      </button>
      {settings.focus === "topics" && settings.topics.length === 0 && <p className="mt-1 text-center text-xs text-ink-soft">Pick at least one topic.</p>}
      {busy && <Squiggle className="mt-3" label={status ?? "Writing questions…"} />}
      {error && <p className="mt-3 text-sm text-mark">{error}</p>}

      {qs && !busy && (
        <>
          <ol className="mt-4 space-y-2">
            {qs.map((q, i) => (
              <li key={q.id} className="rounded-xl bg-surface p-3 ring-1 ring-rule">
                <div className="flex items-start gap-2">
                  <div className="flex-1 text-[15px]">
                    <span className="font-semibold">{i + 1}.</span> {replacing === q.id ? <span className="text-ink-soft">Finding another…</span> : <MathText text={q.prompt} />}
                  </div>
                  <button aria-label="Replace this question" title="Replace" disabled={!!replacing} onClick={() => replace(q)} className="h-8 w-8 shrink-0 rounded-full text-ink-soft hover:bg-desk disabled:opacity-40">
                    ↻
                  </button>
                  <button aria-label="Remove this question" title="Remove" onClick={() => setQs(qs.filter((x) => x.id !== q.id))} className="h-8 w-8 shrink-0 rounded-full text-ink-soft hover:bg-desk">
                    <Icon.close size={14} className="mx-auto" />
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] uppercase tracking-wide text-ink-soft">
                  <span>{q.topic.replace(/-/g, " ")}</span>
                  {q.difficulty && <span className="rounded bg-desk px-1.5">{q.difficulty}</span>}
                  {q.style && <span className="rounded bg-desk px-1.5">{STYLES.find((s) => s.id === q.style)?.label ?? q.style}</span>}
                </div>
              </li>
            ))}
          </ol>
          {qs.length > 0 && (
            <button onClick={() => onMakeQuizPage(qs, usedSettings ?? settings)} className="mt-3 h-11 w-full rounded-full border-2 border-ink font-medium">
              {pagesNeeded > 1 ? `Make ${pagesNeeded} quiz pages` : "Make quiz page"}
            </button>
          )}
          <p className="mt-2 text-center text-xs text-ink-soft">
            Answer by hand. Tutor mode grades each answer{(usedSettings ?? settings).timerMin ? `, and the ${(usedSettings ?? settings).timerMin}-minute timer starts on the page` : ""}.
          </p>
        </>
      )}
    </div>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label} {note && <span className="font-normal normal-case">({note})</span>}
      </div>
      {children}
    </div>
  );
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
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
