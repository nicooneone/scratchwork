"use client";
// Owner: A. Test bench for the ink engine before C's toolbar lands (Step 1).
import { useState } from "react";
import PageCanvas from "@/components/canvas/PageCanvas";
import { TEMPLATES } from "@/lib/ink/templates";
import type { Page, ToolState } from "@/lib/types";

const blankPage: Page = { id: "dev", notebookId: "dev", index: 0, template: "grid", strokes: [], updatedAt: 0 };

export default function DevCanvas() {
  const [page, setPage] = useState<Page>(blankPage);
  const [toolState] = useState<ToolState>({ tool: "pen", color: "#1d2a44", size: 4, drawWithFinger: false, tutorMode: false });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setPage((p) => ({ ...p, template: t.id }))}
            className={`rounded-md border px-3 py-1.5 ${page.template === t.id ? "border-ink bg-ink text-paper" : "border-rule bg-paper"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PageCanvas page={page} toolState={toolState} onChange={(strokes) => setPage((p) => ({ ...p, strokes }))} />
    </main>
  );
}
