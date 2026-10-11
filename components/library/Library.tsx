"use client";
// Owner: C. The notebook library: covers grid, new notebook, rename/delete.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createNotebook, deleteNotebook, listNotebooks, pageCounts, renameNotebook } from "@/lib/db";
import { TEMPLATES } from "@/lib/ink/templates";
import { templateStyle } from "@/lib/ink/templates";
import type { Notebook, TemplateId } from "@/lib/types";
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Tour } from "@/components/tour/Tour";
import { libraryTour, markTour, resetNotebookTour, tourDone } from "@/components/tour/tours";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { COVERS } from "./covers";
import { NotebookCover } from "./NotebookCover";

export default function Library() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [touring, setTouring] = useState(false);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<Notebook | null>(null);

  const load = useCallback(async () => {
    const [nbs, c] = await Promise.all([listNotebooks(), pageCounts()]);
    setNotebooks(nbs);
    setCounts(c);
  }, []);

  useEffect(() => {
    Promise.all([listNotebooks(), pageCounts()]).then(([nbs, c]) => {
      setNotebooks(nbs);
      setCounts(c);
    });
    // Ask the browser not to evict our notebooks under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
    // First visit on this device: welcome tour (async so it isn't a sync setState in the effect).
    const t = setTimeout(() => !tourDone("library") && setTouring(true), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="chrome mx-auto min-h-[100dvh] max-w-6xl px-5 pb-16 pt-[max(env(safe-area-inset-top),24px)] sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5 pb-10 pt-8">
        <div>
          <Wordmark />
          <p className="mt-6 max-w-md text-[15px] text-ink-soft">The notebook that checks your thinking, not just your answer.</p>
        </div>
        <div className="glass flex shrink-0 items-center gap-1 rounded-full p-1.5">
          <button onClick={() => setTouring(true)} className="press h-10 rounded-full px-4 text-sm font-medium text-ink-soft hover:text-ink">
            Take the tour
          </button>
          <ThemeToggle className="press !h-10 !w-10 !rounded-full" />
          <button data-tour="new-notebook" onClick={() => setCreating(true)} className="press btn-ink flex h-10 shrink-0 items-center gap-2 rounded-full pl-3.5 pr-5 text-[15px] font-medium">
            <Icon.plus size={18} /> New notebook
          </button>
        </div>
      </header>

      {notebooks === null ? null : notebooks.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold">Your notebooks</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-7 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {notebooks.map((nb, i) => (
              <div key={nb.id} className="animate-[rise-in_.45s_cubic-bezier(.2,.8,.2,1)_both]" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <NotebookCover notebook={nb} pages={counts[nb.id] ?? 0} onOpen={() => router.push(`/notebook/${nb.id}`)} onActions={() => setActing(nb)} />
              </div>
            ))}
            <NewTile onClick={() => setCreating(true)} />
          </div>
        </>
      )}

      <NewNotebookSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (title, cover, template) => {
          const nb = await createNotebook(title, cover, template);
          setCreating(false);
          router.push(`/notebook/${nb.id}`);
        }}
      />
      {touring && (
        <Tour
          steps={libraryTour((notebooks?.length ?? 0) > 0)}
          onFinish={() => {
            markTour("library");
            setTouring(false);
            // Replaying from the library should also replay the notebook tour next time one opens.
            resetNotebookTour();
          }}
          onSkip={() => {
            markTour("all");
            setTouring(false);
          }}
        />
      )}
      {acting && <ActionsSheet key={acting.id} notebook={acting} onClose={() => setActing(null)} onChanged={load} />}
    </main>
  );
}

/** "RedLine" in the student's hand, underlined once by the tutor's red pen. */
function Wordmark() {
  return (
    <h1 className="relative inline-block font-hand text-[64px] leading-[0.9] tracking-tight sm:text-[76px]">
      RedLine
      <svg className="pointer-events-none absolute -bottom-3 left-[-2%] h-5 w-[104%] overflow-visible" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden>
        <path className="wordmark-stroke" d="M4 12 C 60 6, 140 15, 210 9 S 280 7, 296 4" fill="none" stroke="var(--mark)" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </h1>
  );
}

/** The last tile in the grid: a blank page waiting to become a notebook. */
function NewTile({ onClick }: { onClick(): void }) {
  return (
    <button onClick={onClick} className="press group flex flex-col gap-2 text-left">
      <div className="flex aspect-[1000/1414] w-full flex-col items-center justify-center gap-2 rounded-r-xl rounded-l-sm border-2 border-dashed border-ink/15 text-ink-soft transition-colors group-hover:border-ink/30 group-hover:text-ink">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-sm)]">
          <Icon.plus size={22} />
        </span>
        <span className="text-sm font-medium">New notebook</span>
      </div>
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate(): void }) {
  return (
    <div className="mx-auto mt-6 flex max-w-sm flex-col items-center text-center">
      <div className="relative mb-7 w-44">
        <div className="absolute inset-0 translate-x-3 translate-y-2 rotate-6 rounded-sm bg-paper shadow-[var(--shadow-md)]" />
        <div className="relative aspect-[1000/1414] w-full -rotate-2 rounded-sm bg-paper shadow-[var(--shadow-lg)]" style={templateStyle("grid")}>
          <svg viewBox="0 0 100 141" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d="M18 42 C 34 40, 52 43, 76 41" fill="none" stroke="var(--mark)" strokeWidth="1.6" strokeLinecap="round" className="draw-in" style={{ ["--len" as string]: 70 }} />
          </svg>
        </div>
      </div>
      <p className="text-xl font-semibold">Start your first notebook</p>
      <p className="mt-1.5 text-ink-soft">Write math with the Pencil and pause. RedLine checks each line and underlines the first one that goes wrong.</p>
      <button onClick={onCreate} className="press btn-ink mt-6 h-12 rounded-full px-7 font-medium">
        Create a notebook
      </button>
    </div>
  );
}

function NewNotebookSheet({ open, onClose, onCreate }: { open: boolean; onClose(): void; onCreate(title: string, cover: string, template: TemplateId): void }) {
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState<string>(COVERS[0]);
  const [template, setTemplate] = useState<TemplateId>("grid");
  const close = () => {
    setTitle("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="New notebook">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(title.trim() || "Untitled", cover, template);
          setTitle("");
        }}
        className="flex flex-col gap-5"
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Calc 1"
          className="h-12 rounded-xl border border-rule bg-surface px-4 text-lg outline-none transition-shadow focus:border-ink/40 focus:shadow-[0_0_0_4px_var(--glass-edge)]"
        />
        <fieldset>
          <legend className="mb-2 text-sm text-ink-soft">Cover</legend>
          <div className="flex gap-3">
            {COVERS.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={`Cover ${c}`}
                onClick={() => setCover(c)}
                className={`press h-11 w-11 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.2),var(--shadow-sm)] ring-offset-[3px] ring-offset-paper ${cover === c ? "ring-2 ring-ink" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm text-ink-soft">Paper</legend>
          <div className="grid grid-cols-6 gap-2">
            {TEMPLATES.map((t) => (
              <button type="button" key={t.id} onClick={() => setTemplate(t.id)} className="flex flex-col items-center gap-1">
                <span
                  className={`aspect-[1000/1414] w-full rounded-sm bg-paper shadow-sm ${template === t.id ? "outline-2 outline-ink" : "outline outline-rule"}`}
                  style={{ ["--u" as string]: "0.05px", ...templateStyle(t.id) }}
                />
                <span className="text-[11px] text-ink-soft">{t.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="press h-11 rounded-full px-5 font-medium text-ink-soft hover:text-ink">
            Cancel
          </button>
          <button type="submit" className="press btn-ink h-11 rounded-full px-6 font-medium">
            Create
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function ActionsSheet({ notebook, onClose, onChanged }: { notebook: Notebook; onClose(): void; onChanged(): void }) {
  const [title, setTitle] = useState(notebook.title);
  const [confirming, setConfirming] = useState(false);

  return (
    <Sheet open onClose={onClose} title={notebook.title}>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await renameNotebook(notebook.id, title.trim() || notebook.title);
          onChanged();
          onClose();
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-rule bg-surface px-3 outline-none focus:border-ink/40 focus:shadow-[0_0_0_4px_var(--glass-edge)]" />
        <button className="press btn-ink h-11 rounded-full px-5 font-medium">Rename</button>
      </form>
      <button
        onClick={async () => {
          if (!confirming) return setConfirming(true);
          await deleteNotebook(notebook.id);
          onChanged();
          onClose();
        }}
        className={`press mt-4 h-11 w-full rounded-full font-medium ${confirming ? "bg-mark text-white" : "bg-mark/10 text-mark"}`}
      >
        {confirming ? "Tap again to delete forever" : "Delete notebook"}
      </button>
    </Sheet>
  );
}
