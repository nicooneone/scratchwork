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
      className="chrome group flex flex-col items-center gap-2 text-left"
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
      <div
        className="relative aspect-[1000/1414] w-full overflow-hidden rounded-r-xl rounded-l-sm shadow-[0_2px_6px_rgba(29,42,68,.25),0_10px_24px_-12px_rgba(29,42,68,.45)] transition-transform duration-150 group-active:scale-[0.97]"
        style={{ background: notebook.cover }}
      >
        {/* spine */}
        <div className="absolute inset-y-0 left-0 w-[9%] bg-black/20" />
        <div className="absolute inset-y-0 left-[9%] w-px bg-white/15" />
        {/* label */}
        <div className="absolute inset-x-[16%] top-[18%] rounded-sm bg-paper/95 px-2 py-2 shadow-sm">
          <div className="line-clamp-2 font-hand text-[clamp(18px,2.4vw,26px)] leading-tight text-ink">{notebook.title}</div>
        </div>
        {/* elastic band */}
        <div className="absolute inset-y-0 right-[12%] w-[3%] bg-black/25" />
      </div>
      <div className="w-full px-1 text-xs text-ink-soft">
        {pages} {pages === 1 ? "page" : "pages"} · {relTime(notebook.updatedAt)}
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
