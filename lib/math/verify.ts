// Owner: B. Deterministic step checker: "Gemini reads, math verifies."
//
// How a line is judged (math wins whenever it can decide; otherwise "unclear" -> AI verdict, labeled "ai"):
//  - equations and inequalities (any number of variables, up to 3): each line is compared with the
//      LAST relation line above it by relations.ts: proportional test, then real solution sets
//      (catches lost solutions, allows squaring/clearing denominators with a note), and truth-value
//      agreement for inequalities (catches a sign that should have flipped).
//  - "a = b = c" on one line: every link must be equal.
//  - expression lines starting with "=" are compared with the previous expression: a - b ≈ 0.
//  - integral / derivative / limit lines: see calculus.ts (numeric differentiation, Simpson's rule, limits).
//  - text / other: unclear.
// An error is carried forward: later lines are compared to what the student actually wrote,
// so only the FIRST wrong line is flagged, not every line after it.
import type { CheckedLine, ReadLine } from "../types";
import { checkCalculusLine } from "./calculus";
import type { MathNode } from "mathjs";
import { Unclear, freeVars, parse, splitTopLevel, stripConstant, toFn, type Fn } from "./expr";
import { compareSteps, expressionsEqual, parseRelation, type Relation } from "./relations";

export type LineVerdict = Pick<CheckedLine, "verdict" | "verifiedBy" | "note"> & { misconception?: string };

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


/** Lines Gemini tags "equation" but that are really "= 2x + 6" continuations get treated as expressions. */
const isContinuation = (text: string) => /^\s*=/.test(text);

export function verifyLines(lines: ReadLine[]): LineVerdict[] {
  let prevRel: { rel: Relation; text: string } | null = null;
  let prevExpr: MathNode | null = null;
  const carried: { integrand?: string; expr?: string } = {};
  const ok = (note?: string): LineVerdict => ({ verdict: "correct", verifiedBy: "math", note });
  const bad = (note: string, misconception?: string): LineVerdict => ({ verdict: "error", verifiedBy: "math", note, misconception });

  return lines.map((line) => {
    try {
      const text = line.text.trim();

      // ---- calculus: integrals, derivatives, limits ----
      if (line.kind === "integral" || line.kind === "derivative" || line.kind === "limit") {
        if (line.integrand) carried.integrand = line.integrand;
        if (line.expr) carried.expr = line.expr;
        return checkCalculusLine(line, carried) ?? UNCLEAR;
      }
      if (line.kind === "text" || !text) return UNCLEAR;

      // ---- expression chains: "= 2x + 6" continues the expression above ----
      if (isContinuation(text) && (line.kind === "expression" || line.kind === "equation" || line.kind === "other")) {
        const cur = parseNode(stripConstant(text.replace(/^\s*=\s*/, "")).expr);
        const prev = prevExpr;
        prevExpr = cur;
        if (!prev) return UNCLEAR;
        const same = expressionsEqual(prev, cur);
        if (same === null) return UNCLEAR;
        return same ? ok() : bad("this isn't equal to the line above", "simplification-error");
      }

      const hasRelation = /[<>≤≥]/.test(text) || (/=/.test(text) && line.kind !== "expression");
      // "a = b = c" written on one line: every link in the chain must be equal.
      const sides = splitTopLevel(text, /^=/);
      const isList = splitTopLevel(text, /^(\s+or\s+|,|;)/i).length > 1; // "x = 2 or x = 3" is a list, not a chain
      if (!/[<>≤≥]/.test(text) && sides.length >= 3 && !isList) {
        const nodes = sides.map((x) => parseNode(stripConstant(x).expr));
        prevExpr = nodes[nodes.length - 1];
        for (let i = 1; i < nodes.length; i++) {
          const same = expressionsEqual(nodes[i - 1], nodes[i]);
          if (same === null) return UNCLEAR;
          if (!same) return bad(`step ${i} of this line isn't equal to the one before it`, "simplification-error");
        }
        return ok();
      }

      // ---- bare expression: start of a chain ----
      if (!hasRelation) {
        if (sides.length === 2) {
          // "3(x+2) = 3x + 6" tagged as an expression: an identity the student is claiming.
          const a = parseNode(stripConstant(sides[0]).expr), b = parseNode(stripConstant(sides[1]).expr);
          prevExpr = b;
          const same = expressionsEqual(a, b);
          if (same === null) return UNCLEAR;
          return same ? ok() : bad("the two sides aren't equal", "simplification-error");
        }
        if (line.kind === "expression" || line.kind === "other") prevExpr = parseNode(stripConstant(text).expr);
        return UNCLEAR; // nothing to compare yet
      }

      // ---- equations and inequalities ----
      const rel = parseRelation(text);
      if (!rel.vars.length) {
        // Pure arithmetic like "3*4 = 12" or "7 > 2": check it directly, don't chain on it.
        if (prevRel && rel.kind === "equation") return UNCLEAR; // "0 = 0" after solving: needs context
        const t = rel.clauses.every((c) => {
          const a = c.lhs({}), b = c.rhs({});
          if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Unclear("undefined");
          const d = a - b, tol = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
          return c.op === "=" ? Math.abs(d) <= tol : c.op === "<" ? d < -tol : c.op === ">" ? d > tol : c.op === "<=" ? d <= tol : d >= -tol;
        });
        return t ? ok() : bad("the arithmetic doesn't work out", "arithmetic-slip");
      }
      const prev = prevRel;
      prevRel = { rel, text };
      if (!prev) return UNCLEAR; // the first line is the problem itself
      const step = compareSteps(prev.rel, rel, text);
      if (step.verdict === "unclear") return UNCLEAR;
      return step.verdict === "correct" ? ok(step.note) : bad(step.note ?? "this line doesn't follow from the line above", step.misconception);
    } catch {
      // Unclear (unparsable, too many variables, ±, ...) or any unexpected math error:
      // never crash a check, just let the AI verdict stand.
      return UNCLEAR;
    }
  });
}

function parseNode(src: string): MathNode {
  return parse(src);
}

/** Index (ReadLine.index) of the first line the math engine or AI marked wrong, or null. */
export function firstError(lines: { index: number; verdict: string }[]): number | null {
  return lines.find((l) => l.verdict === "error")?.index ?? null;
}
