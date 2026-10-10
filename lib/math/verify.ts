// Owner: B. Deterministic step checker: "Gemini reads, math verifies."
//
// How a line is judged (math wins whenever it can decide; otherwise "unclear" -> AI verdict, labeled "ai"):
//  - equation lines: each line is compared with the LAST parsable equation line above it.
//      F(x) = Π_j (lhs_j - rhs_j) over its clauses ("x = 2 or x = 3" -> (x-2)(x-3)).
//      Two lines are equivalent iff F_b / F_a is the same nonzero constant at random points
//      (multiplying both sides by k, or swapping sides, keeps an equation equivalent).
//  - expression lines starting with "=" are compared with the previous expression: a - b ≈ 0.
//  - integral / derivative lines: see calculus.ts (numeric differentiation, Simpson's rule).
//  - text / other: unclear.
// An error is carried forward: later lines are compared to what the student actually wrote,
// so only the FIRST wrong line is flagged, not every line after it.
import type { CheckedLine, ReadLine } from "../types";
import { checkCalculusLine } from "./calculus";
import { Unclear, equivDiff, equivRatio, freeVars, parse, splitTopLevel, stripConstant, toFn, type Fn } from "./expr";

export type LineVerdict = Pick<CheckedLine, "verdict" | "verifiedBy" | "note">;

const UNCLEAR: LineVerdict = { verdict: "unclear", verifiedBy: "ai" };

export interface ParsedEquation {
  F: Fn;
  v: string | null; // null = no variable (pure arithmetic)
  clauses: { lhs: Fn; rhs: Fn }[];
}

/** Parse "lhs = rhs [or lhs = rhs ...]" into its line function. Throws Unclear. */
export function parseEquation(text: string): ParsedEquation {
  const clauses = splitTopLevel(text.trim(), /^(\s+or\s+|,|;)/i);
  if (clauses.length === 0) throw new Unclear("empty");
  const parsed = clauses.map((c) => {
    if (/[<>≤≥≠]/.test(c) || /==/.test(c)) throw new Unclear("not an equation");
    const sides = c.split("=");
    if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) throw new Unclear("each clause needs exactly one =");
    return { lhs: parse(sides[0]), rhs: parse(sides[1]) };
  });
  const vars = new Set<string>();
  for (const { lhs, rhs } of parsed) for (const v of [...freeVars(lhs), ...freeVars(rhs)]) vars.add(v);
  if (vars.size > 1) throw new Unclear("more than one variable");
  const v = [...vars][0] ?? null;
  const fns = parsed.map(({ lhs, rhs }) => ({ lhs: toFn(lhs, v ?? "x"), rhs: toFn(rhs, v ?? "x") }));
  const F: Fn = (x) => fns.reduce((acc, { lhs, rhs }) => acc * (lhs(x) - rhs(x)), 1);
  return { F, v, clauses: fns };
}

function parseExpression(text: string): { f: Fn; v: string | null } {
  const node = parse(stripConstant(text).expr);
  const vars = freeVars(node);
  if (vars.length > 1) throw new Unclear("more than one variable");
  const v = vars[0] ?? null;
  return { f: toFn(node, v ?? "x"), v };
}

/** Lines Gemini tags "equation" but that are really "= 2x + 6" continuations get treated as expressions. */
const isContinuation = (text: string) => /^\s*=/.test(text);

export function verifyLines(lines: ReadLine[]): LineVerdict[] {
  let prevEq: ParsedEquation | null = null;
  let prevExpr: { f: Fn; v: string | null } | null = null;
  const carried: { integrand?: string; expr?: string } = {};

  return lines.map((line) => {
    try {
      // ---- calculus ----
      if (line.kind === "integral" || line.kind === "derivative") {
        if (line.integrand) carried.integrand = line.integrand;
        if (line.expr) carried.expr = line.expr;
        return checkCalculusLine(line, carried) ?? UNCLEAR;
      }

      // ---- expression chains: "= 2x + 6" ----
      if (line.kind === "expression" || (line.kind === "equation" && isContinuation(line.text))) {
        const text = line.text.trim();
        if (isContinuation(text)) {
          const cur = parseExpression(text.replace(/^\s*=\s*/, ""));
          const prev = prevExpr;
          prevExpr = cur;
          if (!prev) return UNCLEAR;
          if (prev.v && cur.v && prev.v !== cur.v) return UNCLEAR;
          const same = equivDiff(prev.f, cur.f);
          if (same === null) return UNCLEAR;
          return same ? { verdict: "correct", verifiedBy: "math" } : { verdict: "error", verifiedBy: "math", note: "this isn't equal to the line above" };
        }
        const sides = splitTopLevel(text, /^=/);
        if (sides.length === 2) {
          // "3(x+2) = 3x + 6": an identity the student is claiming.
          const a = parseExpression(sides[0]), b = parseExpression(sides[1]);
          prevExpr = b;
          const same = equivDiff(a.f, b.f);
          if (same === null) return UNCLEAR;
          return same ? { verdict: "correct", verifiedBy: "math" } : { verdict: "error", verifiedBy: "math", note: "the two sides aren't equal" };
        }
        prevExpr = parseExpression(text);
        return UNCLEAR; // a starting expression: nothing to compare yet
      }

      // ---- equations ----
      if (line.kind === "equation") {
        const cur = parseEquation(line.text);
        if (cur.v === null) {
          // Pure arithmetic like "3*4 = 12": check it directly, don't chain on it.
          if (cur.clauses.length !== 1) return UNCLEAR;
          const { lhs, rhs } = cur.clauses[0];
          const a = lhs(0), b = rhs(0);
          if (!Number.isFinite(a) || !Number.isFinite(b)) return UNCLEAR;
          // "0 = 0" style identities after solving: can't tell if that's right without context.
          if (prevEq) return UNCLEAR;
          return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a))
            ? { verdict: "correct", verifiedBy: "math" }
            : { verdict: "error", verifiedBy: "math", note: "the arithmetic doesn't work out" };
        }
        const prev = prevEq;
        prevEq = cur;
        if (!prev) return UNCLEAR; // the first equation is the problem itself
        if (prev.v !== cur.v) return UNCLEAR;
        const same = equivRatio(prev.F, cur.F);
        if (same === null) return UNCLEAR;
        return same
          ? { verdict: "correct", verifiedBy: "math" }
          : { verdict: "error", verifiedBy: "math", note: "this line has different solutions than the line above" };
      }

      return UNCLEAR;
    } catch {
      // Unclear (unparsable, two variables, ±, ...) or any unexpected math error:
      // never crash a check, just let the AI verdict stand.
      return UNCLEAR;
    }
  });
}

/** Index (ReadLine.index) of the first line the math engine or AI marked wrong, or null. */
export function firstError(lines: { index: number; verdict: string }[]): number | null {
  return lines.find((l) => l.verdict === "error")?.index ?? null;
}
