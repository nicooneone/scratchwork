import { describe, expect, it } from "vitest";
import { answerTex, asciiToTex, toSegments } from "./tex";

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
});
