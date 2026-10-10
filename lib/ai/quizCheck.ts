// Owner: D. Server-side sanity check for AI-written quiz answers, so we never teach a wrong answer key.
// Equation answers ("x = 7") are substituted into the question's equation; integral answers are
// differentiated numerically and compared to the integrand. Anything we can't check passes through.
import { all, create } from "mathjs";

const math = create(all, { predictable: true });

const tidy = (s: string) =>
  s.replace(/−/g, "-").replace(/×|·/g, "*").replace(/²/g, "^2").replace(/³/g, "^3").replace(/\+\s*C\s*$/i, "").trim();

function evalAt(expr: string, x: number): number {
  const v = math.evaluate(tidy(expr), { x, e: Math.E, pi: Math.PI });
  return typeof v === "number" ? v : NaN;
}

/** All values in "x = 3", "x = 2 or x = -1", "x = 2/11". */
function solutionValues(answer: string): number[] | null {
  const clauses = tidy(answer).split(/\bor\b|,/);
  const values: number[] = [];
  for (const c of clauses) {
    const [lhs, rhs] = c.split("=");
    if (!rhs || lhs.trim() !== "x") return null;
    const v = math.evaluate(rhs.trim());
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    values.push(v);
  }
  return values;
}

export interface QuizCheckInput {
  answer: string;
  answerKind: "equation" | "expression" | "number";
  checkEquation?: string; // the equation to solve, for "solve" questions
  integrand?: string; // for integral questions
}

/** true = verified, false = proven wrong, null = couldn't check. */
export function verifyQuizAnswer(q: QuizCheckInput): boolean | null {
  try {
    if (q.answerKind === "equation" && q.checkEquation?.includes("=")) {
      const values = solutionValues(q.answer);
      if (!values) return null;
      const [lhs, rhs] = tidy(q.checkEquation).split("=");
      return values.every((x) => Math.abs(evalAt(lhs, x) - evalAt(rhs, x)) < 1e-6 * Math.max(1, Math.abs(evalAt(rhs, x))));
    }
    if (q.integrand) {
      const h = 1e-4;
      let checked = 0;
      for (const x of [-2.3, -1.1, -0.4, 0.7, 1.3, 2.2]) {
        const d = (evalAt(q.answer, x + h) - evalAt(q.answer, x - h)) / (2 * h);
        const f = evalAt(q.integrand, x);
        if (!Number.isFinite(d) || !Number.isFinite(f)) continue;
        checked++;
        if (Math.abs(d - f) > 1e-3 * Math.max(1, Math.abs(f))) return false;
      }
      return checked >= 3 ? true : null;
    }
  } catch {
    return null;
  }
  return null;
}
