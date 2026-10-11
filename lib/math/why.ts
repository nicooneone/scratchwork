// "Show me why": turns a math-verified mistake into a graph a student can see.
//
//  - Equation step: plot both sides of the line BEFORE the step (they meet at the real answer), then
//    the line AFTER it. A correct step never moves where the sides meet; a wrong one does.
//  - Integral: plot what was integrated next to the slope of the student's answer. A right answer's
//    slope sits exactly on top of the integrand.
//  - Derivative: plot the real slope of the expression next to the student's answer.
//
// Pure and deterministic: no AI, no network. Returns null when there is nothing honest to draw.
import type { CheckedLine } from "../types";
import { normalize, parse, stripConstant, toFn, freeVars, type Fn, Unclear } from "./expr";
import { parseEquation } from "./verify";

export type Tone = "ink" | "soft" | "ok" | "mark";

export interface Curve {
  label: string;
  tone: Tone;
  dashed?: boolean;
  ys: number[]; // sampled at WhyGraph.xs
}

export interface Dot {
  x: number;
  y: number;
  tone: Tone;
  label: string;
  ghost?: boolean; // where the answer USED to be
}

export interface Frame {
  title: string;
  curves: Curve[];
  dots: Dot[];
  caption: string;
}

export interface WhyGraph {
  kind: "equation" | "integral" | "derivative";
  v: string; // the variable, for axis labels
  xs: number[];
  view: { x0: number; x1: number; y0: number; y1: number };
  /** Equation graphs morph from frames[0] to frames[1]; calculus graphs have one frame. */
  frames: Frame[];
  /** One or two sentences that sum it up (also spoken aloud). */
  summary: string;
}

const N = 160;
const H = 1e-4;

// ---------- small numeric helpers ----------

/** 14, -10, 2/11, 0.37 — the way a student would write the number. */
export function niceNumber(x: number): string {
  if (!Number.isFinite(x)) return "?";
  const sign = x < 0 ? "−" : "";
  const a = Math.abs(x);
  if (Math.abs(a - Math.round(a)) < 1e-6) return sign + String(Math.round(a));
  for (let d = 2; d <= 12; d++) {
    const n = Math.round(a * d);
    if (Math.abs(a - n / d) < 1e-6) {
      const g = gcd(n, d);
      return `${sign}${n / g}/${d / g}`;
    }
  }
  return sign + a.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Real roots of g in [lo, hi]: sign changes refined by bisection; skips poles (huge jumps). */
export function roots(g: Fn, lo = -100, hi = 100, steps = 4000): number[] {
  const out: number[] = [];
  let px = lo, py = g(lo);
  for (let i = 1; i <= steps; i++) {
    const x = lo + ((hi - lo) * i) / steps;
    const y = g(x);
    if (Number.isFinite(py) && Number.isFinite(y)) {
      if (y === 0) out.push(x);
      else if (py !== 0 && Math.sign(py) !== Math.sign(y) && Math.abs(py) < 1e6 && Math.abs(y) < 1e6) {
        let a = px, b = x, fa = py;
        for (let k = 0; k < 60; k++) {
          const m = (a + b) / 2, fm = g(m);
          if (!Number.isFinite(fm)) break;
          if (Math.sign(fm) === Math.sign(fa)) {
            a = m;
            fa = fm;
          } else b = m;
        }
        const r = (a + b) / 2;
        if (Math.abs(g(r)) < 1e-6 * Math.max(1, Math.abs(py), Math.abs(y))) out.push(r); // not a pole
      }
    }
    px = x;
    py = y;
  }
  // Snap near-integers and drop duplicates.
  const snapped = out.map((r) => (Math.abs(r - Math.round(r)) < 1e-7 ? Math.round(r) : r));
  return snapped.filter((r, i) => snapped.findIndex((s) => Math.abs(s - r) < 1e-6) === i);
}

/** True if g is zero everywhere we look (an identity like 0 = 0). */
const isIdentity = (g: Fn) => [-7.3, -2.1, 0.6, 3.4, 8.9].every((x) => Math.abs(g(x)) < 1e-9);

function sample(f: Fn, xs: number[]): number[] {
  return xs.map((x) => f(x));
}

function linspace(a: number, b: number, n = N): number[] {
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/** A y-window that shows the interesting part, ignoring blow-ups near poles. */
function yWindow(series: number[][], mustShow: number[]): { y0: number; y1: number } {
  const ys = series.flat().filter(Number.isFinite).sort((a, b) => a - b);
  let lo = ys.length ? ys[Math.floor(ys.length * 0.04)] : -5;
  let hi = ys.length ? ys[Math.ceil(ys.length * 0.96) - 1] : 5;
  for (const y of mustShow) {
    if (!Number.isFinite(y)) continue;
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  if (hi - lo < 1e-6) {
    lo -= 5;
    hi += 5;
  }
  const pad = (hi - lo) * 0.15;
  return { y0: lo - pad, y1: hi + pad };
}

const meetText = (rs: number[], v: string, identity: boolean) =>
  identity
    ? "the two sides are equal everywhere"
    : rs.length === 0
      ? "the two sides never meet"
      : rs.length === 1
        ? `the two sides meet at ${v} = ${niceNumber(rs[0])}`
        : `the two sides meet at ${v} = ${rs.map(niceNumber).join(" and ")}`;

// ---------- equation steps ----------

function singleClause(text: string): { lhs: Fn; rhs: Fn; v: string } | null {
  try {
    const eq = parseEquation(text);
    if (eq.clauses.length !== 1) return null;
    return { ...eq.clauses[0], v: eq.v ?? "x" };
  } catch {
    return null;
  }
}

function equationGraph(prevText: string, errText: string, errIndex: number): WhyGraph | null {
  const before = singleClause(prevText);
  const after = singleClause(errText);
  if (!before || !after || before.v !== after.v) return null;
  const v = before.v;
  const gB: Fn = (x) => before.lhs(x) - before.rhs(x);
  const gA: Fn = (x) => after.lhs(x) - after.rhs(x);
  const idB = isIdentity(gB), idA = isIdentity(gA);
  const rB = idB ? [] : roots(gB);
  const rA = idA ? [] : roots(gA);
  // Nothing visibly moved: no honest picture to draw.
  if (idB === idA && rB.length === rA.length && rB.every((r, i) => Math.abs(r - rA[i]) < 1e-6)) return null;

  const all = [...rB, ...rA];
  let x0 = -10, x1 = 10;
  if (all.length) {
    const lo = Math.min(...all), hi = Math.max(...all);
    const span = Math.max(8, (hi - lo) * 1.6);
    const mid = (lo + hi) / 2;
    // Whole-number ends read better on an axis than 1/2 and 17/2.
    x0 = Math.floor(mid - span / 2);
    x1 = Math.ceil(mid + span / 2);
  }
  const xs = linspace(x0, x1);
  const curvesB = [sample(before.lhs, xs), sample(before.rhs, xs)];
  const curvesA = [sample(after.lhs, xs), sample(after.rhs, xs)];
  const dotsB: Dot[] = rB.map((r) => ({ x: r, y: before.lhs(r), tone: "ok", label: `${v} = ${niceNumber(r)}` }));
  const dotsA: Dot[] = rA.map((r) => ({ x: r, y: after.lhs(r), tone: "mark", label: `${v} = ${niceNumber(r)}` }));
  const { y0, y1 } = yWindow([...curvesB, ...curvesA], [...dotsB, ...dotsA].map((d) => d.y));

  const was = meetText(rB, v, idB);
  const now = meetText(rA, v, idA);
  const moved =
    rB.length === 1 && rA.length === 1
      ? `Your step on line ${errIndex} moved the answer from ${v} = ${niceNumber(rB[0])} to ${v} = ${niceNumber(rA[0])}.`
      : `Your step on line ${errIndex} changed the answer.`;

  return {
    kind: "equation",
    v,
    xs,
    view: { x0, x1, y0, y1 },
    frames: [
      {
        title: "Before your step",
        curves: [
          { label: "left side", tone: "ink", ys: curvesB[0] },
          { label: "right side", tone: "soft", dashed: true, ys: curvesB[1] },
        ],
        dots: dotsB,
        caption: `Before your step, ${was}.`,
      },
      {
        title: "After your step",
        curves: [
          { label: "left side", tone: "ink", ys: curvesA[0] },
          { label: "right side", tone: "soft", dashed: true, ys: curvesA[1] },
        ],
        dots: [...dotsB.map((d) => ({ ...d, ghost: true })), ...dotsA],
        caption: `After it, ${now}.`,
      },
    ],
    summary: `A correct step never moves where the two sides meet. ${moved}`,
  };
}

// ---------- calculus ----------

function exprFn(text: string): { f: Fn; vars: string[] } {
  const node = parse(normalize(stripConstant(text).expr));
  return { f: toFn(node, freeVars(node, ["C", "K"])[0] ?? "x"), vars: freeVars(node, ["C", "K"]) };
}

const slopeOf = (F: Fn): Fn => (x) => (F(x + H) - F(x - H)) / (2 * H);

/** If g is a constant multiple k of f (k ≠ 1), return k. */
function constantMultiple(f: Fn, g: Fn, xs: number[]): number | null {
  const ks = xs.filter((x) => Math.abs(f(x)) > 0.05 && Number.isFinite(g(x))).map((x) => g(x) / f(x));
  if (ks.length < 10) return null;
  const sorted = [...ks].sort((a, b) => a - b);
  const k = sorted[Math.floor(sorted.length / 2)];
  if (!ks.every((r) => Math.abs(r - k) <= 0.02 * Math.max(1, Math.abs(k)))) return null;
  return Math.abs(k - 1) > 0.02 ? k : null;
}

function calculusGraph(kind: "integral" | "derivative", target: Fn, studentSlope: Fn, v: string, targetLabel: string, studentLabel: string): WhyGraph | null {
  const xs = linspace(-3, 3);
  const a = sample(target, xs);
  const b = sample(studentSlope, xs);
  if (a.filter(Number.isFinite).length < 20 || b.filter(Number.isFinite).length < 20) return null;
  // If they already agree, there is nothing to show.
  if (a.every((y, i) => !Number.isFinite(y) || !Number.isFinite(b[i]) || Math.abs(y - b[i]) <= 1e-3 * Math.max(1, Math.abs(y)))) return null;
  const { y0, y1 } = yWindow([a, b], []);
  const k = constantMultiple(target, studentSlope, xs);
  const how =
    k == null
      ? "They should sit exactly on top of each other, and they don't."
      : Math.abs(k + 1) < 0.02
        ? "Yours is the same curve flipped upside down: check your sign."
        : `Yours is ${niceNumber(k)}× as tall everywhere: look for an extra factor of ${niceNumber(k)}.`;
  const caption =
    kind === "integral"
      ? `If your answer were right, the slope of your answer (red) would sit exactly on what you integrated (blue). ${how}`
      : `If your answer were right, it (red) would sit exactly on the real slope (blue). ${how}`;
  return {
    kind,
    v,
    xs,
    view: { x0: -3, x1: 3, y0, y1 },
    frames: [
      {
        title: kind === "integral" ? "Differentiate your answer" : "Compare the slopes",
        curves: [
          { label: targetLabel, tone: "ink", ys: a },
          { label: studentLabel, tone: "mark", ys: b },
        ],
        dots: [],
        caption,
      },
    ],
    summary: kind === "integral" ? `Differentiating your answer should give back exactly what you integrated. ${how}` : `Your answer should match the real slope everywhere. ${how}`,
  };
}

// ---------- entry point ----------

/** The graph for the first wrong line, or null if this kind of mistake can't be drawn honestly. */
export function buildWhy(err: CheckedLine, context: CheckedLine[]): WhyGraph | null {
  try {
    if (err.verdict !== "error") return null;

    if (err.kind === "integral" && err.integrand && err.result && !err.lower && !err.upper) {
      const f = exprFn(err.integrand);
      const R = exprFn(err.result);
      const v = f.vars[0] ?? R.vars[0] ?? "x";
      return calculusGraph("integral", f.f, slopeOf(R.f), v, "what you integrated", "slope of your answer");
    }
    if (err.kind === "derivative" && err.expr && err.result) {
      const E = exprFn(err.expr);
      const R = exprFn(err.result);
      const v = E.vars[0] ?? R.vars[0] ?? "x";
      return calculusGraph("derivative", slopeOf(E.f), R.f, v, "real slope", "your answer");
    }

    if (!err.text.includes("=")) return null;
    // The line it should follow from: the last earlier line that is a plain one-clause equation.
    const prev = context
      .filter((l) => l.index < err.index && l.verdict !== "unclear" && l.text.includes("="))
      .sort((a, b) => b.index - a.index)
      .find((l) => singleClause(l.text));
    if (!prev) return null;
    return equationGraph(prev.text, err.text, err.index);
  } catch (e) {
    if (e instanceof Unclear) return null;
    return null;
  }
}
