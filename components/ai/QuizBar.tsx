"use client";
// Owner: C. Floating bar on quiz pages: title, timer, live score, show answers, retry what you missed.
import { useEffect, useState } from "react";
import type { QuizMeta, QuizQuestion } from "@/lib/types";

export function QuizBar({
  meta,
  questions,
  onReveal,
  onRetryMissed,
  retrying,
}: {
  meta: QuizMeta;
  questions: QuizQuestion[];
  onReveal(): void;
  onRetryMissed(topics: string[]): void;
  retrying?: boolean;
}) {
  const now = useNow(meta.timerMin > 0 && !meta.revealed);
  const graded = questions.filter((q) => meta.grades[q.id] === "correct" || meta.grades[q.id] === "error");
  const right = questions.filter((q) => meta.grades[q.id] === "correct").length;
  const missedTopics = [...new Set(questions.filter((q) => meta.grades[q.id] === "error").map((q) => q.topic))];

  const left = meta.timerMin > 0 ? Math.max(0, meta.startedAt + meta.timerMin * 60_000 - now) : null;
  const timeUp = left === 0;
  const done = graded.length === questions.length && questions.length > 0;

  return (
    <div data-ui="" className="chrome pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-paper/95 py-1.5 pl-4 pr-1.5 text-sm shadow-md ring-1 ring-rule">
      <span className="truncate font-hand text-xl leading-none">
        {meta.title}
        {meta.parts > 1 ? ` · ${meta.part}/${meta.parts}` : ""}
      </span>
      {left !== null && (
        <span className={`rounded-full px-2.5 py-1 font-semibold tabular-nums ${timeUp ? "bg-mark text-white" : left < 60_000 ? "bg-mark/15 text-mark" : "bg-desk"}`}>
          {timeUp ? "Time's up" : fmt(left)}
        </span>
      )}
      <span className={`rounded-full px-2.5 py-1 font-semibold tabular-nums ${done ? (right === questions.length ? "bg-ok text-white" : "bg-desk") : "bg-desk"}`} title="Correct so far">
        {right}/{questions.length}
      </span>
      {!meta.revealed && (graded.length > 0 || timeUp) && (
        <button onClick={onReveal} className="h-8 rounded-full border border-rule px-3 font-medium">
          Show answers
        </button>
      )}
      {missedTopics.length > 0 && (
        <button onClick={() => onRetryMissed(missedTopics)} disabled={retrying} className="h-8 rounded-full bg-ink px-3 font-medium text-paper disabled:opacity-50">
          {retrying ? "Making…" : "Retry missed"}
        </button>
      )}
    </div>
  );
}

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ticking]);
  return now;
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
