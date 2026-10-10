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
import { COVERS } from "./covers";
import { NotebookCover } from "./NotebookCover";

export default function Library() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
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
  }, []);

  return (
    <main className="chrome mx-auto min-h-[100dvh] max-w-6xl px-5 pb-16 pt-[max(env(safe-area-inset-top),24px)] sm:px-8">
      <header className="flex items-end justify-between gap-4 py-6">
        <div>
          <h1 className="font-hand text-5xl leading-none sm:text-6xl">
            Red<span className="text-mark">Line</span>
          </h1>
          <p className="mt-2 text-ink-soft">The notebook that checks your thinking, not just your answer.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper shadow-md active:scale-95">
          <Icon.plus size={20} /> New notebook
        </button>
      </header>

      {notebooks === null ? null : notebooks.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {notebooks.map((nb) => (
            <NotebookCover key={nb.id} notebook={nb} pages={counts[nb.id] ?? 0} onOpen={() => router.push(`/notebook/${nb.id}`)} onActions={() => setActing(nb)} />
          ))}
        </div>
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
      {acting && <ActionsSheet key={acting.id} notebook={acting} onClose={() => setActing(null)} onChanged={load} />}
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate(): void }) {
  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center text-center">
      <div className="mb-5 aspect-[1000/1414] w-40 rounded-sm bg-paper shadow-md" style={templateStyle("grid")} />
      <p className="font-hand text-2xl">No notebooks yet</p>
      <p className="mt-1 text-ink-soft">Make one, write some math with the Pencil, and pause. RedLine checks each line.</p>
      <button onClick={onCreate} className="mt-5 h-11 rounded-full bg-ink px-6 font-medium text-paper">
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
          className="h-12 rounded-lg border border-rule bg-white px-3 text-lg outline-none focus:border-ink"
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
                className={`h-11 w-11 rounded-full ring-offset-2 ring-offset-paper ${cover === c ? "ring-2 ring-ink" : ""}`}
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
                  className={`aspect-[1000/1414] w-full rounded-sm bg-white shadow-sm ${template === t.id ? "outline-2 outline-ink" : "outline outline-rule"}`}
                  style={{ ["--u" as string]: "0.05px", ...templateStyle(t.id) }}
                />
                <span className="text-[11px] text-ink-soft">{t.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="h-11 rounded-full px-5 text-ink-soft">
            Cancel
          </button>
          <button type="submit" className="h-11 rounded-full bg-ink px-6 font-medium text-paper">
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-rule bg-white px-3 outline-none focus:border-ink" />
        <button className="h-11 rounded-full bg-ink px-5 font-medium text-paper">Rename</button>
      </form>
      <button
        onClick={async () => {
          if (!confirming) return setConfirming(true);
          await deleteNotebook(notebook.id);
          onChanged();
          onClose();
        }}
        className="mt-4 h-11 w-full rounded-full border border-mark/40 font-medium text-mark"
      >
        {confirming ? "Tap again to delete forever" : "Delete notebook"}
      </button>
    </Sheet>
  );
}
