"use client";
// Owner: C. Collapsible left rail: page thumbnails, add page, paper template for the current page.
import { useState } from "react";
import { TEMPLATES, templateStyle } from "@/lib/ink/templates";
import type { Page, TemplateId } from "@/lib/types";
import { Icon } from "@/components/ui/icons";
import { PageThumb } from "./PageThumb";

export function PageRail({
  pages,
  currentId,
  onSelect,
  onAdd,
  onTemplate,
}: {
  pages: Page[];
  currentId: string;
  onSelect(id: string): void;
  onAdd(template: TemplateId): void;
  onTemplate(template: TemplateId): void;
}) {
  const [picker, setPicker] = useState<"add" | "paper" | null>(null);
  const current = pages.find((p) => p.id === currentId);

  return (
    <aside data-tour="pages" className="chrome relative flex w-[132px] shrink-0 flex-col border-r border-rule bg-desk/70">
      <div className="scroll-y flex-1 space-y-3 px-3 py-3">
        {pages.map((p, i) => (
          <button key={p.id} onClick={() => onSelect(p.id)} className="block w-full text-center" aria-current={p.id === currentId}>
            {/* Selected page: a soft tinted frame, so the thumbnails never outshout the page itself. */}
            <div className={`rounded-[6px] p-[3px] transition-colors ${p.id === currentId ? "bg-ink/15" : "bg-transparent"}`}>
              <PageThumb page={p} />
            </div>
            <span className={`mt-1 inline-flex items-center gap-1 text-xs tabular-nums ${p.id === currentId ? "font-semibold text-ink" : "text-ink-soft"}`}>
              {i + 1}
              {p.quiz?.length ? <span className="rounded bg-mark/10 px-1 text-[10px] font-semibold text-mark">QUIZ</span> : null}
              {p.brain && p.brain.indexedAt >= p.updatedAt ? <span className="h-1.5 w-1.5 rounded-full bg-ok" title="Indexed for Ask" /> : null}
            </span>
          </button>
        ))}
      </div>
      <div className="flex gap-1 border-t border-rule p-2">
        <button onClick={() => setPicker(picker === "add" ? null : "add")} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-paper text-sm font-medium shadow-sm">
          <Icon.plus size={18} /> Page
        </button>
        <button onClick={() => setPicker(picker === "paper" ? null : "paper")} aria-label="Paper for this page" className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper shadow-sm">
          <Icon.pages size={18} />
        </button>
      </div>

      {picker && (
        <div className="absolute bottom-14 left-2 z-30 w-[260px] rounded-xl bg-paper p-3 shadow-xl ring-1 ring-rule animate-[sheet-in_.15s_ease-out]">
          <div className="mb-2 text-xs font-medium text-ink-soft">{picker === "add" ? "New page" : "Paper for this page"}</div>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (picker === "add") onAdd(t.id);
                  else onTemplate(t.id);
                  setPicker(null);
                }}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`aspect-[1000/1414] w-full rounded-sm bg-paper shadow-sm ${picker === "paper" && current?.template === t.id ? "outline-2 outline-ink" : "outline outline-rule"}`}
                  style={{ ["--u" as string]: "0.07px", ...templateStyle(t.id) }}
                />
                <span className="text-[11px] text-ink-soft">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
