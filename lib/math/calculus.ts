// Owner: B. Calculus checks by numeric differentiation and Simpson's rule.
//
// Indefinite integral  ∫ f dx = R + C   is correct iff  R'(x) ≈ f(x)  at sample points.
//   R'(x) is a central difference (R(x+h) - R(x-h)) / 2h, h = 1e-4, on x in [-3, 3].
//   This checks ANY method (u-sub, parts, tables): we never need to know how they got R.
// Definite integral  ∫_a^b f dx = v   is checked with Simpson's rule (200 intervals).
// Derivative  d/dx E = R   is correct iff  E'(x) ≈ R(x)  at sample points.
// Limit  lim_{x->p} E = L   is checked numerically: E is sampled ever closer to p from each side
//   (or at x = 10, 100, ... for p = inf). The stated L is correct when the distance |E(x) - L|
//   keeps shrinking toward 0; inf / -inf when |E| grows without bound with one sign; DNE when the
//   one-sided limits disagree. Oscillating cases (sin(1/x)) stay unclear for the AI.
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
  if (line.kind === "limit") {
    const expr = line.expr || carried?.expr;
    if (!expr || !line.point || !line.result) return null;
    return checkLimit(expr, line.point, line.result);
  }
  return null;
}

type LimitValue = number | "inf" | "-inf" | "dne";

/** "inf", "-infinity", "∞", "oo", "DNE", "does not exist", or a number/expression. */
function parseLimitValue(s: string): LimitValue {
  const t = s.trim().toLowerCase().replace(/\s+/g, "");
  if (/^(\+)?(inf|infinity|∞|oo)$/.test(t)) return "inf";
  if (/^-(inf|infinity|∞|oo)$/.test(t)) return "-inf";
  if (/^(dne|doesnotexist|undefined|none)$/.test(t)) return "dne";
  const n = math.evaluate(parse(s).toString());
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Unclear("limit value not numeric");
  return n;
}

/** Points walking toward p from one side (side = +1 from above, -1 from below). */
function approach(p: LimitValue, side: 1 | -1): number[] {
  if (p === "inf" || p === "-inf") return [1, 2, 3, 4, 5, 6].map((k) => (p === "inf" ? 1 : -1) * 10 ** k);
  if (typeof p !== "number") throw new Unclear("bad limit point");
  return [2, 3, 4, 5, 6].map((k) => p + side * 10 ** -k);
}

/** What f does along the points: converges to a number, blows up, or neither (null). */
function trend(f: Fn, xs: number[]): { vals: number[]; to: LimitValue | null } {
  let vals = xs.map((x) => f(x));
  // Overflow far out (e^(10^6)) shows up as NaN: keep the values before it if there are enough.
  const cut = vals.findIndex((v) => Number.isNaN(v));
  if (cut >= 2 && vals.slice(cut).every((v) => Number.isNaN(v)) && Math.abs(vals[cut - 1]) > 1e4) vals = vals.slice(0, cut);
  if (vals.some((v) => Number.isNaN(v))) return { vals, to: null };
  const last = vals[vals.length - 1];
  const big = (v: number) => !Number.isFinite(v) || Math.abs(v) > 1e4;
  const growing = vals.length >= 2 && vals.slice(-3).every((v, i, a) => i === 0 || Math.abs(v) >= Math.abs(a[i - 1]) * 1.5 || !Number.isFinite(v));
  const sameSign = vals.slice(-3).every((v) => Math.sign(v) === Math.sign(last));
  if (big(last) && growing && sameSign) return { vals, to: last > 0 ? "inf" : "-inf" };
  if (!vals.every(Number.isFinite)) return { vals, to: null };
  const d = vals.slice(1).map((v, i) => Math.abs(v - vals[i]));
  const scale = Math.max(1, Math.abs(last));
  // Converging: the last steps are tiny and not growing.
  if (d[d.length - 1] <= 1e-3 * scale && d[d.length - 1] <= d[d.length - 2] * 1.5 + 1e-12) return { vals, to: last };
  return { vals, to: null };
}

/** Does the sequence of values close in on the stated number L? */
function closesIn(vals: number[], L: number): boolean {
  const scale = Math.max(1, Math.abs(L));
  const dist = vals.map((v) => Math.abs(v - L));
  const lastD = dist[dist.length - 1], firstD = dist[0];
  return lastD <= 1e-4 * scale || (lastD <= 0.02 * scale && lastD <= 0.2 * firstD);
}

export function checkLimit(expr: string, point: string, result: string): LineVerdict {
  const v = sharedVar(expr);
  const f = toFn(parse(expr), v);
  // "0+" / "0^+" / "2-" are one-sided; "inf" / "-inf" are not.
  const raw = point.trim();
  const m = /^(.+?)\s*\^?\s*([+-])$/.exec(raw);
  const isInf = /^[+-]?(inf|infinity|∞|oo)$/i.test(raw.replace(/\s+/g, ""));
  const oneSide: 0 | 1 | -1 = !isInf && m ? (m[2] === "+" ? 1 : -1) : 0;
  const p = parseLimitValue(oneSide ? m![1] : raw);
  if (p === "dne") throw new Unclear("bad limit point");
  const stated = parseLimitValue(result);
  const sides: (1 | -1)[] = p === "inf" || p === "-inf" ? [1] : oneSide ? [oneSide] : [-1, 1];
  const runs = sides.map((s) => trend(f, approach(p, s)));
  const good: LineVerdict = { verdict: "correct", verifiedBy: "math" };
  const wrong = (note: string): LineVerdict => ({ verdict: "error", verifiedBy: "math", note, misconception: "limit-value" });

  if (stated === "dne") {
    if (runs.length < 2 || runs.some((r) => r.to === null)) throw new Unclear("can't decide existence numerically");
    const [a, b] = runs.map((r) => r.to!);
    const same = typeof a === "number" && typeof b === "number" ? close(a, b) : a === b;
    return same ? wrong("the limit does exist here: both sides approach the same thing") : good;
  }
  if (stated === "inf" || stated === "-inf") {
    if (runs.some((r) => r.to === null)) throw new Unclear("no clear trend");
    if (runs.every((r) => r.to === stated)) return good;
    if (runs.every((r) => typeof r.to === "number")) return wrong("the function settles to a finite value here, it doesn't blow up");
    return wrong("check the behavior on each side of the point again");
  }
  // A finite stated value.
  if (runs.every((r) => closesIn(r.vals, stated))) return good;
  if (runs.length === 2 && runs.every((r) => r.to !== null) && runs[0].to !== runs[1].to && !(typeof runs[0].to === "number" && typeof runs[1].to === "number" && close(runs[0].to, runs[1].to)))
    return wrong("the left and right sides don't approach the same thing");
  if (runs.some((r) => r.to === "inf" || r.to === "-inf")) return wrong("near this point the function grows without bound");
  if (runs.every((r) => typeof r.to === "number")) return wrong("the function doesn't approach that value");
  throw new Unclear("no clear trend");
}

function derivativeNote(R: string, v: string, prefix: string): string | undefined {
  try {
    return `${prefix} ${pretty(math.simplify(math.derivative(parse(R), v)))}`;
  } catch {
    return undefined;
  }
}

const round = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(1) : Number(n.toPrecision(4)).toString());
