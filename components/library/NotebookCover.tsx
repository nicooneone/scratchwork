"use client";
// Owner: C. One notebook in the library grid. Tap opens it; long-press (or right-click) opens actions.
import { useRef } from "react";
import type { Notebook } from "@/lib/types";

const LONG_PRESS_MS = 480;

export function NotebookCover({ notebook, pages, onOpen, onActions }: { notebook: Notebook; pages: number; onOpen(): void; onActions(): void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  const start = () => {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      navigator.vibrate?.(10);
      onActions();
    }, LONG_PRESS_MS);
  };
  const cancel = () => clearTimeout(timer.current);

  return (
    <button
      className="chrome group flex w-full flex-col items-center gap-2.5 text-left focus-visible:outline-none"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClick={() => !longPressed.current && onOpen()}
      onContextMenu={(e) => {
        e.preventDefault();
        cancel();
        onActions();
      }}
    >
      <div className="relative w-full">
        {/* page block peeking out behind the cover */}
        <div className="absolute inset-y-[1.5%] -right-[3%] left-[4%] rounded-r-lg bg-paper shadow-[var(--shadow-sm)]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 2px, var(--rule) 2px 3px)" }} />
        <div
          className="cover-3d relative aspect-[1000/1414] w-full overflow-hidden rounded-r-xl rounded-l-[5px] shadow-[0_1px_2px_rgba(29,42,68,.25),0_14px_28px_-12px_rgba(29,42,68,.55)]"
          style={{ background: notebook.cover }}
        >
          {/* light across the board, and a fine cloth grain */}
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.22)_0%,rgba(255,255,255,.04)_38%,rgba(0,0,0,.12)_100%)]" />
          <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 1px, transparent 1px 3px)" }} />
          {/* spine */}
          <div className="absolute inset-y-0 left-0 w-[9%] bg-[linear-gradient(90deg,rgba(0,0,0,.3),rgba(0,0,0,.12))]" />
          <div className="absolute inset-y-0 left-[9%] w-px bg-white/20" />
          {/* label */}
          <div className="absolute inset-x-[17%] top-[16%] cover-label rounded-[3px] px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,.25)]">
            <div className="line-clamp-2 font-hand text-[clamp(18px,2.4vw,26px)] leading-tight">{notebook.title}</div>
            <div className="mt-1 h-[2px] w-8 rounded-full bg-[#c8322b]/80" />
          </div>
          {/* elastic band */}
          <div className="absolute inset-y-0 right-[11%] w-[3.2%] bg-[linear-gradient(90deg,rgba(0,0,0,.35),rgba(0,0,0,.2),rgba(0,0,0,.35))] shadow-[1px_0_0_rgba(255,255,255,.08)]" />
        </div>
      </div>
      <div className="flex w-full items-center justify-between px-1 text-[13px] text-ink-soft">
        <span className="tabular-nums">
          {pages} {pages === 1 ? "page" : "pages"}
        </span>
        <span>{relTime(notebook.updatedAt)}</span>
      </div>
    </button>
  );
}

function relTime(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
