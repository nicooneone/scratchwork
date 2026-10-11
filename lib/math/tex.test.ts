import { describe, expect, it } from "vitest";
import { answerTex, asciiToTex, repairLatexEscapes, toSegments } from "./tex";

const math = (t: string) => toSegments(t).filter((s) => s.kind === "math").map((s) => (s as { tex: string }).tex);
const text = (t: string) => toSegments(t).filter((s) => s.kind === "text").map((s) => (s as { text: string }).text).join("");

describe("toSegments", () => {
  it("keeps $...$ LaTeX from Gemini as-is", () => {
    expect(toSegments("Evaluate $\\int 6x(x^2+1)^2\\,dx$.")).toEqual([
      { kind: "text", text: "Evaluate " },
      { kind: "math", tex: "\\int 6x(x^2+1)^2\\,dx" },
      { kind: "text", text: "." },
    ]);
  });
  it("turns 'integral of … dx' into a real integral, never 'int'", () => {
    const m = math("Find the integral of 6x(x^2 + 1)^2 dx");
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/^\\int /);
    expect(m[0]).toMatch(/\\,dx$/);
    expect(m[0]).toMatch(/\^\{2\}/);
    expect(text("Find the integral of 6x(x^2 + 1)^2 dx")).toBe("Find ");
  });
  it("detects equations in plain text", () => {
    const m = math("Solve 2(x - 5) + 3 = x + 4");
    expect(m).toHaveLength(1);
    expect(m[0]).toContain("=");
    expect(text("Solve 2(x - 5) + 3 = x + 4")).toBe("Solve ");
  });
  it("keeps English words as text and trailing punctuation outside the math", () => {
    const segs = toSegments("Differentiate x^2 * sin(x).");
    expect(segs[0]).toEqual({ kind: "text", text: "Differentiate " });
    expect(segs[1].kind).toBe("math");
    expect(segs[2]).toEqual({ kind: "text", text: "." });
  });
  it("d/dx becomes a fraction", () => expect(math("Find d/dx x^3")[0]).toMatch(/\\frac\{d\}\{dx\}/));
  it("empty and plain text are safe", () => {
    expect(toSegments("")).toEqual([]);
    expect(toSegments("No math here")).toEqual([{ kind: "text", text: "No math here" }]);
  });
});

describe("asciiToTex / answerTex", () => {
  it("powers, roots, fractions", () => {
    expect(asciiToTex("x^2 + 1")).toMatch(/x\s*\}?\^\{2\}/);
    expect(asciiToTex("sqrt(x)")).toMatch(/\\sqrt/);
    expect(asciiToTex("1/3")).toMatch(/\\frac\{1\}\{3\}/);
  });
  it("answers with or", () => expect(answerTex("x = 2 or x = 3")).toMatch(/\\text\{ or \}/));
  it("never throws on garbage", () => expect(() => asciiToTex(")(*&")).not.toThrow());

  it("keeps the multiplication sign between two numbers (5·2^7, not 52^7)", () => {
    expect(answerTex("5*2^7")).toMatch(/5\s*\\cdot\s*\{?2\}?\^\{7\}/);
    expect(answerTex("2*3")).toMatch(/2\s*\\cdot\s*3/);
  });
  it("a colon ends the math: 'Solve for x: …'", () => {
    const segs = toSegments("Solve for x: -3(2x + 1) = 9");
    const texts = segs.filter((s) => s.kind === "text").map((s) => (s as { text: string }).text).join("");
    expect(texts).toContain(":");
    expect(segs.some((s) => s.kind === "math" && /9/.test(s.tex) && !/:/.test(s.tex))).toBe(true);
  });
  it("function notation stays f(x)", () => {
    const tex = toSegments("If f(x) = x^3 - 2x, find the slope").find((s) => s.kind === "math") as { tex: string };
    expect(tex.tex).toMatch(/f\(x\)/);
  });

  it("repairs LaTeX that JSON turned into control characters (\\times -> TAB + imes)", () => {
    const broken = "Evaluate $2^2 \times 2^3$ and $\frac{1}{2} \neq \beta$"; // TAB, form feed, newline, backspace
    const fixed = repairLatexEscapes(broken);
    expect(fixed).toBe("Evaluate $2^2 \\times 2^3$ and $\\frac{1}{2} \\neq \\beta$");
    const math = toSegments(broken).filter((s) => s.kind === "math").map((s) => (s as { tex: string }).tex);
    expect(math).toEqual(["2^2 \\times 2^3", "\\frac{1}{2} \\neq \\beta"]);
  });
  it("leaves real line breaks in plain text alone", () => {
    expect(repairLatexEscapes("Line one\nnext line")).toBe("Line one\nnext line");
  });
});
