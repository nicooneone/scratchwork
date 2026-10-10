// Owner: D. POST HintRequest → HintResponse: a Socratic hint that never gives the answer away.
import { generateJson } from "@/lib/ai/gemini";
import { CANNED_HINTS, HINT_SCHEMA, HINT_SYSTEM } from "@/lib/ai/prompts";
import { badRequest, wantsMock } from "@/lib/ai/respond";
import type { CheckedLine, HintRequest, HintResponse } from "@/lib/types";

export const maxDuration = 30;

/** Normalize math and its spoken form so "x equals negative 10" matches "x = -10". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/−/g, "-")
    .replace(/\bequals\b|\bis equal to\b/g, "=")
    .replace(/\bnegative\b|\bminus\b/g, "-")
    .replace(/\bplus\b/g, "+")
    .replace(/\bsquared\b/g, "^2")
    .replace(/\btimes\b|\*/g, "")
    .replace(/[\s.,!?]/g, "");
}

/** Does the hint reveal the corrected line (or its right-hand side)? */
function leaks(hint: string, corrected: string): boolean {
  const h = normalize(hint);
  const c = normalize(corrected);
  if (c.length >= 4 && h.includes(c)) return true;
  const rhs = c.split("=").pop() ?? "";
  return c.includes("=") && rhs.length >= 3 && h.includes(`=${rhs}`);
}

const describe = (l: CheckedLine) => `L${l.index}: ${l.text}${l.verdict === "error" ? "   <-- WRONG" : ""}`;

function canned(req: HintRequest): HintResponse {
  return { level: req.level, text: CANNED_HINTS[req.line.misconception ?? ""] ?? CANNED_HINTS.default };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HintRequest | null;
  if (!body?.line) return badRequest("Send { line, context, level }.");
  const level = ([1, 2, 3] as const).includes(body.level) ? body.level : 1;
  if (wantsMock(request)) return Response.json(canned({ ...body, level }));

  const work = [...(body.context ?? []).filter((l) => l.index !== body.line.index), body.line]
    .sort((a, b) => a.index - b.index)
    .map(describe)
    .join("\n");
  const facts = [
    `The student's work so far:\n${work}`,
    `The wrong line is L${body.line.index}.`,
    body.line.misconception ? `Likely mistake: ${body.line.misconception}.` : "",
    body.line.note ? `The math engine says: ${body.line.note}` : "",
    body.studentReply ? `The student replied: "${body.studentReply}"` : "",
    `Give a level ${level} hint.`,
  ].filter(Boolean).join("\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data } = await generateJson<{ hint: string; correctedLine: string }>({
        system: HINT_SYSTEM,
        parts: [{ text: attempt === 0 ? facts : `${facts}\nYour last hint gave the answer away. Do NOT state the corrected line or any final value.` }],
        schema: HINT_SCHEMA,
        thinking: "low",
        temperature: 0.4,
      });
      if (data.hint && !leaks(data.hint, data.correctedLine ?? "")) return Response.json({ level, text: data.hint.trim() } satisfies HintResponse);
    } catch (err) {
      console.error("[hint] AI call failed:", err);
      break;
    }
  }
  return Response.json(canned({ ...body, level }));
}
