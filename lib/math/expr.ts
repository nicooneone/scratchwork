// Owner: B. Shared math core: normalization, parsing, sampling, equivalence.
// Pure functions, no I/O. Everything here is deterministic (seeded RNG).
import { all, create, type MathNode } from "mathjs";

/** predictable: sqrt/log of negatives give NaN (skipped) instead of complex numbers. */
export const math = create(all, { predictable: true });

/** Thrown when a line can't be judged by math (falls back to the AI verdict). */
export class Unclear extends Error {}

const FUNCS = "sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|log|ln|sqrt|exp|abs";
const CONSTANTS = new Set(["pi", "e", "E", "PI", "Infinity", "NaN", "i"]);

/** Turn handwriting-flavored ASCII/unicode math into something mathjs parses. */
export function normalize(input: string): string {
  let s = input.trim();
  if (/[±∓]/.test(s)) throw new Unclear("± can't be checked numerically");
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/π/g, "pi")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([a-zA-Z0-9]+)/g, "sqrt($1)")
    .replace(/\*\*/g, "^")
    .replace(/[∫]/g, "")
    .replace(/\s+d([a-z])\s*$/i, "") // trailing "dx"
    .replace(/\bln\b/g, "log");
  // |u| -> abs(u) (non-nested)
  s = s.replace(/\|([^|]+)\|/g, "abs($1)");
  // sin^2(x) -> sin(x)^2
  s = s.replace(new RegExp(`\\b(${FUNCS})\\s*\\^\\s*(\\d+)\\s*\\(([^()]*)\\)`, "g"), "$1($3)^$2");
  // "sin x", "sin 2x", "cos x^2" -> sin(x) ... (the reader is told to use parentheses; this is a safety net)
  s = s.replace(new RegExp(`\\b(${FUNCS})\\s+(\\d*[a-zA-Z](?:\\^\\d+)?)`, "g"), "$1($2)");
  // A single-letter variable directly before "(" is multiplication, not a function call: x(x-5) -> x*(x-5)
  s = s.replace(/(^|[^a-zA-Z_])([a-zA-Z])\s*\(/g, "$1$2*(");
  // )( -> )*(   and   2( -> 2*(
  s = s.replace(/\)\s*\(/g, ")*(").replace(/(\d)\s*\(/g, "$1*(");
  return s;
}

export function parse(expr: string): MathNode {
  try {
    return math.parse(normalize(expr));
  } catch (e) {
    if (e instanceof Unclear) throw e;
    throw new Unclear(`can't parse "${expr}"`);
  }
}

/** Free variables in an expression (function names and constants excluded). */
export function freeVars(node: MathNode, ignore: string[] = []): string[] {
  const fnNames = new Set<string>();
  node.traverse((n) => {
    if ((n as { type: string }).type === "FunctionNode") {
      const fn = (n as unknown as { fn: { name?: string } }).fn;
      if (fn?.name) fnNames.add(fn.name);
    }
  });
  const vars = new Set<string>();
  node.traverse((n) => {
    if ((n as { type: string }).type === "SymbolNode") {
      const name = (n as unknown as { name: string }).name;
      if (!fnNames.has(name) && !CONSTANTS.has(name) && !ignore.includes(name)) vars.add(name);
    }
  });
  return [...vars];
}

export type Fn = (x: number) => number;

/** Compile a node to a real function of `v`. Non-numeric or non-finite results become NaN. */
export function toFn(node: MathNode, v: string): Fn {
  const code = node.compile();
  return (x: number) => {
    try {
      const r = code.evaluate({ [v]: x });
      return typeof r === "number" && Number.isFinite(r) ? r : NaN;
    } catch {
      return NaN;
    }
  };
}

/** mulberry32: tiny seeded RNG so every check is reproducible. */
export function rng(seed = 0x5eed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick sample points in [lo, hi] where `ok(x)` holds. */
export function samples(ok: (x: number) => boolean, lo: number, hi: number, want = 6, maxTries = 60, seed = 0x5eed): number[] {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < maxTries && out.length < want; i++) {
    const x = lo + (hi - lo) * r();
    if (ok(x)) out.push(x);
  }
  return out;
}

export const relClose = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Equation equivalence by ratio: Fb/Fa must be the same nonzero constant at every sample.
 * (Multiplying both sides by k, or swapping sides (k = -1), keeps an equation equivalent.)
 * Returns true / false, or null when there aren't enough usable samples.
 */
export function equivRatio(Fa: Fn, Fb: Fn): boolean | null {
  const xs = samples((x) => {
    const a = Fa(x), b = Fb(x);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) >= 1e-3;
  }, -10, 10, 6, 50);
  if (xs.length < 4) return null;
  const ratios = xs.map((x) => Fb(x) / Fa(x));
  if (ratios.every((r) => Math.abs(r) < 1e-9)) return null; // Fb is identically 0 (e.g. "0 = 0")
  if (ratios.some((r) => Math.abs(r) < 1e-9)) return false;
  return ratios.every((r) => relClose(r, ratios[0], 1e-6));
}

/** Expression equality: a(x) - b(x) ~ 0 at samples. null when there aren't enough samples. */
export function equivDiff(a: Fn, b: Fn, lo = -10, hi = 10): boolean | null {
  const xs = samples((x) => Number.isFinite(a(x)) && Number.isFinite(b(x)) && Math.abs(a(x)) < 1e8, lo, hi, 6, 60);
  if (xs.length < 4) return null;
  return xs.every((x) => relClose(a(x), b(x), 1e-6));
}

/** Split at top-level separators (outside parentheses). */
export function splitTopLevel(s: string, sep: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0) {
      const m = s.slice(i).match(sep);
      if (m && m.index === 0) {
        parts.push(s.slice(start, i));
        i += m[0].length - 1;
        start = i + 1;
      }
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Strip a trailing "+ C" (constant of integration). Returns the expression and whether it was there. */
export function stripConstant(s: string): { expr: string; hadC: boolean } {
  const m = s.match(/\s*\+\s*[CK]\s*$/);
  return m ? { expr: s.slice(0, m.index).trim(), hadC: true } : { expr: s.trim(), hadC: false };
}

/** Pretty-print a mathjs node for notes ("4 x cos(x^2)" style, readable aloud). */
export function pretty(node: MathNode): string {
  return node.toString({ implicit: "hide" }).replace(/\s*\^\s*/g, "^").replace(/\s+\*\s+/g, "·");
}
