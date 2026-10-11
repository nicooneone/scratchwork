// Owner: B. Turn quiz text into display segments: plain words and LaTeX math.
// Questions from Gemini carry math as $...$ LaTeX. Anything older (or sample data) is plain ASCII
// like "Find the integral of 6x(x^2 + 1)^2 dx", so we detect the math in it and convert it,
// e.g. "integral of … dx" becomes \int … \, dx and x^2 becomes x^{2}.
import { math, normalize } from "./expr";

export type Segment = { kind: "text"; text: string } | { kind: "math"; tex: string };

/** ASCII math -> LaTeX via mathjs. Falls back to light rewriting when it won't parse. */
export function asciiToTex(expr: string): string {
  const src = expr
    .trim()
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\bln\b/g, "log");
  try {
    // Equations / lists: convert each side so "=" and "or" survive.
    if (/=|\bor\b/.test(src)) {
      return src
        .split(/\s+or\s+/)
        .map((clause) => clause.split("=").map((side) => asciiToTex(side)).join(" = "))
        .join(" \\text{ or } ");
    }
    // normalize() makes "x(" a product, not a call to a function named x (same rules as the checker).
    const tex = math.parse(normalize(src)).toTex({ implicit: "hide", parenthesis: "keep" });
    return tex
      .replace(/~/g, "") // mathjs spacing for implicit products: 6~x -> 6x
      .replace(/\\cdot(?!\s*[\d.])/g, "\\,") // x·(…) -> x(…), but keep 2·3
      .replace(/\{\s+/g, "{")
      .replace(/\\log\\left\(/g, "\\ln\\left(");
  } catch {
    return src
      .replace(/sqrt\(([^()]*)\)/g, "\\sqrt{$1}")
      .replace(/\^\(([^()]*)\)/g, "^{$1}")
      .replace(/\^(-?[\w.]+)/g, "^{$1}")
      .replace(/\*/g, "\\cdot ")
      .replace(/\bpi\b/g, "\\pi")
      .replace(/\b(sin|cos|tan|ln|log|exp)\b/g, "\\$1");
  }
}

const MATH_WORDS = new Set(["sin", "cos", "tan", "sec", "csc", "cot", "ln", "log", "exp", "sqrt", "pi", "e", "x", "y", "t", "u"]);

/** A token that looks like math: has an operator or digit, or is a function/variable name. */
function mathy(tok: string): boolean {
  const core = tok.replace(/[,.;:?!]+$/, "");
  if (!core) return false;
  if (!/^[0-9A-Za-z()+\-*/^=.,πθ√]+$/.test(core)) return false;
  if (/[=^*/()+]|\d/.test(core) || /^-/.test(core)) return true;
  return MATH_WORDS.has(core.toLowerCase()) && core.length <= 4;
}

/** Plain-ASCII prompt -> segments, converting detected math runs. */
function autoSegments(text: string): Segment[] {
  // "the integral of EXPR dx" / "∫ EXPR dx" -> one math segment.
  const intRe = /(?:the\s+)?(?:indefinite\s+)?(?:integral\s+of|∫)\s*(.+?)\s*d([a-z])\b/i;
  const m = text.match(intRe);
  if (m && m.index !== undefined) {
    return [
      ...autoSegments(text.slice(0, m.index)),
      { kind: "math", tex: `\\int ${asciiToTex(m[1])}\\,d${m[2]}` },
      ...autoSegments(text.slice(m.index + m[0].length)),
    ];
  }
  const out: Segment[] = [];
  const tokens = text.split(/(\s+)/);
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    const raw = run.join("").trim();
    const trail = raw.match(/[,.;:?!]+$/)?.[0] ?? "";
    const body = trail ? raw.slice(0, -trail.length) : raw;
    // A lone variable or number reads fine as math; a lone English word ("a") does not.
    if (body) out.push({ kind: "math", tex: body.replace(/^d\/dx\s*/i, "\\frac{d}{dx}\\,").replace(/^(?!\\frac)(.*)$/, (s) => (s.startsWith("\\frac") ? s : asciiToTex(s))) });
    if (trail) out.push({ kind: "text", text: trail });
    run = [];
  };
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      if (run.length) run.push(tok);
      else out.push({ kind: "text", text: tok });
      continue;
    }
    if (mathy(tok) || /^d\/dx/i.test(tok)) run.push(tok);
    else {
      // whitespace captured at the end of a run belongs to the text that follows
      const tailSpace = run.length && /^\s+$/.test(run[run.length - 1]) ? run.pop()! : "";
      flush();
      if (tailSpace) out.push({ kind: "text", text: tailSpace });
      out.push({ kind: "text", text: tok });
    }
  }
  flush();
  return merge(out);
}

/** Split "Evaluate $\\int x\\,dx$ now" into text and math. No $ at all -> auto-detect math in ASCII. */
export function toSegments(text: string): Segment[] {
  if (!text) return [];
  if (!/\$[^$]+\$|\\\(.+?\\\)/.test(text)) return autoSegments(text);
  const out: Segment[] = [];
  const re = /\$([^$]+)\$|\\\((.+?)\\\)/g;
  let last = 0;
  for (let m: RegExpExecArray | null; (m = re.exec(text)); ) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push({ kind: "math", tex: (m[1] ?? m[2]).trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return merge(out);
}

function merge(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (s.kind === "text" && prev?.kind === "text") prev.text += s.text;
    else if (!(s.kind === "text" && s.text === "")) out.push({ ...s });
  }
  return out;
}

/** An answer key (ASCII) as LaTeX, for "Show answers". */
export function answerTex(answer: string): string {
  return /\$/.test(answer) ? answer.replace(/\$/g, "") : asciiToTex(answer);
}
