// Owner: D. POST CheckRequest → CheckResult.
// Gemini only READS the handwriting; the math engine (lib/math/verify) decides correctness
// wherever it can. Lines the engine can't check fall back to Gemini's own verdict, labeled "ai".
import { checkError } from "@/fixtures";
import { generateJson, png } from "@/lib/ai/gemini";
import { JUDGE_SCHEMA, JUDGE_SYSTEM, READER_SCHEMA, READER_SYSTEM } from "@/lib/ai/prompts";
import { aiUnavailable, badRequest, kebab, MAX_PNG_BASE64, wantsMock } from "@/lib/ai/respond";
import { verifyLines, type LineVerdict } from "@/lib/math/verify";
import type { Box, CheckRequest, CheckResult, CheckedLine, ReadLine } from "@/lib/types";

export const maxDuration = 30;

const NO_BOX: Box = { x: 0, y: 0, w: 0, h: 0 };

/** Gemini sometimes leaves the calculus fields empty; recover them from the line text. */
function fillCalculusFields(l: ReadLine): ReadLine {
  if (l.kind === "derivative" && (!l.expr || !l.result)) {
    const m = l.text.match(/d\s*\/\s*dx\s*(.+?)\s*=\s*(.+)$/i);
    if (m) return { ...l, expr: l.expr || m[1].replace(/^\((.*)\)$/, "$1"), result: l.result || m[2] };
  }
  if (l.kind === "limit" && (!l.expr || !l.point || !l.result)) {
    const m = l.text.match(/lim\w*\s*\(?\s*[a-z]\s*(?:->|→|to)\s*([^\s)]+)\s*\)?\s*(.+?)\s*=\s*(.+)$/i);
    if (m) return { ...l, point: l.point || m[1], expr: l.expr || m[2].replace(/^\((.*)\)$/, "$1"), result: l.result || m[3] };
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

/** Below this, a math "error" may just be a misread digit: don't paint a red line on our own misreading. */
const LOW_CONFIDENCE = 0.55;

/**
 * Run the math engine separately for each column, so problems written side by side never get
 * compared with each other (line 1 of the right problem is not a step after the left problem).
 */
function verifyByColumn(read: ReadLine[], columnOf: (index: number) => number): LineVerdict[] {
  const out: LineVerdict[] = new Array(read.length);
  const cols = new Map<number, number[]>();
  read.forEach((l, i) => {
    const c = columnOf(l.index);
    cols.set(c, [...(cols.get(c) ?? []), i]);
  });
  for (const idxs of cols.values()) {
    const v = verifyLines(idxs.map((i) => read[i]));
    idxs.forEach((i, k) => (out[i] = v[k]));
  }
  return out;
}

/**
 * Second opinion on a line only the AI can judge and the reader called wrong. Text-only and short,
 * with a hard time limit: if it times out we keep the reader's verdict.
 */
async function judge(prev: ReadLine[], line: ReadLine): Promise<{ verdict: "correct" | "error" | "unclear"; reason?: string; misconception?: string } | null> {
  const history = prev.filter((l) => l.text.trim()).map((l) => `L${l.index}: ${l.text}`).join("\n") || "(none: this is the first line)";
  const call = generateJson<{ verdict: "correct" | "error" | "unclear"; reason?: string; misconception?: string }>({
    system: JUDGE_SYSTEM,
    parts: [{ text: `Previous lines:\n${history}\n\nStep to check:\nL${line.index}: ${line.text}` }],
    schema: JUDGE_SCHEMA,
    thinking: "low",
    prefer: "smart",
    timeoutMs: 6_000,
  }).then((r) => r.data);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 7_000));
  try {
    return await Promise.race([call, timeout]);
  } catch {
    return null;
  }
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
      // Lines we already read go along as context, so the reader's verdict on a new line knows what came before.
      const context = known.filter((k) => k.text.trim()).map((k) => `L${k.index}: ${k.text}`).join("\n");
      const { data } = await generateJson<{ lines: ReadLine[] }>({
        system: READER_SYSTEM,
        parts: [png(body.png), { text: `Transcribe these lines: ${labels}.${context ? `\n\nAlready transcribed (context only, do not return these):\n${context}` : ""}` }],
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

  const columnOf = (index: number) => lineBoxes.find((b) => b.index === index)?.column ?? 0;
  const verdicts = verifyByColumn(read, columnOf);

  // Second opinion: only for lines the math couldn't decide, that the reader called wrong, and only
  // the FIRST such line per column (later lines don't matter until that one is resolved).
  const judged = new Map<number, Awaited<ReturnType<typeof judge>>>();
  const seenCol = new Set<number>();
  const toJudge: number[] = [];
  read.forEach((line, i) => {
    const col = columnOf(line.index);
    if (seenCol.has(col)) return;
    const mathErr = verdicts[i]?.verdict === "error";
    const aiErr = verdicts[i]?.verdict === "unclear" && line.aiVerdict === "error" && line.text.trim() && !looksUnfinished(line);
    if (mathErr) seenCol.add(col);
    else if (aiErr) {
      seenCol.add(col);
      toJudge.push(i);
    }
  });
  await Promise.all(
    toJudge.map(async (i) => {
      const col = columnOf(read[i].index);
      judged.set(i, await judge(read.slice(0, i).filter((l) => columnOf(l.index) === col), read[i]));
    }),
  );

  const lines: CheckedLine[] = read.map((line, i) => {
    if (!line.text.trim()) {
      // The whole line was crossed out: nothing to judge, and no "?" for an unreadable line.
      return { ...line, box: lineBoxes.find((b) => b.index === line.index)?.box ?? NO_BOX, verdict: "unclear", verifiedBy: "ai", readConfidence: 1, note: "Crossed out.", misconception: undefined };
    }
    if (looksUnfinished(line)) {
      return { ...line, box: lineBoxes.find((b) => b.index === line.index)?.box ?? NO_BOX, verdict: "unclear", verifiedBy: "ai", note: "This line looks unfinished.", misconception: undefined };
    }
    const box = lineBoxes.find((b) => b.index === line.index)?.box ?? NO_BOX;
    const math = verdicts[i];
    if (math?.verdict === "error" && line.readConfidence < LOW_CONFIDENCE) {
      // The math says wrong, but we may have misread the handwriting. Ask instead of accusing.
      return { ...line, box, verdict: "unclear", verifiedBy: "ai", note: `I couldn't read this line clearly. Did you write ${line.text}?`, misconception: undefined };
    }
    const useMath = math && math.verdict !== "unclear";
    let aiVerdict = line.aiVerdict;
    let note = math?.note;
    let misconception = line.misconception;
    const second = judged.get(i);
    if (judged.has(i) && second) {
      // The judge overrules the reader: a red line needs two votes when the math can't decide.
      aiVerdict = second.verdict;
      if (second.verdict === "error") {
        note = second.reason || note;
        misconception = kebab(second.misconception) ?? misconception;
      }
    }
    const verdict = useMath ? math.verdict : aiVerdict;
    return {
      ...line,
      box,
      verdict,
      verifiedBy: useMath ? "math" : "ai",
      note,
      // A misconception only makes sense on a wrong line. The engine's own diagnosis wins when it has one.
      misconception: verdict === "error" ? ((useMath ? math.misconception : undefined) ?? misconception ?? "step-not-equivalent") : undefined,
    };
  });

  const result: CheckResult = {
    pageId: body.pageId,
    lines,
    firstErrorIndex: lines.find((l) => l.verdict === "error")?.index ?? null,
  };
  return Response.json(result);
}
