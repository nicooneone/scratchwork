// On-device storage (IndexedDB via Dexie). Owned by A. Append-only after Step 0.
// Everything lives in the browser; IndexedDB is per-origin, so localhost, the
// vercel.app URL and the .tech domain each have their own separate notebooks.
import Dexie, { type EntityTable } from "dexie";
import type { Notebook, Page, StruggleEvent, TemplateId } from "./types";
import { uid } from "./ids";

class RedLineDB extends Dexie {
  notebooks!: EntityTable<Notebook, "id">;
  pages!: EntityTable<Page, "id">;
  struggles!: EntityTable<StruggleEvent, "key">;

  constructor() {
    super("scratchwork"); // database name kept from the old app name: renaming it would lose saved notebooks
    this.version(1).stores({
      notebooks: "id, updatedAt",
      pages: "id, notebookId, [notebookId+index]",
      struggles: "key, topic, pageId, at",
    });
  }
}

let instance: RedLineDB | null = null;

/** Lazily open the database (only in the browser — never call during server rendering). */
export function db(): RedLineDB {
  if (!instance) instance = new RedLineDB();
  return instance;
}

export async function listNotebooks(): Promise<Notebook[]> {
  return db().notebooks.orderBy("updatedAt").reverse().toArray();
}

export async function createNotebook(title: string, cover: string, template: TemplateId = "lined"): Promise<Notebook> {
  const now = Date.now();
  const notebook: Notebook = { id: uid(), title, cover, createdAt: now, updatedAt: now };
  await db().transaction("rw", db().notebooks, db().pages, async () => {
    await db().notebooks.add(notebook);
    await db().pages.add({ id: uid(), notebookId: notebook.id, index: 0, template, strokes: [], updatedAt: now });
  });
  return notebook;
}

export async function getPages(notebookId: string): Promise<Page[]> {
  return db().pages.where("[notebookId+index]").between([notebookId, Dexie.minKey], [notebookId, Dexie.maxKey]).toArray();
}

export async function addPage(notebookId: string, template: TemplateId): Promise<Page> {
  const count = await db().pages.where("notebookId").equals(notebookId).count();
  const page: Page = { id: uid(), notebookId, index: count, template, strokes: [], updatedAt: Date.now() };
  await db().pages.add(page);
  return page;
}

export async function savePage(page: Page): Promise<void> {
  const now = Date.now();
  await db().transaction("rw", db().pages, db().notebooks, async () => {
    await db().pages.put({ ...page, updatedAt: now });
    await db().notebooks.update(page.notebookId, { updatedAt: now });
  });
}

/** Insert or replace by `key`, so re-checking the same line never double-counts. */
export async function logStruggle(event: StruggleEvent): Promise<void> {
  await db().struggles.put(event);
}

export async function allStruggles(): Promise<StruggleEvent[]> {
  return db().struggles.orderBy("at").toArray();
}

// ---- Appended in Step 3 (library + notebook view) ----

export async function getNotebook(id: string): Promise<Notebook | undefined> {
  return db().notebooks.get(id);
}

export async function renameNotebook(id: string, title: string): Promise<void> {
  await db().notebooks.update(id, { title, updatedAt: Date.now() });
}

/** Deletes the notebook and all its pages. */
export async function deleteNotebook(id: string): Promise<void> {
  await db().transaction("rw", db().notebooks, db().pages, async () => {
    await db().pages.where("notebookId").equals(id).delete();
    await db().notebooks.delete(id);
  });
}

export async function allPages(): Promise<Page[]> {
  return db().pages.toArray();
}

export async function pageCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db().pages.each((p) => {
    counts[p.notebookId] = (counts[p.notebookId] ?? 0) + 1;
  });
  return counts;
}
