// Owner: D. POST CheckRequest → CheckResult.
// Gemini only READS the handwriting; the math engine (lib/math/verify) decides correctness
// wherever it can. Lines the engine can't check fall back to Gemini's own verdict, labeled "ai".
import { checkError } from "@/fixtures";
import { generateJson, png } from "@/lib/ai/gemini";
import { READER_SCHEMA, READER_SYSTEM } from "@/lib/ai/prompts";
import { aiUnavailable, badRequest, kebab, MAX_PNG_BASE64, wantsMock } from "@/lib/ai/respond";
import { verifyLines } from "@/lib/math/verify";
import type { Box, CheckRequest, CheckResult, CheckedLine, ReadLine } from "@/lib/types";

export const maxDuration = 30;

const NO_BOX: Box = { x: 0, y: 0, w: 0, h: 0 };

/** Gemini sometimes leaves the calculus fields empty; recover them from the line text. */
function fillCalculusFields(l: ReadLine): ReadLine {
  if (l.kind === "derivative" && (!l.expr || !l.result)) {
    const m = l.text.match(/d\s*\/\s*dx\s*(.+?)\s*=\s*(.+)$/i);
    if (m) return { ...l, expr: l.expr || m[1].replace(/^\((.*)\)$/, "$1"), result: l.result || m[2] };
  }
  if (l.kind === "integral" && (!l.integrand || !l.result)) {
    const m = l.text.match(/(?:integral of|∫)\s*(.+?)\s*d[a-z]\s*=\s*(.+)$/i);
    if (m) return { ...l, integrand: l.integrand || m[1], result: l.result || m[2].replace(/\+\s*C\s*$/i, "").trim() };
  }
  return l;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CheckRequest | null;
  if (wantsMock(request)) return Response.json({ ...checkError, pageId: body?.pageId ?? checkError.pageId });
  if (!body?.png) return badRequest("Send { pageId, png, lines }.");
  if (body.png.length > MAX_PNG_BASE64) return badRequest("Image too large. Export at most 1600 px.");
  const lineBoxes = body.lines ?? [];

  let read: ReadLine[];
  try {
    const labels = lineBoxes.length ? lineBoxes.map((l) => `L${l.index}`).join(", ") : "every line you can see (number them L1, L2, ... top to bottom)";
    const { data } = await generateJson<{ lines: ReadLine[] }>({
      system: READER_SYSTEM,
      parts: [png(body.png), { text: `Transcribe these lines: ${labels}.` }],
      schema: READER_SCHEMA,
      thinking: "minimal",
    });
    read = (data.lines ?? [])
      .filter((l) => !lineBoxes.length || lineBoxes.some((b) => b.index === l.index))
      .sort((a, b) => a.index - b.index)
      .map((l) => fillCalculusFields({ ...l, topic: kebab(l.topic), misconception: kebab(l.misconception) }));
  } catch (err) {
    return aiUnavailable(err);
  }

  const verdicts = verifyLines(read);
  const lines: CheckedLine[] = read.map((line, i) => {
    const math = verdicts[i];
    const useMath = math && math.verdict !== "unclear";
    return {
      ...line,
      box: lineBoxes.find((b) => b.index === line.index)?.box ?? NO_BOX,
      verdict: useMath ? math.verdict : line.aiVerdict,
      verifiedBy: useMath ? "math" : "ai",
      note: math?.note,
      // A misconception only makes sense on a wrong line.
      misconception: (useMath ? math.verdict : line.aiVerdict) === "error" ? (line.misconception ?? "step-not-equivalent") : undefined,
    };
  });

  const result: CheckResult = {
    pageId: body.pageId,
    lines,
    firstErrorIndex: lines.find((l) => l.verdict === "error")?.index ?? null,
  };
  return Response.json(result);
}
