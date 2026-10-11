// Owner: D. POST QuizRequest → QuizQuestion[]: questions shaped by QuizSettings (count, difficulty,
// focus, topics, styles, notebooks, extra instructions). No settings = 5 standard questions on weak spots.
import { quiz } from "@/fixtures";
import { generateJson } from "@/lib/ai/gemini";
import { QUIZ_SCHEMA, QUIZ_SYSTEM, quizSettingsText } from "@/lib/ai/prompts";
import { aiUnavailable, badRequest, kebab, wantsMock } from "@/lib/ai/respond";
import { verifyQuizAnswer, type QuizCheckInput } from "@/lib/ai/quizCheck";
import { uid } from "@/lib/ids";
import type { QuizQuestion, QuizRequest } from "@/lib/types";
import { repairLatexEscapes } from "@/lib/math/tex";

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

  type Raw = Omit<QuizQuestion, "id"> & QuizCheckInput;
  const known = new Set(body.pages.map((p) => p.id));
  const started = Date.now();

  /** Ask Gemini for `n` questions; keep only ones whose answer key isn't provably wrong. */
  const ask = async (n: number, exclude: string[], timeoutMs: number): Promise<Raw[]> => {
    const settings = { ...body.settings, count: n } as QuizRequest["settings"];
    const { data } = await generateJson<{ questions: Raw[] }>({
      system: QUIZ_SYSTEM,
      parts: [{ text: `NOTEBOOK PAGES:\n${notebook}\n\nMASTERY (weakest first):\n${mastery}\n\nQUIZ SETTINGS:\n${quizSettingsText(settings, exclude)}` }],
      schema: QUIZ_SCHEMA,
      thinking: "medium",
      temperature: 0.7,
      timeoutMs,
    });
    return (data.questions ?? [])
      .map((q) => ({ ...q, prompt: repairLatexEscapes(q.prompt ?? ""), hint: q.hint ? repairLatexEscapes(q.hint) : q.hint }))
      .filter((q) => {
        const ok = verifyQuizAnswer(q);
        if (ok === false) console.warn("[quiz] dropped wrong answer key:", q.prompt, "→", q.answer);
        return ok !== false && !!q.prompt && !!q.answer;
      });
  };

  /** Same math = same question, even if the wording differs ("Evaluate …" vs "Find …"). */
  const sameKey = (q: Raw) => {
    const math = [...q.prompt.matchAll(/\$([^$]+)\$/g)].map((m) => m[1].replace(/\s+/g, "")).join("|");
    return math || q.prompt.toLowerCase().replace(/[^a-z0-9]/g, "");
  };
  const addUnique = (into: Raw[], more: Raw[]) => {
    const seen = new Set(into.map(sameKey));
    for (const q of more) {
      const key = sameKey(q);
      if (seen.has(key)) continue;
      seen.add(key);
      into.push(q);
    }
  };

  try {
    const picked: Raw[] = [];
    addUnique(picked, await ask(count, body.exclude ?? [], 25_000));
    // Dropped wrong keys or duplicates left the quiz short: ask once more for the missing ones,
    // if there's time left in this request (Vercel stops it at 30 s).
    const missing = count - picked.length;
    const left = 27_000 - (Date.now() - started);
    if (missing > 0 && left > 6_000) {
      try {
        addUnique(picked, await ask(missing + 1, [...(body.exclude ?? []), ...picked.map((q) => q.prompt)], left - 1_000));
      } catch {
        /* keep what we have */
      }
    }
    const questions: QuizQuestion[] = picked
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
