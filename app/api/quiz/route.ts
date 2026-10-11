// Owner: D. POST QuizRequest → QuizQuestion[]: questions shaped by QuizSettings (count, difficulty,
// focus, topics, styles, notebooks, extra instructions). No settings = 5 standard questions on weak spots.
import { quiz } from "@/fixtures";
import { generateJson } from "@/lib/ai/gemini";
import { QUIZ_SCHEMA, QUIZ_SYSTEM, quizSettingsText } from "@/lib/ai/prompts";
import { aiUnavailable, badRequest, kebab, wantsMock } from "@/lib/ai/respond";
import { verifyQuizAnswer, type QuizCheckInput } from "@/lib/ai/quizCheck";
import { uid } from "@/lib/ids";
import type { QuizQuestion, QuizRequest } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as QuizRequest | null;
  const count = Math.max(1, Math.min(10, Math.round(body?.settings?.count ?? 5)));
  if (wantsMock(request)) {
    // Sample mode: cycle the fixture so every count works, with sample hints.
    const out = Array.from({ length: count }, (_, i) => {
      const q = quiz[i % quiz.length];
      return { ...q, id: `${q.id}-${i}-${Date.now()}`, difficulty: body?.settings?.difficulty ?? "standard", hint: q.hint ?? "Start by writing down what the first step should be." };
    });
    return Response.json(out);
  }
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
      parts: [{ text: `NOTEBOOK PAGES:\n${notebook}\n\nMASTERY (weakest first):\n${mastery}\n\nQUIZ SETTINGS:\n${quizSettingsText(body.settings, body.exclude)}` }],
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
      .slice(0, count)
      .map(({ prompt, topic, answer, answerKind, sourcePageIds, difficulty, style, hint }) => ({
        id: uid(),
        prompt,
        topic: kebab(topic) ?? "practice",
        answer,
        answerKind,
        sourcePageIds: (sourcePageIds ?? []).filter((id) => known.has(id)),
        difficulty,
        style,
        // A hint that gives the answer away is dropped.
        hint: hint && !leaksAnswer(hint, answer) ? hint : undefined,
      }));
    return Response.json(questions);
  } catch (err) {
    return aiUnavailable(err);
  }
}

/** True when the hint contains the answer (ignoring spaces and "x ="). */
function leaksAnswer(hint: string, answer: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/\s+|\*/g, "");
  const a = norm(answer).replace(/^[a-z]=/, "");
  return a.length >= 2 && norm(hint).includes(a);
}
