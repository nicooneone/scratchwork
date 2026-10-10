// Owner: C (Step 6 will move this to background indexing). Index pages on demand before Ask/Quiz:
// any page with ink whose transcript is missing or older than its last edit is sent to /api/index.
// The brain is written with a direct update so page.updatedAt stays put (indexedAt >= updatedAt = fresh).
import { db } from "@/lib/db";
import { renderToPng, strokesBounds } from "@/lib/ink/export";
import type { Notebook, Page, PageBrain, PageContext } from "@/lib/types";

const MAX_PER_RUN = 8; // free-tier friendly; most recently edited first

export const isStale = (p: Page) => p.strokes.length > 0 && (!p.brain || p.brain.indexedAt < p.updatedAt);

export async function indexStalePages(pages: Page[], opts: { mock?: boolean; onProgress?(done: number, total: number): void } = {}): Promise<Page[]> {
  const todo = pages.filter(isStale).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_PER_RUN);
  const updated: Page[] = [];
  for (const [i, p] of todo.entries()) {
    opts.onProgress?.(i, todo.length);
    const region = strokesBounds(p.strokes);
    if (!region) continue;
    try {
      const png = await renderToPng(p.strokes, region);
      const res = await fetch(`/api/index${opts.mock ? "?mock=1" : ""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ png }) });
      if (!res.ok) continue;
      const brain = { ...((await res.json()) as PageBrain), indexedAt: Date.now() };
      await db().pages.update(p.id, { brain });
      updated.push({ ...p, brain });
    } catch {
      /* skip this page; Ask still works with the rest */
    }
  }
  opts.onProgress?.(todo.length, todo.length);
  return updated;
}

/** Every page in every notebook, with its "Calc 1 · p4" label. */
export async function loadAllPages(): Promise<{ pages: Page[]; notebooks: Map<string, Notebook> }> {
  const [nbs, pages] = await Promise.all([db().notebooks.toArray(), db().pages.toArray()]);
  return { pages, notebooks: new Map(nbs.map((n) => [n.id, n])) };
}

export function pageLabel(p: Page, notebooks: Map<string, Notebook>): string {
  return `${notebooks.get(p.notebookId)?.title ?? "Notebook"} · p${p.index + 1}`;
}

export function toContexts(pages: Page[], notebooks: Map<string, Notebook>): PageContext[] {
  return pages.filter((p) => p.brain?.transcript).map((p) => ({ id: p.id, label: pageLabel(p, notebooks), transcript: p.brain!.transcript }));
}
