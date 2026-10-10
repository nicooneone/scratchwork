// Owner: B. Grade a handwritten quiz answer against the generated answer key.
import type { QuizQuestion, ReadLine, Verdict } from "../types";
import { equivDiff, equivRatio, freeVars, parse, splitTopLevel, stripConstant, toFn } from "./expr";
import { parseEquation } from "./verify";

/** The part after the last top-level "=" ("x = 14" -> "14", "f'(x) = 2x" -> "2x"). */
const lastSide = (s: string) => {
  const parts = splitTopLevel(s, /^=/);
  return parts[parts.length - 1] ?? s;
};

function exprEqual(a: string, b: string): boolean | null {
  const na = parse(stripConstant(a).expr), nb = parse(stripConstant(b).expr);
  const vars = new Set([...freeVars(na), ...freeVars(nb)]);
  if (vars.size > 1) return null;
  const v = [...vars][0] ?? "x";
  return equivDiff(toFn(na, v), toFn(nb, v));
}

export function checkQuizAnswer(q: QuizQuestion, line: ReadLine): Verdict {
  try {
    const student = (line.result || line.text).trim();
    let ok: boolean | null;
    if (q.answerKind === "equation") {
      const a = parseEquation(q.answer), s = parseEquation(student);
      if (a.v !== s.v) return "unclear";
      ok = a.v === null ? null : equivRatio(a.F, s.F);
    } else {
      // expression / number: compare the value the student ended on
      ok = exprEqual(lastSide(q.answer), lastSide(student));
    }
    return ok === null ? "unclear" : ok ? "correct" : "error";
  } catch {
    return "unclear";
  }
}
