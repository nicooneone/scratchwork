// Owner: B. Calculus checks by numeric differentiation and Simpson's rule.
//
// Indefinite integral  ∫ f dx = R + C   is correct iff  R'(x) ≈ f(x)  at sample points.
//   R'(x) is a central difference (R(x+h) - R(x-h)) / 2h, h = 1e-4, on x in [-3, 3].
//   This checks ANY method (u-sub, parts, tables): we never need to know how they got R.
// Definite integral  ∫_a^b f dx = v   is checked with Simpson's rule (200 intervals).
// Derivative  d/dx E = R   is correct iff  E'(x) ≈ R(x)  at sample points.
import type { ReadLine } from "../types";
import { Unclear, freeVars, math, parse, pretty, samples, stripConstant, toFn, type Fn } from "./expr";
import type { LineVerdict } from "./verify";

const H = 1e-4;
const TOL = 1e-4;

const numDeriv = (F: Fn): Fn => (x) => (F(x + H) - F(x - H)) / (2 * H);
/** Near a pole the central difference blows up. Trust a point only if step h and 2h agree. */
const stableAt = (F: Fn, x: number) => {
  const d1 = (F(x + H) - F(x - H)) / (2 * H);
  const d2 = (F(x + 2 * H) - F(x - 2 * H)) / (4 * H);
  return Number.isFinite(d1) && Number.isFinite(d2) && Math.abs(d1 - d2) <= 1e-6 * Math.max(1, Math.abs(d1));
};
const close = (a: number, b: number) => Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));

/** The one variable shared by two expressions (C is the integration constant, never a variable). */
function sharedVar(...exprs: string[]): string {
  const vars = new Set<string>();
  for (const e of exprs) for (const v of freeVars(parse(e), ["C", "K"])) vars.add(v);
  if (vars.size > 1) throw new Unclear("more than one variable");
  return [...vars][0] ?? "x";
}

/** Compare g ≈ f at sample points in [-3, 3]. null = not enough usable points. */
function agree(f: Fn, g: Fn, differentiated: Fn): boolean | null {
  const xs = samples((x) => {
    const a = f(x), b = g(x);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) < 1e6 && Math.abs(b) < 1e6 && stableAt(differentiated, x);
  }, -3, 3, 6, 80, 0xca1c);
  if (xs.length < 4) return null;
  return xs.every((x) => close(f(x), g(x)));
}

export function simpson(f: Fn, a: number, b: number, n = 200): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

export function checkIntegral(integrand: string, result: string, lower?: string, upper?: string): LineVerdict {
  const { expr: R } = stripConstant(result);

  if (lower != null && upper != null && lower !== "" && upper !== "") {
    const v = sharedVar(integrand);
    const f = toFn(parse(integrand), v);
    const a = math.evaluate(parse(lower).toString()), b = math.evaluate(parse(upper).toString());
    const stated = math.evaluate(parse(R).toString());
    if (![a, b, stated].every((n) => typeof n === "number" && Number.isFinite(n))) throw new Unclear("bounds or value not numeric");
    const actual = simpson(f, a, b);
    if (!Number.isFinite(actual)) throw new Unclear("integral diverges or undefined on the interval");
    return Math.abs(actual - stated) <= 1e-4 * Math.max(1, Math.abs(actual))
      ? { verdict: "correct", verifiedBy: "math" }
      : { verdict: "error", verifiedBy: "math", note: `the integral works out to about ${round(actual)}, not ${round(stated)}` };
  }

  const v = sharedVar(integrand, R);
  const f = toFn(parse(integrand), v);
  const Rfn = toFn(parse(R), v);
  const ok = agree(f, numDeriv(Rfn), Rfn);
  if (ok === null) throw new Unclear("not enough points where both sides are defined");
  if (ok) return { verdict: "correct", verifiedBy: "math" };
  return { verdict: "error", verifiedBy: "math", note: derivativeNote(R, v, "the derivative of your answer is") };
}

export function checkDerivative(expr: string, result: string): LineVerdict {
  const v = sharedVar(expr, result);
  const E = toFn(parse(expr), v);
  const R = toFn(parse(result), v);
  const ok = agree(numDeriv(E), R, E);
  if (ok === null) throw new Unclear("not enough points where both sides are defined");
  if (ok) return { verdict: "correct", verifiedBy: "math" };
  // Note gives the tutor something concrete without handing over the answer.
  const x0 = [1, 2, 0.5].find((x) => Number.isFinite(E(x)) && Number.isFinite(R(x))) ?? 1;
  return {
    verdict: "error",
    verifiedBy: "math",
    note: `at ${v} = ${x0} the true slope is ${round(numDeriv(E)(x0))} but your answer gives ${round(R(x0))}`,
  };
}

/** Run the right calculus check for a reader line, or null if it isn't a checkable calculus line. */
export function checkCalculusLine(line: ReadLine, carried?: { integrand?: string; expr?: string }): LineVerdict | null {
  if (line.kind === "integral") {
    const integrand = line.integrand || carried?.integrand;
    if (!integrand || !line.result) return null;
    return checkIntegral(integrand, line.result, line.lower, line.upper);
  }
  if (line.kind === "derivative") {
    const expr = line.expr || carried?.expr;
    if (!expr || !line.result) return null;
    return checkDerivative(expr, line.result);
  }
  return null;
}

function derivativeNote(R: string, v: string, prefix: string): string | undefined {
  try {
    return `${prefix} ${pretty(math.simplify(math.derivative(parse(R), v)))}`;
  } catch {
    return undefined;
  }
}

const round = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(1) : Number(n.toPrecision(4)).toString());
