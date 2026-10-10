// Owner: D. POST AskRequest → AskResponse. Long-context Q&A over every page transcript,
// with [[page-id]] citations the UI turns into tappable chips.
import { ask } from "@/fixtures";
import { generateJson, png, type Part } from "@/lib/ai/gemini";
import { ASK_SCHEMA, ASK_SYSTEM } from "@/lib/ai/prompts";
import { aiUnavailable, badRequest, MAX_PNG_BASE64, wantsMock } from "@/lib/ai/respond";
import type { AskRequest, AskResponse, StruggleEvent } from "@/lib/types";

export const maxDuration = 30;

/** Compact per-topic summary of the struggle log, so the prompt stays small. */
function summarizeStruggles(events: StruggleEvent[]): string {
  if (!events.length) return "No struggles logged yet.";
  const byTopic = new Map<string, { right: number; wrong: number; mistakes: Set<string>; pages: Set<string> }>();
  for (const e of events) {
    const t = byTopic.get(e.topic) ?? { right: 0, wrong: 0, mistakes: new Set(), pages: new Set() };
    if (e.correct) t.right++;
    else {
      t.wrong++;
      if (e.misconception) t.mistakes.add(e.misconception);
      t.pages.add(e.pageId);
    }
    byTopic.set(e.topic, t);
  }
  return [...byTopic]
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .map(([topic, t]) => `- ${topic}: ${t.wrong} wrong, ${t.right} right; mistakes: ${[...t.mistakes].join(", ") || "none"}; wrong on pages: ${[...t.pages].join(", ") || "none"}`)
    .join("\n");
}

export async function POST(request: Request) {
  if (wantsMock(request)) return Response.json(ask);
  const body = (await request.json().catch(() => null)) as AskRequest | null;
  if (!body?.question?.trim()) return badRequest("Send { question, pages, struggles }.");
  if (body.snippetPng && body.snippetPng.length > MAX_PNG_BASE64) return badRequest("Selection image too large.");

  const pages = body.pages ?? [];
  const notebook = pages.map((p) => `<page id="${p.id}" label="${p.label}">\n${p.transcript}\n</page>`).join("\n\n") || "(no pages indexed yet)";
  const parts: Part[] = [
    { text: `NOTEBOOK PAGES:\n${notebook}\n\nSTRUGGLES:\n${summarizeStruggles(body.struggles ?? [])}` },
  ];
  if (body.snippetPng) parts.push({ text: "The student selected this region with the lasso:" }, png(body.snippetPng));
  parts.push({ text: `QUESTION: ${body.question.trim()}` });

  try {
    const { data } = await generateJson<AskResponse>({ system: ASK_SYSTEM, parts, schema: ASK_SCHEMA, thinking: "low", temperature: 0.3 });
    const known = new Set(pages.map((p) => p.id));
    // Trust only ids that really exist; drop invented citation markers from the text.
    const answer = (data.answer ?? "").replace(/\[\[([^\]]+)\]\]/g, (m, id: string) => (known.has(id.trim()) ? `[[${id.trim()}]]` : ""));
    const cited = [...answer.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
    const citations = [...new Set([...cited, ...(data.citations ?? []).filter((id) => known.has(id))])];
    return Response.json({ answer: answer.trim(), citations } satisfies AskResponse);
  } catch (err) {
    return aiUnavailable(err);
  }
}
