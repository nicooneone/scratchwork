"use client";
// Owner: C (Step 6). Notebook Brain, background indexing:
// when the notebook has been idle for 10 s, every page whose ink changed since its last transcript is
// exported and sent to /api/index, one at a time. Writing again pauses the queue; going offline skips it.
// Ask/Quiz still index on demand (indexing.ts), so nothing breaks if this hasn't caught up.
import { useEffect, useRef } from "react";
import { db } from "@/lib/db";
import { renderToPng, strokesBounds } from "@/lib/ink/export";
import type { Page, PageBrain } from "@/lib/types";
import { isStale } from "./indexing";

const IDLE_MS = 10_000;

export function useBackgroundIndex(pages: Page[], opts: { enabled?: boolean; mock?: boolean; onIndexed(pageId: string, brain: PageBrain): void }) {
  const latest = useRef({ pages, opts });
  const running = useRef(false);
  const generation = useRef(0); // bumps on every change; a running queue stops when it moves

  useEffect(() => {
    latest.current = { pages, opts };
  });

  // Any edit (a stroke, a template) restarts the idle clock. A transcript arriving doesn't count:
  // it doesn't change updatedAt, so the queue keeps going.
  const editKey = pages.map((p) => `${p.id}:${p.updatedAt}`).join("|");
  useEffect(() => {
    generation.current++;
    if (opts.enabled === false) return;
    const t = setTimeout(run, IDLE_MS);
    return () => clearTimeout(t);

    async function run() {
      if (running.current || (typeof navigator !== "undefined" && !navigator.onLine)) return;
      const gen = generation.current;
      running.current = true;
      try {
        const queue = latest.current.pages.filter(isStale).sort((a, b) => b.updatedAt - a.updatedAt);
        for (const page of queue) {
          if (generation.current !== gen) break; // the student started writing again
          const region = strokesBounds(page.strokes);
          if (!region) continue;
          const exportedAt = Date.now();
          const png = await renderToPng(page.strokes, region);
          const res = await fetch(`/api/index${latest.current.opts.mock ? "?mock=1" : ""}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ png }),
          });
          if (res.status === 429) break; // rate limited: try again after the next idle period
          if (!res.ok) continue;
          // indexedAt = when we exported, so edits made while the request was in flight still count as stale.
          const brain: PageBrain = { ...((await res.json()) as PageBrain), indexedAt: exportedAt };
          // Direct update: don't bump page.updatedAt, and don't overwrite strokes written in the meantime.
          await db().pages.update(page.id, { brain });
          latest.current.opts.onIndexed(page.id, brain);
        }
      } catch {
        /* offline or the AI is unavailable: try again next idle period */
      } finally {
        running.current = false;
      }
    }
  }, [editKey, opts.enabled]);
}
