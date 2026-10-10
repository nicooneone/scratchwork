// Owner: D. POST QuizRequest → QuizQuestion[]: 5 questions aimed at the weakest topics.
import { quiz } from "@/fixtures";
import { generateJson } from "@/lib/ai/gemini";
import { QUIZ_SCHEMA, QUIZ_SYSTEM } from "@/lib/ai/prompts";
import { aiUnavailable, badRequest, kebab, wantsMock } from "@/lib/ai/respond";
import { verifyQuizAnswer, type QuizCheckInput } from "@/lib/ai/quizCheck";
import { uid } from "@/lib/ids";
import type { QuizQuestion, QuizRequest } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (wantsMock(request)) return Response.json(quiz);
  const body = (await request.json().catch(() => null)) as QuizRequest | null;
  if (!body?.pages?.length) return badRequest("Send { pages, mastery } with at least one indexed page.");

  const notebook = body.pages.map((p) => `<page id="${p.id}" label="${p.label}">\n${p.transcript}\n</page>`).join("\n\n");
  const mastery = (body.mastery ?? [])
    .slice()
    .sort((a, b) => a.pKnown - b.pKnown)
    .map((m) => `- ${m.topic}: pKnown ${m.pKnown.toFixed(2)} after ${m.attempts} attempts`)
    .join("\n") || "No mastery data yet: pick the topics that look hardest in the notes.";

  try {
    const { data } = await generateJson<{ questions: (Omit<QuizQuestion, "id"> & QuizCheckInput)[] }>({
      system: QUIZ_SYSTEM,
      parts: [{ text: `NOTEBOOK PAGES:\n${notebook}\n\nMASTERY (weakest first):\n${mastery}` }],
      schema: QUIZ_SCHEMA,
      thinking: "medium",
      temperature: 0.7,
      timeoutMs: 25_000,
    });
    const known = new Set(body.pages.map((p) => p.id));
    // Drop any question whose answer key is provably wrong.
    const questions: QuizQuestion[] = (data.questions ?? [])
      .filter((q) => {
        const ok = verifyQuizAnswer(q);
        if (ok === false) console.warn("[quiz] dropped wrong answer key:", q.prompt, "→", q.answer);
        return ok !== false;
      })
      .slice(0, 5)
      .map(({ prompt, topic, answer, answerKind, sourcePageIds }) => ({
        id: uid(),
        prompt,
        topic: kebab(topic) ?? "practice",
        answer,
        answerKind,
        sourcePageIds: (sourcePageIds ?? []).filter((id) => known.has(id)),
      }));
    return Response.json(questions);
  } catch (err) {
    return aiUnavailable(err);
  }
}
