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

/** "3*x + 12 +", "x =", "2*(x + 1" — clearly mid-write, so not something to mark wrong. */
function looksUnfinished(l: ReadLine): boolean {
  if (l.kind !== "equation" && l.kind !== "expression" && l.kind !== "other") return false;
  const t = l.text.trim();
  if (!t) return true;
  if (/[-+*/^=(]$/.test(t)) return true;
  let depth = 0;
  for (const ch of t) depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
  return depth > 0;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CheckRequest | null;
  if (wantsMock(request)) return Response.json({ ...checkError, pageId: body?.pageId ?? checkError.pageId });
  if (!body?.png) return badRequest("Send { pageId, png, lines }.");
  if (body.png.length > MAX_PNG_BASE64) return badRequest("Image too large. Export at most 1600 px.");
  const lineBoxes = body.lines ?? [];

  // Speed: lines the client already has readings for (unchanged ink) are not re-read.
  // Gemini's latency is mostly output length, so reading 1 new line instead of 6 is much faster,
  // and when every line is known we skip Gemini entirely and only re-run the math.
  const known = (body.known ?? []).filter((k) => lineBoxes.some((b) => b.index === k.index));
  const toRead = lineBoxes.filter((b) => !known.some((k) => k.index === b.index));

  let read: ReadLine[] = known;
  if (toRead.length || !lineBoxes.length) {
    try {
      const labels = toRead.length ? toRead.map((l) => `L${l.index}`).join(", ") : "every line you can see (number them L1, L2, ... top to bottom)";
      const { data } = await generateJson<{ lines: ReadLine[] }>({
        system: READER_SYSTEM,
        parts: [png(body.png), { text: `Transcribe these lines: ${labels}.` }],
        schema: READER_SCHEMA,
        thinking: "minimal",
        prefer: "smart", // accuracy over the ~1 s Lite saves: a misread line poisons every later check
      });
      const fresh = (data.lines ?? [])
        .filter((l) => !toRead.length || toRead.some((b) => b.index === l.index))
        .map((l) => fillCalculusFields({ ...l, topic: kebab(l.topic), misconception: kebab(l.misconception) }));
      read = [...known, ...fresh];
    } catch (err) {
      return aiUnavailable(err);
    }
  }
  read = read.sort((a, b) => a.index - b.index);

  const verdicts = verifyLines(read);
  const lines: CheckedLine[] = read.map((line, i) => {
    if (!line.text.trim()) {
      // The whole line was crossed out: nothing to judge, and no "?" for an unreadable line.
      return { ...line, box: lineBoxes.find((b) => b.index === line.index)?.box ?? NO_BOX, verdict: "unclear", verifiedBy: "ai", readConfidence: 1, note: "Crossed out.", misconception: undefined };
    }
    if (looksUnfinished(line)) {
      return { ...line, box: lineBoxes.find((b) => b.index === line.index)?.box ?? NO_BOX, verdict: "unclear", verifiedBy: "ai", note: "This line looks unfinished.", misconception: undefined };
    }
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
