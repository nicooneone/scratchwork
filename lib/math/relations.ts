// Owner: B. Equations and inequalities in any number of variables, compared step to step.
//
// Is line B a correct step from line A?
//  1. Proportional test: F_B / F_A is one nonzero constant at random points (all legal "do the same
//     thing to both sides" moves for polynomial-style steps). Fast and exact. -> correct.
//  2. Solution sets: find the real solutions of both lines (in one variable; any others fixed at random
//     values, several trials) by scanning for sign changes and bisecting. Same set -> correct, even when
//     the step isn't proportional (√x = 3 -> x = 9, log rules, clearing a denominator).
//     B has EXTRA solutions (squaring both sides) -> correct, with a note to check for extraneous ones.
//     B LOST a solution (dividing by x, taking only the + square root) -> error.
//     Periodic lines (trig) have endless solutions: no verdict from sets, so we don't flag "x = π/6".
//  3. Inequalities: B is a correct step iff it is true for exactly the same values as A (sampled away
//     from the boundary). Forgetting to flip the sign when dividing by a negative breaks this.
import { Unclear, math, normalize, rng, splitTopLevel, type Fn } from "./expr";
import type { MathNode } from "mathjs";

export type Op = "=" | "<" | ">" | "<=" | ">=";
type Env = Record<string, number>;
type MFn = (env: Env) => number;

export interface Clause {
  lhs: MFn;
  rhs: MFn;
  op: Op;
}

export interface Relation {
  kind: "equation" | "inequality";
  vars: string[];
  /** Equations: clauses joined by "or" (solutions = union). Inequalities: clauses joined by "and" (chained 1 < x < 3). */
  clauses: Clause[];
}

const CONSTANTS = new Set(["pi", "e", "E", "PI", "i", "Infinity", "NaN"]);

function compile(node: MathNode): MFn {
  const code = node.compile();
  return (env) => {
    try {
      const r = code.evaluate({ ...env });
      return typeof r === "number" && Number.isFinite(r) ? r : NaN;
    } catch {
      return NaN;
    }
  };
}

function varsOf(node: MathNode): string[] {
  const fns = new Set<string>();
  node.traverse((n) => {
    const f = (n as unknown as { type: string; fn?: { name?: string } });
    if (f.type === "FunctionNode" && f.fn?.name) fns.add(f.fn.name);
  });
  const out = new Set<string>();
  node.traverse((n) => {
    const s = n as unknown as { type: string; name: string };
    if (s.type === "SymbolNode" && !fns.has(s.name) && !CONSTANTS.has(s.name)) out.add(s.name);
  });
  return [...out];
}

const OP_RE = /(<=|>=|≤|≥|<|>|=)/;
const canon = (op: string): Op => (op === "≤" ? "<=" : op === "≥" ? ">=" : (op as Op));

/** Parse a line with = < > ≤ ≥ (chained and "or" lists allowed) into a Relation. Throws Unclear. */
export function parseRelation(text: string): Relation {
  const src = text.trim().replace(/≠|!=/g, "\u0000");
  if (src.includes("\u0000")) throw new Unclear("≠ isn't checked");
  const ors = splitTopLevel(src, /^(\s+or\s+|,|;)/i);
  if (!ors.length) throw new Unclear("empty");
  const clauses: Clause[] = [];
  const vars = new Set<string>();
  let kind: Relation["kind"] | null = null;
  for (const part of ors) {
    const pieces = part.split(OP_RE).map((p) => p.trim());
    // pieces: [expr, op, expr, op, expr ...]
    if (pieces.length < 3 || pieces.length % 2 === 0) throw new Unclear("needs a relation");
    const exprs = pieces.filter((_, i) => i % 2 === 0);
    const ops = pieces.filter((_, i) => i % 2 === 1).map(canon);
    if (exprs.some((e) => !e)) throw new Unclear("empty side");
    const isEq = ops.every((o) => o === "=");
    const isIneq = ops.every((o) => o !== "=");
    if (!isEq && !isIneq) throw new Unclear("mixed = and <");
    if (isEq && ops.length > 1) throw new Unclear("a = b = c chains are checked as expressions");
    const k = isEq ? "equation" : "inequality";
    if (kind && kind !== k) throw new Unclear("mixed equation and inequality");
    if (k === "inequality" && ors.length > 1) throw new Unclear("'or' between inequalities isn't checked");
    kind = k;
    const nodes = exprs.map((e) => {
      try {
        return math.parse(normalize(e));
      } catch (err) {
        if (err instanceof Unclear) throw err;
        throw new Unclear(`can't parse "${e}"`);
      }
    });
    for (const n of nodes) for (const v of varsOf(n)) vars.add(v);
    const fns = nodes.map(compile);
    for (let i = 0; i < ops.length; i++) clauses.push({ lhs: fns[i], rhs: fns[i + 1], op: ops[i] });
  }
  if (vars.size > 3) throw new Unclear("too many variables");
  return { kind: kind!, vars: [...vars].sort(), clauses };
}

/** Equation line function: Π (lhs - rhs). Zero exactly on the solution set. */
const lineF = (r: Relation): MFn => (env) => r.clauses.reduce((acc, c) => acc * (c.lhs(env) - c.rhs(env)), 1);

function holds(r: Relation, env: Env): boolean | null {
  let all = true;
  for (const c of r.clauses) {
    const a = c.lhs(env), b = c.rhs(env);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const d = a - b;
    if (Math.abs(d) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b))) return null; // on the boundary: skip
    const ok = c.op === "<" || c.op === "<=" ? d < 0 : d > 0;
    all &&= ok;
  }
  return all;
}

export type StepResult = { verdict: "correct" | "error" | "unclear"; note?: string; misconception?: string };

const relClose = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** The variable we solve for: one that the new line isolates ("x = …"), else x, else the first. */
function primaryVar(a: Relation, b: Relation, bText: string): string {
  const all = [...new Set([...a.vars, ...b.vars])];
  const iso = bText.trim().match(/^([a-zA-Z])\s*(=|<|>|<=|>=|≤|≥)/)?.[1];
  if (iso && all.includes(iso)) return iso;
  if (all.includes("x")) return "x";
  return all[0];
}

// ---------- 1. proportional test, any number of variables ----------
function proportional(Fa: MFn, Fb: MFn, vars: string[], seed: number): boolean | null {
  const r = rng(seed);
  const ratios: number[] = [];
  for (let tries = 0; tries < 80 && ratios.length < 7; tries++) {
    const env: Env = {};
    for (const v of vars) env[v] = -10 + 20 * r();
    const a = Fa(env), b = Fb(env);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) < 1e-3) continue;
    ratios.push(b / a);
  }
  if (ratios.length < 4) return null;
  if (ratios.every((q) => Math.abs(q) < 1e-9)) return null;
  if (ratios.some((q) => Math.abs(q) < 1e-9)) return false;
  return ratios.every((q) => relClose(q, ratios[0], 1e-6));
}

// ---------- 2. real solutions in one variable ----------
const GRID = (() => {
  // Dense near 0, reaching ±1000: x = sinh(t · asinh(1000)), t uniform in [-1, 1].
  const n = 3200, k = Math.asinh(1000), out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(Math.sinh((-1 + (2 * i) / n) * k));
  return out;
})();

/** Real roots of f on [-1000, 1000]. null = too many to compare (periodic) or f undefined almost everywhere. */
export function realRoots(f: Fn): number[] | null {
  const ys = GRID.map(f);
  const finite = ys.filter(Number.isFinite);
  if (finite.length < GRID.length * 0.1) return null;
  const scale = Math.max(1e-9, ...finite.map((y) => Math.min(Math.abs(y), 1e6))) ; // typical magnitude
  const roots: number[] = [];
  const add = (x: number) => {
    if (!roots.some((r) => Math.abs(r - x) <= 1e-6 * Math.max(1, Math.abs(x)))) roots.push(x);
  };
  for (let i = 0; i < GRID.length - 1; i++) {
    let a = GRID[i], b = GRID[i + 1];
    let fa = ys[i], fb = ys[i + 1];
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (fa === 0) { add(a); continue; }
    if (fa * fb < 0) {
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2, fm = f(m);
        if (!Number.isFinite(fm)) { a = NaN; break; }
        if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      }
      if (Number.isNaN(a)) continue;
      const m = (a + b) / 2;
      // A sign change across a pole (1/x) is not a root.
      if (Math.abs(f(m)) <= 1e-6 * Math.max(1, Math.min(scale, 1e3))) add(m);
    } else if (i > 0 && Number.isFinite(ys[i - 1])) {
      // Touching root (double root like (x-2)^2): local minimum of |f| that reaches ~0.
      const l = Math.abs(ys[i - 1]), c = Math.abs(fa), rr = Math.abs(fb);
      if (c <= l && c <= rr) {
        let lo = GRID[i - 1], hi = GRID[i + 1];
        for (let k = 0; k < 80; k++) {
          const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
          if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2; else lo = m1;
        }
        const m = (lo + hi) / 2;
        if (Math.abs(f(m)) <= 1e-9 * Math.max(1, Math.min(scale, 1e3))) add(m);
      }
    }
    if (roots.length > 12) return null; // periodic (sin x = 1/2): endless solutions
  }
  if (ys[ys.length - 1] === 0) add(GRID[GRID.length - 1]);
  return roots.sort((x, y) => x - y);
}

/** x solves lhs = -rhs for some clause: the extraneous root squaring both sides creates. */
function squaringRoot(r: Relation, env: Env): boolean {
  return r.clauses.some((c) => {
    const l = c.lhs(env), m = c.rhs(env);
    return Number.isFinite(l) && Number.isFinite(m) && Math.abs(l + m) <= 1e-5 * Math.max(1, Math.abs(l), Math.abs(m));
  });
}

/** The line isn't defined at env (a denominator or log is zero/negative there). */
function undefinedAt(r: Relation, env: Env): boolean {
  return r.clauses.some((c) => !Number.isFinite(c.lhs(env)) || !Number.isFinite(c.rhs(env)));
}

const contains = (big: number[], small: number[]) => small.every((s) => big.some((b) => relClose(s, b, 1e-5)));

function compareSolutionSets(a: Relation, b: Relation, v: string, others: string[], seed: number): StepResult | null {
  const Fa = lineF(a), Fb = lineF(b);
  const r = rng(seed);
  let gained = false, sawRoots = false;
  for (let trial = 0; trial < (others.length ? 3 : 1); trial++) {
    const fixed: Env = {};
    for (const o of others) fixed[o] = Math.round((-6 + 12 * r()) * 100) / 100 || 1.37;
    const ra = realRoots((x) => Fa({ ...fixed, [v]: x }));
    const rb = realRoots((x) => Fb({ ...fixed, [v]: x }));
    if (!ra || !rb) return null;
    if (ra.length || rb.length) sawRoots = true;
    if (!contains(rb, ra)) {
      return {
        verdict: "error",
        note: rb.length < ra.length ? "this step lost a solution the line above has" : "this line has different solutions than the line above",
        misconception: rb.length < ra.length ? "lost-a-solution" : undefined,
      };
    }
    if (!contains(ra, rb)) {
      // Extra solutions are fine only when the step explains them: squaring both sides (an extra root
      // satisfies lhs = -rhs of the line above) or clearing a denominator (the line above isn't even
      // defined there). Anything else (e.g. no solutions -> two solutions) is a wrong step.
      const extra = rb.filter((x) => !ra.some((y) => relClose(x, y, 1e-5)));
      const explained = ra.length > 0 || extra.every((x) => undefinedAt(a, { ...fixed, [v]: x }));
      if (!explained || !extra.every((x) => squaringRoot(a, { ...fixed, [v]: x }) || undefinedAt(a, { ...fixed, [v]: x })))
        return { verdict: "error", note: "this line has solutions the line above doesn't" };
      gained = true;
    }
  }
  if (!sawRoots) return null; // both have no real solutions: nothing to compare
  if (gained)
    return { verdict: "correct", note: "this step (squaring both sides or clearing a denominator) can add solutions, so check your answers in the original equation" };
  return { verdict: "correct" };
}

// ---------- 3. inequalities: same truth values ----------
function compareInequalities(a: Relation, b: Relation, v: string, others: string[], seed: number): StepResult | null {
  const r = rng(seed);
  let compared = 0, disagree = 0;
  for (let trial = 0; trial < (others.length ? 3 : 1); trial++) {
    const fixed: Env = {};
    for (const o of others) fixed[o] = -6 + 12 * r();
    for (const x of GRID.filter((_, i) => i % 8 === 0)) {
      const env = { ...fixed, [v]: x };
      const ta = holds(a, env), tb = holds(b, env);
      if (ta === null || tb === null) continue;
      compared++;
      if (ta !== tb) disagree++;
    }
  }
  if (compared < 40) return null;
  if (!disagree) return { verdict: "correct" };
  return {
    verdict: "error",
    note: "this inequality isn't true for the same values as the line above",
    misconception: flippedOnly(a, b, v, others) ? "inequality-sign-not-flipped" : undefined,
  };
}

/** Would flipping B's inequality signs make it match A? (classic: divided by a negative, kept the sign) */
function flippedOnly(a: Relation, b: Relation, v: string, others: string[]): boolean {
  const flip: Record<Op, Op> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=", "=": "=" };
  const bf: Relation = { ...b, clauses: b.clauses.map((c) => ({ ...c, op: flip[c.op] })) };
  return compareInequalities(a, bf, v, others, 7)?.verdict === "correct";
}

/** Is `bText` a correct step after `aText`? Both are relations (= or inequalities). */
export function compareSteps(a: Relation, b: Relation, bText: string, seed = 0x5eed): StepResult {
  if (a.kind !== b.kind) return { verdict: "unclear" };
  if (b.vars.some((v) => !a.vars.includes(v))) return { verdict: "unclear" }; // a new letter: substitution, not checkable here
  const vars = a.vars;
  if (!vars.length) return { verdict: "unclear" };
  const v = primaryVar(a, b, bText);
  const others = vars.filter((x) => x !== v);

  if (a.kind === "inequality") return compareInequalities(a, b, v, others, seed) ?? { verdict: "unclear" };

  const prop = proportional(lineF(a), lineF(b), vars, seed);
  if (prop === true) return { verdict: "correct" };
  const sets = compareSolutionSets(a, b, v, others, seed);
  if (sets) return sets;
  return { verdict: "unclear" };
}

/** Expression equality in any number of variables: a - b ≈ 0 at random points. */
export function expressionsEqual(a: MathNode, b: MathNode, seed = 0x5eed): boolean | null {
  const vars = [...new Set([...varsOf(a), ...varsOf(b)])];
  if (vars.length > 3) return null;
  const fa = compile(a), fb = compile(b);
  const r = rng(seed);
  let n = 0;
  for (let tries = 0; tries < 80 && n < 7; tries++) {
    const env: Env = {};
    for (const v of vars) env[v] = -10 + 20 * r();
    const x = fa(env), y = fb(env);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e8) continue;
    n++;
    if (!relClose(x, y, 1e-6)) return false;
  }
  return n >= 4 ? true : null;
}

export { varsOf };
