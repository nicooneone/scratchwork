// Owner: D. POST IndexRequest → PageBrain: transcript, one-line summary, topics.
import { brain } from "@/fixtures";
import { generateJson, png } from "@/lib/ai/gemini";
import { INDEX_SCHEMA, INDEX_SYSTEM } from "@/lib/ai/prompts";
import { aiUnavailable, badRequest, kebab, MAX_PNG_BASE64, wantsMock } from "@/lib/ai/respond";
import type { IndexRequest, PageBrain } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (wantsMock(request)) return Response.json({ ...brain, indexedAt: Date.now() });
  const body = (await request.json().catch(() => null)) as IndexRequest | null;
  if (!body?.png) return badRequest("Send { png }.");
  if (body.png.length > MAX_PNG_BASE64) return badRequest("Image too large. Export at most 1600 px.");
  try {
    const { data } = await generateJson<Omit<PageBrain, "indexedAt">>({
      system: INDEX_SYSTEM,
      parts: [png(body.png), { text: "Transcribe and summarize this notebook page." }],
      schema: INDEX_SCHEMA,
      thinking: "minimal",
    });
    const topics = [...new Set((data.topics ?? []).map(kebab).filter((t): t is string => !!t))].slice(0, 5);
    const result: PageBrain = { transcript: data.transcript ?? "", summary: data.summary ?? "", topics, indexedAt: Date.now() };
    return Response.json(result);
  } catch (err) {
    return aiUnavailable(err);
  }
}
